import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  inboxMessages,
  distributions,
  posts,
  connectedAccounts,
} from "@/lib/db/schema";
import type { PlatformId } from "@/lib/constants";
import {
  getInstagramUserId,
  isLegacyInstagramAccountId,
} from "@/lib/platforms/instagram";
import {
  fetchInstagramComments,
  fetchFacebookComments,
  fetchYouTubeComments,
  fetchInstagramTaggedMedia,
  fetchInstagramTaggedMediaFb,
  fetchInstagramDirectMessages,
  fetchInstagramPageDirectMessages,
  fetchFacebookPageDirectMessages,
  fetchFacebookPageMentions,
  resolvePageAccessToken,
  withYouTubeToken,
  type FetchedInboxMessage,
} from "@/lib/inbox/platforms";

async function insertInboxMessages(
  userId: string,
  accountId: string,
  platform: PlatformId,
  messages: FetchedInboxMessage[],
  link?: { postId: string; distributionId: string }
): Promise<number> {
  const db = getDb();
  let inserted = 0;

  for (const msg of messages) {
    const [existing] = await db
      .select({ id: inboxMessages.id })
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.userId, userId),
          eq(inboxMessages.platform, platform),
          eq(inboxMessages.platformMessageId, msg.platformMessageId)
        )
      )
      .limit(1);

    if (existing) continue;

    await db.insert(inboxMessages).values({
      userId,
      accountId,
      platform,
      platformMessageId: msg.platformMessageId,
      type: msg.type,
      authorName: msg.authorName,
      authorAvatar: msg.authorAvatar ?? null,
      content: msg.content,
      postId: link?.postId ?? null,
      distributionId: link?.distributionId ?? null,
      platformPostId: msg.platformPostId,
      replyTargetId: msg.replyTargetId ?? msg.platformMessageId,
      receivedAt: msg.receivedAt,
    });
    inserted++;
  }

  return inserted;
}

async function syncCommentInboxForUser(userId: string): Promise<number> {
  const db = getDb();
  let inserted = 0;

  const published = await db
    .select({
      distributionId: distributions.id,
      postId: distributions.postId,
      platform: distributions.platform,
      platformPostId: distributions.platformPostId,
      accountId: distributions.accountId,
      accessToken: connectedAccounts.accessToken,
      refreshToken: connectedAccounts.refreshToken,
      platformAccountId: connectedAccounts.accountId,
    })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .innerJoin(connectedAccounts, eq(distributions.accountId, connectedAccounts.id))
    .where(
      and(eq(posts.userId, userId), eq(distributions.status, "published"))
    );

  for (const row of published) {
    if (!row.platformPostId || !row.accessToken) continue;

    const platform = row.platform as PlatformId;
    if (!["instagram", "facebook", "youtube"].includes(platform)) continue;

    let messages: FetchedInboxMessage[] = [];

    try {
      if (platform === "instagram") {
        const pageToken = await resolvePageAccessToken(
          platform,
          row.accessToken,
          row.platformAccountId,
          row.refreshToken
        );
        if (!pageToken) continue;
        messages = await fetchInstagramComments(pageToken, row.platformPostId);
      } else if (platform === "facebook") {
        const pageToken = await resolvePageAccessToken(
          platform,
          row.accessToken,
          row.platformAccountId,
          null
        );
        if (!pageToken) continue;
        messages = await fetchFacebookComments(pageToken, row.platformPostId);
      } else if (platform === "youtube") {
        messages = await withYouTubeToken(
          row.accessToken,
          row.refreshToken,
          async (token) => {
            await db
              .update(connectedAccounts)
              .set({ accessToken: token })
              .where(eq(connectedAccounts.id, row.accountId));
          },
          (token) => fetchYouTubeComments(token, row.platformPostId!)
        );
      }
    } catch (err) {
      console.error(`[Inbox] Comment sync failed for ${platform}:`, err);
      continue;
    }

    inserted += await insertInboxMessages(userId, row.accountId, platform, messages, {
      postId: row.postId,
      distributionId: row.distributionId,
    });
  }

  return inserted;
}

async function syncAccountDirectInbox(
  userId: string,
  account: {
    id: string;
    platform: string;
    accessToken: string | null;
    refreshToken: string | null;
    accountId: string | null;
  }
): Promise<number> {
  if (!account.accessToken) return 0;

  const platform = account.platform as PlatformId;
  let messages: FetchedInboxMessage[] = [];

  try {
    if (platform === "instagram") {
      const igUserId = getInstagramUserId(account.accountId);
      if (!igUserId) return 0;

      if (isLegacyInstagramAccountId(account.accountId)) {
        const [, pageId] = account.accountId!.split(":");
        const pageToken = await resolvePageAccessToken(
          platform,
          account.accessToken,
          account.accountId,
          account.refreshToken
        );
        if (!pageToken || !pageId) return 0;

        const [tags, dms] = await Promise.all([
          fetchInstagramTaggedMediaFb(pageToken, igUserId).catch(() => []),
          fetchInstagramPageDirectMessages(pageToken, pageId).catch(() => []),
        ]);
        messages = [...tags, ...dms];
      } else {
        const [tags, dms] = await Promise.all([
          fetchInstagramTaggedMedia(account.accessToken, igUserId).catch(() => []),
          fetchInstagramDirectMessages(account.accessToken, igUserId).catch(
            () => []
          ),
        ]);
        messages = [...tags, ...dms];
      }
    } else if (platform === "facebook" && account.accountId) {
      const pageToken = await resolvePageAccessToken(
        platform,
        account.accessToken,
        account.accountId,
        null
      );
      if (!pageToken) return 0;

      const [dms, mentions] = await Promise.all([
        fetchFacebookPageDirectMessages(pageToken, account.accountId).catch(
          () => []
        ),
        fetchFacebookPageMentions(pageToken, account.accountId).catch(() => []),
      ]);
      messages = [...dms, ...mentions];
    }
  } catch (err) {
    console.error(`[Inbox] Direct sync failed for ${platform}:`, err);
    return 0;
  }

  return insertInboxMessages(userId, account.id, platform, messages);
}

export async function syncInboxForUser(userId: string): Promise<number> {
  const db = getDb();

  let inserted = await syncCommentInboxForUser(userId);

  const accounts = await db
    .select({
      id: connectedAccounts.id,
      platform: connectedAccounts.platform,
      accessToken: connectedAccounts.accessToken,
      refreshToken: connectedAccounts.refreshToken,
      accountId: connectedAccounts.accountId,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.isActive, true)
      )
    );

  for (const account of accounts) {
    if (account.platform === "instagram" || account.platform === "facebook") {
      inserted += await syncAccountDirectInbox(userId, account);
    }
  }

  return inserted;
}
