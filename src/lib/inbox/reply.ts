import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { inboxMessages, connectedAccounts } from "@/lib/db/schema";
import type { PlatformId } from "@/lib/constants";
import {
  replyInstagramComment,
  replyFacebookComment,
  replyYouTubeComment,
  resolvePageAccessToken,
  withYouTubeToken,
} from "@/lib/inbox/platforms";

export async function sendInboxReply(
  userId: string,
  messageId: string,
  replyText: string
): Promise<void> {
  const db = getDb();

  const [msg] = await db
    .select({
      id: inboxMessages.id,
      platform: inboxMessages.platform,
      platformMessageId: inboxMessages.platformMessageId,
      accountId: inboxMessages.accountId,
      accessToken: connectedAccounts.accessToken,
      refreshToken: connectedAccounts.refreshToken,
      platformAccountId: connectedAccounts.accountId,
    })
    .from(inboxMessages)
    .innerJoin(connectedAccounts, eq(inboxMessages.accountId, connectedAccounts.id))
    .where(and(eq(inboxMessages.id, messageId), eq(inboxMessages.userId, userId)))
    .limit(1);

  if (!msg) {
    throw new Error("Message not found");
  }

  const platform = msg.platform as PlatformId;
  const text = replyText.trim();
  if (!text) throw new Error("Reply cannot be empty");

  if (platform === "instagram") {
    const pageToken = await resolvePageAccessToken(
      platform,
      msg.accessToken!,
      msg.platformAccountId,
      msg.refreshToken
    );
    if (!pageToken) throw new Error("Instagram token unavailable. Reconnect account.");
    await replyInstagramComment(pageToken, msg.platformMessageId, text);
  } else if (platform === "facebook") {
    const pageToken = await resolvePageAccessToken(
      platform,
      msg.accessToken!,
      msg.platformAccountId,
      null
    );
    if (!pageToken) throw new Error("Facebook token unavailable. Reconnect account.");
    await replyFacebookComment(pageToken, msg.platformMessageId, text);
  } else if (platform === "youtube") {
    if (!msg.accessToken) throw new Error("YouTube not connected");
    await withYouTubeToken(
      msg.accessToken,
      msg.refreshToken,
      async (token) => {
        await db
          .update(connectedAccounts)
          .set({ accessToken: token })
          .where(eq(connectedAccounts.id, msg.accountId));
      },
      async (token) => {
        await replyYouTubeComment(token, msg.platformMessageId, text);
      }
    );
  } else {
    throw new Error(`Replies not supported for ${platform} yet`);
  }

  await db
    .update(inboxMessages)
    .set({ isReplied: true, isRead: true, repliedAt: new Date() })
    .where(eq(inboxMessages.id, messageId));
}
