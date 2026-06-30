import { eq, and } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  workflows,
  connectedAccounts,
  posts,
  distributions,
  type Workflow,
} from "@/lib/db/schema";
import type { PlatformId } from "@/lib/constants";
import {
  fetchInstagramRecentMedia,
  getInstagramUserId,
} from "@/lib/platforms/instagram";
import { fetchYouTubeRecentUploads } from "@/lib/platforms/youtube";
import { executePublishForPost } from "@/lib/publish/execute-distributions";

export interface RepurposePollResult {
  workflowsChecked: number;
  workflowsUpdated: number;
  postsCreated: number;
}

async function createRepurposePost(
  db: Db,
  wf: Workflow,
  opts: {
    title: string;
    caption: string;
    mediaUrl: string;
    mediaType: string;
  }
): Promise<boolean> {
  if (wf.contentType === "photos" && opts.mediaType === "video") return false;
  if (wf.contentType === "video" && opts.mediaType === "image") return false;

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
      mediaUrl: opts.mediaUrl,
      mediaType: opts.mediaType,
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

  const media = await fetchInstagramRecentMedia(
    account.accessToken,
    igUserId,
    10
  );

  if (media.length === 0) return 0;

  const cursor = wf.pollCursor?.instagram;
  let created = 0;
  const newCursor = media[0]?.id ?? cursor;

  if (!cursor) {
    await db
      .update(workflows)
      .set({
        pollCursor: { ...wf.pollCursor, instagram: newCursor },
        lastPolledAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));
    return 0;
  }

  const newItems = media.filter((m) => {
    if (m.id === cursor) return false;
    const idx = media.findIndex((x) => x.id === cursor);
    if (idx === -1) return true;
    return media.findIndex((x) => x.id === m.id) < idx;
  });

  for (const item of newItems.reverse()) {
    const ok = await createRepurposePost(db, wf, {
      title: item.caption.slice(0, 80) || "Instagram Repurpose",
      caption: item.caption,
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
    });
    if (ok) created++;
  }

  await db
    .update(workflows)
    .set({
      pollCursor: { ...wf.pollCursor, instagram: newCursor },
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

  const videos = await fetchYouTubeRecentUploads(
    account.accessToken,
    account.accountId,
    5
  );

  if (videos.length === 0) return 0;

  const cursor = wf.pollCursor?.youtube;
  const newCursor = videos[0]?.id ?? cursor;

  if (!cursor) {
    await db
      .update(workflows)
      .set({
        pollCursor: { ...wf.pollCursor, youtube: newCursor },
        lastPolledAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));
    return 0;
  }

  // YouTube cross-post requires downloadable media — log new videos for now
  const newVideos = videos.filter((v) => v.id !== cursor);
  if (newVideos.length > 0) {
    console.log(
      `[Repurpose] YouTube workflow ${wf.id}: ${newVideos.length} new video(s) detected (download pipeline pending)`
    );
  }

  await db
    .update(workflows)
    .set({
      pollCursor: { ...wf.pollCursor, youtube: newCursor },
      lastPolledAt: new Date(),
    })
    .where(eq(workflows.id, wf.id));

  return 0;
}

export async function pollRepurposeSources(db: Db): Promise<RepurposePollResult> {
  const active = await db
    .select()
    .from(workflows)
    .where(
      and(eq(workflows.isActive, true), eq(workflows.workflowType, "new_content"))
    );

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
