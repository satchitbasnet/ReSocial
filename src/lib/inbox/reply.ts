import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { inboxMessages, connectedAccounts } from "@/lib/db/schema";
import type { PlatformId } from "@/lib/constants";
import {
  getInstagramUserId,
  isLegacyInstagramAccountId,
} from "@/lib/platforms/instagram";
import {
  replyInstagramComment,
  replyInstagramDirectMessage,
  commentOnInstagramMedia,
  replyFacebookComment,
  replyFacebookDirectMessage,
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
      type: inboxMessages.type,
      platform: inboxMessages.platform,
      platformMessageId: inboxMessages.platformMessageId,
      replyTargetId: inboxMessages.replyTargetId,
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

  const targetId = msg.replyTargetId ?? msg.platformMessageId;

  if (platform === "instagram") {
    const igUserId = getInstagramUserId(msg.platformAccountId);
    if (!igUserId) throw new Error("Instagram account ID missing");

    if (msg.type === "dm") {
      if (!targetId) {
        throw new Error("Cannot reply — missing sender ID. Re-sync inbox.");
      }
      await replyInstagramDirectMessage(
        igUserId,
        msg.accessToken!,
        targetId,
        text
      );
    } else if (msg.type === "mention") {
      const legacy = isLegacyInstagramAccountId(msg.platformAccountId);
      if (legacy) {
        const pageToken = await resolvePageAccessToken(
          platform,
          msg.accessToken!,
          msg.platformAccountId,
          msg.refreshToken
        );
        if (!pageToken) {
          throw new Error("Instagram token unavailable. Reconnect account.");
        }
        await commentOnInstagramMedia(pageToken, targetId, text, false);
      } else {
        await commentOnInstagramMedia(msg.accessToken!, targetId, text, true);
      }
    } else {
      const pageToken = await resolvePageAccessToken(
        platform,
        msg.accessToken!,
        msg.platformAccountId,
        msg.refreshToken
      );
      if (!pageToken) {
        throw new Error("Instagram token unavailable. Reconnect account.");
      }
      await replyInstagramComment(pageToken, msg.platformMessageId, text);
    }
  } else if (platform === "facebook") {
    const pageToken = await resolvePageAccessToken(
      platform,
      msg.accessToken!,
      msg.platformAccountId,
      null
    );
    if (!pageToken) {
      throw new Error("Facebook token unavailable. Reconnect account.");
    }

    if (msg.type === "dm") {
      if (!msg.platformAccountId || !targetId) {
        throw new Error("Cannot reply — missing conversation details. Re-sync inbox.");
      }
      await replyFacebookDirectMessage(
        msg.platformAccountId,
        pageToken,
        targetId,
        text
      );
    } else if (msg.type === "mention") {
      await replyFacebookComment(pageToken, targetId, text);
    } else {
      await replyFacebookComment(pageToken, msg.platformMessageId, text);
    }
  } else if (platform === "youtube") {
    if (!msg.accessToken) throw new Error("YouTube not connected");
    if (msg.type !== "comment") {
      throw new Error("YouTube only supports comment replies");
    }
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
