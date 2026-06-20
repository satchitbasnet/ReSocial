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
  fetchInstagramComments,
  fetchFacebookComments,
  fetchYouTubeComments,
  resolvePageAccessToken,
  withYouTubeToken,
} from "@/lib/inbox/platforms";

export async function syncInboxForUser(userId: string): Promise<number> {
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

    let messages: Awaited<ReturnType<typeof fetchInstagramComments>> = [];

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
      console.error(`[Inbox] Sync failed for ${platform}:`, err);
      continue;
    }

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
        accountId: row.accountId,
        platform,
        platformMessageId: msg.platformMessageId,
        type: msg.type,
        authorName: msg.authorName,
        authorAvatar: msg.authorAvatar ?? null,
        content: msg.content,
        postId: row.postId,
        distributionId: row.distributionId,
        platformPostId: msg.platformPostId,
        receivedAt: msg.receivedAt,
      });
      inserted++;
    }
  }

  return inserted;
}
