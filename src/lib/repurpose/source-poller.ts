import { eq, and } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  workflows,
  connectedAccounts,
  posts,
  distributions,
  type Workflow,
  type WorkflowPollCursor,
} from "@/lib/db/schema";
import {
  fetchInstagramRecentMedia,
  getInstagramUserId,
} from "@/lib/platforms/instagram";
import {
  fetchYouTubeRecentUploads,
  refreshYouTubeToken,
  fetchYouTubeChannelInfo,
} from "@/lib/platforms/youtube";
import {
  fetchFacebookRecentPosts,
  fetchFacebookPages,
} from "@/lib/platforms/facebook";
import {
  fetchTikTokRecentVideos,
  refreshTikTokToken,
} from "@/lib/platforms/tiktok";
import { executePublishForPost } from "@/lib/publish/execute-distributions";
import { downloadYouTubeVideoForRepurpose } from "@/lib/repurpose/youtube-download";
import { downloadTikTokVideoForRepurpose } from "@/lib/repurpose/tiktok-download";

export interface RepurposePollResult {
  workflowsChecked: number;
  workflowsUpdated: number;
  postsCreated: number;
}

const EXISTING_CONTENT_FETCH_LIMIT = 25;
const NEW_CONTENT_FETCH_LIMIT = 10;
/** One download + publish per workflow per cron tick (Vercel 60s limit). */
const MAX_ITEMS_PER_POLL = 1;

function getProcessedIds(cursor: WorkflowPollCursor | null): Set<string> {
  return new Set(cursor?.processed ?? []);
}

function withProcessedId(
  cursor: WorkflowPollCursor | null,
  id: string
): WorkflowPollCursor {
  const processed = [...getProcessedIds(cursor), id];
  return { ...(cursor ?? {}), processed };
}

async function ensureYouTubeAccessToken(
  db: Db,
  account: { id: string; accessToken: string; refreshToken: string | null }
): Promise<string> {
  if (!account.refreshToken) return account.accessToken;

  try {
    await fetchYouTubeChannelInfo(account.accessToken);
    return account.accessToken;
  } catch {
    const tokens = await refreshYouTubeToken(account.refreshToken);
    await db
      .update(connectedAccounts)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || account.refreshToken,
      })
      .where(eq(connectedAccounts.id, account.id));
    return tokens.accessToken;
  }
}

async function ensureFacebookPageToken(
  db: Db,
  account: {
    id: string;
    accessToken: string;
    accountId: string | null;
  }
): Promise<string | null> {
  if (!account.accountId) return null;

  try {
    await fetchFacebookRecentPosts(account.accessToken, account.accountId, 1);
    return account.accessToken;
  } catch {
    try {
      const pages = await fetchFacebookPages(account.accessToken);
      const page = pages.find((p) => p.pageId === account.accountId);
      if (!page) return null;
      await db
        .update(connectedAccounts)
        .set({ accessToken: page.pageAccessToken })
        .where(eq(connectedAccounts.id, account.id));
      return page.pageAccessToken;
    } catch {
      return null;
    }
  }
}

async function ensureTikTokAccessToken(
  db: Db,
  account: { id: string; accessToken: string; refreshToken: string | null }
): Promise<string> {
  if (!account.refreshToken) return account.accessToken;

  try {
    await fetchTikTokRecentVideos(account.accessToken, 1);
    return account.accessToken;
  } catch {
    const tokens = await refreshTikTokToken(account.refreshToken);
    await db
      .update(connectedAccounts)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || account.refreshToken,
      })
      .where(eq(connectedAccounts.id, account.id));
    return tokens.accessToken;
  }
}

async function createRepurposePost(
  db: Db,
  wf: Workflow,
  opts: {
    title: string;
    caption: string;
    mediaUrl: string;
    mediaUrls?: string[];
    mediaType: string;
    sourceId: string;
  }
): Promise<boolean> {
  if (wf.contentType === "photos" && opts.mediaType === "video") return false;
  if (
    wf.contentType === "video" &&
    (opts.mediaType === "image" || opts.mediaType === "carousel")
  ) {
    return false;
  }

  const processed = getProcessedIds(wf.pollCursor);
  if (processed.has(opts.sourceId)) return false;

  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, wf.userId),
        eq(connectedAccounts.isActive, true)
      )
    );

  const targetAccounts = accounts.filter((a) =>
    wf.targetPlatforms.includes(a.platform)
  );

  if (targetAccounts.length === 0) return false;

  const [post] = await db
    .insert(posts)
    .values({
      userId: wf.userId,
      workflowId: wf.id,
      title: opts.title,
      caption: opts.caption,
      mediaUrl: opts.mediaUrls?.[0] ?? opts.mediaUrl,
      mediaUrls:
        opts.mediaUrls && opts.mediaUrls.length > 1 ? opts.mediaUrls : null,
      mediaType:
        opts.mediaUrls && opts.mediaUrls.length > 1
          ? "carousel"
          : opts.mediaType,
      status: "processing",
    })
    .returning();

  await db.insert(distributions).values(
    targetAccounts.map((account) => ({
      postId: post.id,
      accountId: account.id,
      platform: account.platform,
      caption: opts.caption,
      status: "processing" as const,
    }))
  );

  await executePublishForPost(db, post.id, wf.userId);

  await db
    .update(workflows)
    .set({
      pollCursor: withProcessedId(wf.pollCursor, opts.sourceId),
      lastPolledAt: new Date(),
    })
    .where(eq(workflows.id, wf.id));

  wf.pollCursor = withProcessedId(wf.pollCursor, opts.sourceId);

  return true;
}

async function pollInstagramWorkflow(db: Db, wf: Workflow): Promise<number> {
  const accountId = wf.sourceAccountId;
  if (!accountId) return 0;

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account?.accessToken) return 0;

  const igUserId = getInstagramUserId(account.accountId);
  if (!igUserId) return 0;

  const isExisting = wf.workflowType === "existing_content";
  const limit = isExisting
    ? EXISTING_CONTENT_FETCH_LIMIT
    : NEW_CONTENT_FETCH_LIMIT;

  const media = await fetchInstagramRecentMedia(
    account.accessToken,
    igUserId,
    limit
  );

  if (media.length === 0) return 0;

  const cursor = wf.pollCursor?.instagram;
  const processed = getProcessedIds(wf.pollCursor);
  const newCursor = media[0]?.id ?? cursor;
  let created = 0;

  if (!isExisting && !cursor) {
    await db
      .update(workflows)
      .set({
        pollCursor: { ...wf.pollCursor, instagram: newCursor },
        lastPolledAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));
    return 0;
  }

  let candidates = media.filter((m) => !processed.has(m.id));

  if (!isExisting && cursor) {
    candidates = media.filter((m) => {
      if (m.id === cursor) return false;
      const idx = media.findIndex((x) => x.id === cursor);
      if (idx === -1) return true;
      return media.findIndex((x) => x.id === m.id) < idx;
    });
  }

  if (isExisting) {
    candidates = [...candidates].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } else {
    candidates = [...candidates].reverse();
  }

  for (const item of candidates.slice(0, MAX_ITEMS_PER_POLL)) {
    const ok = await createRepurposePost(db, wf, {
      title: item.caption.slice(0, 80) || "Instagram Repurpose",
      caption: item.caption,
      mediaUrl: item.mediaUrl,
      mediaUrls: item.mediaUrls,
      mediaType: item.mediaType,
      sourceId: item.id,
    });
    if (ok) created++;
  }

  await db
    .update(workflows)
    .set({
      pollCursor: {
        ...wf.pollCursor,
        instagram: newCursor,
        processed: [...getProcessedIds(wf.pollCursor)],
      },
      lastPolledAt: new Date(),
    })
    .where(eq(workflows.id, wf.id));

  return created;
}

async function pollYouTubeWorkflow(db: Db, wf: Workflow): Promise<number> {
  const accountId = wf.sourceAccountId;
  if (!accountId) return 0;

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account?.accessToken || !account.accountId) return 0;

  const isExisting = wf.workflowType === "existing_content";
  const limit = isExisting
    ? EXISTING_CONTENT_FETCH_LIMIT
    : NEW_CONTENT_FETCH_LIMIT;

  const accessToken = await ensureYouTubeAccessToken(db, {
    id: account.id,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
  });

  const videos = await fetchYouTubeRecentUploads(
    accessToken,
    account.accountId,
    limit
  );

  if (videos.length === 0) return 0;

  const cursor = wf.pollCursor?.youtube;
  const processed = getProcessedIds(wf.pollCursor);
  const newCursor = videos[0]?.id ?? cursor;
  let created = 0;

  if (!isExisting && !cursor) {
    await db
      .update(workflows)
      .set({
        pollCursor: { ...wf.pollCursor, youtube: newCursor },
        lastPolledAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));
    return 0;
  }

  let candidates = videos.filter((v) => !processed.has(v.id));

  if (!isExisting && cursor) {
    candidates = videos.filter((v) => v.id !== cursor);
  }

  if (isExisting) {
    candidates = [...candidates].sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
  } else {
    candidates = [...candidates].reverse();
  }

  for (const video of candidates.slice(0, MAX_ITEMS_PER_POLL)) {
    try {
      const mediaUrl = await downloadYouTubeVideoForRepurpose(
        wf.userId,
        video.id
      );
      const ok = await createRepurposePost(db, wf, {
        title: video.title.slice(0, 100) || "YouTube Repurpose",
        caption: video.description || video.title,
        mediaUrl,
        mediaType: "video",
        sourceId: video.id,
      });
      if (ok) created++;
    } catch (err) {
      console.error(
        `[Repurpose] YouTube download failed for ${video.id}:`,
        err
      );
    }
  }

  await db
    .update(workflows)
    .set({
      pollCursor: {
        ...wf.pollCursor,
        youtube: newCursor,
        processed: [...getProcessedIds(wf.pollCursor)],
      },
      lastPolledAt: new Date(),
    })
    .where(eq(workflows.id, wf.id));

  return created;
}

async function pollFacebookWorkflow(db: Db, wf: Workflow): Promise<number> {
  const accountId = wf.sourceAccountId;
  if (!accountId) return 0;

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account?.accessToken || !account.accountId) return 0;

  const isExisting = wf.workflowType === "existing_content";
  const limit = isExisting
    ? EXISTING_CONTENT_FETCH_LIMIT
    : NEW_CONTENT_FETCH_LIMIT;

  const pageToken = await ensureFacebookPageToken(db, {
    id: account.id,
    accessToken: account.accessToken,
    accountId: account.accountId,
  });
  if (!pageToken) return 0;

  const media = await fetchFacebookRecentPosts(
    pageToken,
    account.accountId,
    limit
  );

  if (media.length === 0) return 0;

  const cursor = wf.pollCursor?.facebook;
  const newCursor = media[0]?.id ?? cursor;
  let created = 0;

  if (!isExisting && !cursor) {
    await db
      .update(workflows)
      .set({
        pollCursor: { ...wf.pollCursor, facebook: newCursor },
        lastPolledAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));
    return 0;
  }

  let candidates = media.filter((m) => !getProcessedIds(wf.pollCursor).has(m.id));

  if (!isExisting && cursor) {
    candidates = media.filter((m) => {
      if (m.id === cursor) return false;
      const idx = media.findIndex((x) => x.id === cursor);
      if (idx === -1) return true;
      return media.findIndex((x) => x.id === m.id) < idx;
    });
  }

  if (isExisting) {
    candidates = [...candidates].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } else {
    candidates = [...candidates].reverse();
  }

  for (const item of candidates.slice(0, MAX_ITEMS_PER_POLL)) {
    const ok = await createRepurposePost(db, wf, {
      title: item.caption.slice(0, 80) || "Facebook Repurpose",
      caption: item.caption,
      mediaUrl: item.mediaUrl,
      mediaUrls: item.mediaUrls,
      mediaType: item.mediaType,
      sourceId: item.id,
    });
    if (ok) created++;
  }

  await db
    .update(workflows)
    .set({
      pollCursor: {
        ...wf.pollCursor,
        facebook: newCursor,
        processed: [...getProcessedIds(wf.pollCursor)],
      },
      lastPolledAt: new Date(),
    })
    .where(eq(workflows.id, wf.id));

  return created;
}

async function pollTikTokWorkflow(db: Db, wf: Workflow): Promise<number> {
  const accountId = wf.sourceAccountId;
  if (!accountId) return 0;

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account?.accessToken) return 0;

  if (wf.contentType === "photos") return 0;

  const isExisting = wf.workflowType === "existing_content";
  const limit = isExisting
    ? EXISTING_CONTENT_FETCH_LIMIT
    : NEW_CONTENT_FETCH_LIMIT;

  const accessToken = await ensureTikTokAccessToken(db, {
    id: account.id,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
  });

  const videos = await fetchTikTokRecentVideos(accessToken, limit);
  if (videos.length === 0) return 0;

  const cursor = wf.pollCursor?.tiktok;
  const newCursor = videos[0]?.id ?? cursor;
  let created = 0;

  if (!isExisting && !cursor) {
    await db
      .update(workflows)
      .set({
        pollCursor: { ...wf.pollCursor, tiktok: newCursor },
        lastPolledAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));
    return 0;
  }

  let candidates = videos.filter((v) => !getProcessedIds(wf.pollCursor).has(v.id));

  if (!isExisting && cursor) {
    candidates = videos.filter((v) => v.id !== cursor);
  }

  if (isExisting) {
    candidates = [...candidates].sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
  } else {
    candidates = [...candidates].reverse();
  }

  for (const video of candidates.slice(0, MAX_ITEMS_PER_POLL)) {
    try {
      const mediaUrl = await downloadTikTokVideoForRepurpose(
        wf.userId,
        video.shareUrl
      );
      const ok = await createRepurposePost(db, wf, {
        title: video.title.slice(0, 100) || "TikTok Repurpose",
        caption: video.description || video.title,
        mediaUrl,
        mediaType: "video",
        sourceId: video.id,
      });
      if (ok) created++;
    } catch (err) {
      console.error(
        `[Repurpose] TikTok download failed for ${video.id}:`,
        err
      );
    }
  }

  await db
    .update(workflows)
    .set({
      pollCursor: {
        ...wf.pollCursor,
        tiktok: newCursor,
        processed: [...getProcessedIds(wf.pollCursor)],
      },
      lastPolledAt: new Date(),
    })
    .where(eq(workflows.id, wf.id));

  return created;
}

export async function pollRepurposeSources(db: Db): Promise<RepurposePollResult> {
  const active = await db
    .select()
    .from(workflows)
    .where(eq(workflows.isActive, true));

  let workflowsUpdated = 0;
  let postsCreated = 0;

  for (const wf of active) {
    if (!wf.sourcePlatform) continue;

    try {
      if (wf.sourcePlatform === "instagram") {
        postsCreated += await pollInstagramWorkflow(db, wf);
        workflowsUpdated++;
      } else if (wf.sourcePlatform === "youtube") {
        postsCreated += await pollYouTubeWorkflow(db, wf);
        workflowsUpdated++;
      } else if (wf.sourcePlatform === "facebook") {
        postsCreated += await pollFacebookWorkflow(db, wf);
        workflowsUpdated++;
      } else if (wf.sourcePlatform === "tiktok") {
        postsCreated += await pollTikTokWorkflow(db, wf);
        workflowsUpdated++;
      } else {
        await db
          .update(workflows)
          .set({ lastPolledAt: new Date() })
          .where(eq(workflows.id, wf.id));
        workflowsUpdated++;
      }
    } catch (err) {
      console.error(`[Repurpose] workflow ${wf.id} poll failed:`, err);
    }
  }

  return {
    workflowsChecked: active.length,
    workflowsUpdated,
    postsCreated,
  };
}
