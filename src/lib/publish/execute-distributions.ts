import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  posts,
  distributions,
  connectedAccounts,
  users,
  postMetrics,
  workflows,
  type Workflow,
} from "@/lib/db/schema";
import { publishToPlatform } from "@/lib/platforms/publisher";
import type { PlatformId } from "@/lib/constants";
import { fullSyncForUser, syncPostMetrics } from "@/lib/analytics/sync";
import {
  clearMediaProcessCache,
  prepareMediaForPublish,
} from "@/lib/media/processor";
import {
  backupToGoogleDrive,
  extensionFromMediaUrl,
  sanitizeBackupFilename,
} from "@/lib/integrations/google-drive";
import { incrementUsage, isOverFairUseCap } from "@/lib/usage/tracker";

export interface PublishPostResult {
  publishSucceeded: boolean;
  publishedCount: number;
  failedCount: number;
}

export async function executePublishForPost(
  db: Db,
  postId: string,
  userId: string
): Promise<PublishPostResult> {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post || post.userId !== userId) {
    throw new Error("Post not found");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  let workflow: Workflow | null = null;
  if (post.workflowId) {
    const [wf] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, post.workflowId))
      .limit(1);
    workflow = wf ?? null;
  }

  const distRecords = await db
    .select()
    .from(distributions)
    .where(eq(distributions.postId, postId));

  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  const targetAccounts = accounts.filter((a) =>
    distRecords.some((d) => d.accountId === a.id)
  );

  if (targetAccounts.length === 0) {
    throw new Error("No connected accounts for this post");
  }

  await db
    .update(posts)
    .set({ status: "processing" })
    .where(eq(posts.id, postId));

  clearMediaProcessCache();

  const processOptions =
    workflow &&
    (workflow.autoResize || workflow.removeWatermark) &&
    post.mediaType === "video"
      ? {
          autoResize: workflow.autoResize,
          removeWatermark: workflow.removeWatermark,
          sourcePlatform: workflow.sourcePlatform as PlatformId | null,
          mediaType: post.mediaType,
        }
      : null;

  let publishSucceeded = false;
  let publishedCount = 0;
  let failedCount = 0;

  await Promise.all(
    distRecords.map(async (dist) => {
      if (dist.status === "published") {
        publishedCount++;
        publishSucceeded = true;
        return;
      }

      const account = targetAccounts.find((a) => a.id === dist.accountId);
      if (!account) {
        failedCount++;
        await db
          .update(distributions)
          .set({
            status: "failed",
            errorMessage: "Connected account removed",
          })
          .where(eq(distributions.id, dist.id));
        return;
      }

      await db
        .update(distributions)
        .set({ status: "processing" })
        .where(eq(distributions.id, dist.id));

      let publishMediaUrl = post.mediaUrl;
      let processedDowngraded = false;

      if (processOptions) {
        const overCap = await isOverFairUseCap(userId);

        if (overCap) {
          processedDowngraded = true;
        } else {
          try {
            const prepared = await prepareMediaForPublish(
              post.mediaUrl,
              account.platform as PlatformId,
              userId,
              processOptions
            );
            publishMediaUrl = prepared.url;
            if (prepared.didRunFfmpeg) {
              await incrementUsage(userId, "processing");
            }
          } catch (procErr) {
            console.error(
              `[ReSocial] Media processing failed for ${account.platform}:`,
              procErr
            );
            failedCount++;
            await db
              .update(distributions)
              .set({
                status: "failed",
                errorMessage:
                  procErr instanceof Error
                    ? procErr.message
                    : "Media processing failed",
              })
              .where(eq(distributions.id, dist.id));
            return;
          }
        }
      }

      const distCaption =
        dist.caption?.trim() || post.caption || post.title;

      const result = await publishToPlatform(
        {
          id: account.id,
          platform: account.platform as PlatformId,
          accountName: account.accountName,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          accountId: account.accountId,
          oauthScopes: account.oauthScopes,
        },
        publishMediaUrl,
        distCaption,
        async (accessToken, refreshToken) => {
          await db
            .update(connectedAccounts)
            .set({ accessToken, refreshToken })
            .where(eq(connectedAccounts.id, account.id));
        },
        post.title
      );

      await db
        .update(distributions)
        .set({
          status: result.success ? "published" : "failed",
          platformPostId: result.platformPostId,
          errorMessage: result.error,
          processedDowngraded,
          publishedAt: result.success ? new Date() : null,
        })
        .where(eq(distributions.id, dist.id));

      if (result.success) {
        publishSucceeded = true;
        publishedCount++;
      } else {
        failedCount++;
      }

      if (result.success && result.metrics) {
        await db.insert(postMetrics).values({
          userId,
          distributionId: dist.id,
          postId: post.id,
          platform: account.platform,
          views: result.metrics.views,
          likes: result.metrics.likes,
          comments: result.metrics.comments,
          shares: result.metrics.shares,
          saves: result.metrics.saves,
          engagementRate: result.metrics.engagementRate,
        });
      } else if (
        result.success &&
        (account.platform === "youtube" || account.platform === "instagram")
      ) {
        syncPostMetrics(dist.id).catch((err) =>
          console.error(`${account.platform} metrics sync failed:`, err)
        );
      }
    })
  );

  const finalStatus =
    publishedCount > 0 && failedCount === 0
      ? "published"
      : publishedCount > 0
        ? "published"
        : "failed";

  await db
    .update(posts)
    .set({ status: finalStatus })
    .where(eq(posts.id, postId));

  if (publishSucceeded) {
    await db
      .update(users)
      .set({ videosPublished: user.videosPublished + 1 })
      .where(eq(users.id, userId));

    await incrementUsage(userId, "post");

    fullSyncForUser(userId).catch((err) =>
      console.error("Post-publish analytics sync failed:", err)
    );

    const ext = extensionFromMediaUrl(post.mediaUrl);
    const backupName = `${sanitizeBackupFilename(post.title)}.${ext}`;
    backupToGoogleDrive(userId, post.mediaUrl, backupName).catch((err) =>
      console.error("Google Drive backup failed:", err)
    );
  }

  return { publishSucceeded, publishedCount, failedCount };
}
