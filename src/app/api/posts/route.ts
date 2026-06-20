import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  posts,
  distributions,
  connectedAccounts,
  users,
  postMetrics,
} from "@/lib/db/schema";
import { publishToPlatform } from "@/lib/platforms/publisher";
import type { PlatformId } from "@/lib/constants";
import { checkCanPublish, type UserPlan } from "@/lib/plans";
import { fullSyncForUser, syncPostMetrics } from "@/lib/analytics/sync";
import {
  clearMediaProcessCache,
  prepareMediaForPublish,
} from "@/lib/media/processor";
import { resolveWorkflowForPublish } from "@/lib/media/workflow";
import {
  backupToGoogleDrive,
  extensionFromMediaUrl,
  sanitizeBackupFilename,
} from "@/lib/integrations/google-drive";
import {
  incrementUsage,
  isOverFairUseCap,
} from "@/lib/usage/tracker";

const createPostSchema = z.object({
  title: z.string().min(1),
  caption: z.string().optional(),
  captions: z.record(z.string(), z.string()).optional(),
  mediaUrl: z.string().min(1),
  mediaType: z.string().default("video"),
  platformIds: z.array(z.string()).min(1),
  workflowId: z.string().uuid().optional(),
  scheduledAt: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const userPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.userId, session.userId))
      .orderBy(desc(posts.createdAt))
      .limit(50);

    const postsWithDistributions = await Promise.all(
      userPosts.map(async (post) => {
        const dists = await db
          .select({
            id: distributions.id,
            platform: distributions.platform,
            status: distributions.status,
            publishedAt: distributions.publishedAt,
            errorMessage: distributions.errorMessage,
            accountName: connectedAccounts.accountName,
          })
          .from(distributions)
          .leftJoin(
            connectedAccounts,
            eq(distributions.accountId, connectedAccounts.id)
          )
          .where(eq(distributions.postId, post.id));

        return { ...post, distributions: dists };
      })
    );

    return NextResponse.json({ posts: postsWithDistributions });
  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { title, caption, captions, mediaUrl, mediaType, platformIds, workflowId, scheduledAt } =
      parsed.data;

    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan === "trial" && user.videosPublished >= 10) {
      return NextResponse.json(
        {
          error: "Trial limit reached (10 videos). Please upgrade your plan.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const publishLimit = await checkCanPublish(
      session.userId,
      user.plan as UserPlan
    );
    if (publishLimit && !scheduledAt) {
      return NextResponse.json(publishLimit, { status: 403 });
    }

    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, session.userId));

    const targetAccounts = accounts.filter(
      (a) => platformIds.includes(a.platform) && a.isActive
    );

    if (targetAccounts.length === 0) {
      return NextResponse.json(
        { error: "No connected accounts for selected platforms. Connect accounts first." },
        { status: 400 }
      );
    }

    const workflow = await resolveWorkflowForPublish(
      db,
      session.userId,
      platformIds,
      workflowId
    );

    const [post] = await db
      .insert(posts)
      .values({
        userId: session.userId,
        workflowId: workflow?.id ?? workflowId ?? null,
        title,
        caption: caption || "",
        mediaUrl,
        mediaType,
        status: scheduledAt ? "scheduled" : "processing",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      })
      .returning();

    const distRecords = await db
      .insert(distributions)
      .values(
        targetAccounts.map((account) => ({
          postId: post.id,
          accountId: account.id,
          platform: account.platform,
          caption: captions?.[account.platform] || caption || "",
          status: scheduledAt ? ("pending" as const) : ("processing" as const),
        }))
      )
      .returning();

    // Publish asynchronously
    if (!scheduledAt) {
      clearMediaProcessCache();

      const processOptions =
        workflow &&
        (workflow.autoResize || workflow.removeWatermark) &&
        mediaType === "video"
          ? {
              autoResize: workflow.autoResize,
              removeWatermark: workflow.removeWatermark,
              sourcePlatform: workflow.sourcePlatform as PlatformId | null,
              mediaType,
            }
          : null;

      let publishSucceeded = false;

      await Promise.all(
        distRecords.map(async (dist) => {
          const account = targetAccounts.find((a) => a.id === dist.accountId)!;

          let publishMediaUrl = mediaUrl;
          let processedDowngraded = false;

          if (processOptions) {
            const overCap = await isOverFairUseCap(session.userId);

            if (overCap) {
              processedDowngraded = true;
            } else {
              try {
                const prepared = await prepareMediaForPublish(
                  mediaUrl,
                  account.platform as PlatformId,
                  session.userId,
                  processOptions
                );
                publishMediaUrl = prepared.url;
                if (prepared.didRunFfmpeg) {
                  await incrementUsage(session.userId, "processing");
                }
              } catch (procErr) {
                console.error(
                  `[ReSocial] Media processing failed for ${account.platform}:`,
                  procErr
                );
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
            dist.caption?.trim() || caption || title;

          const result = await publishToPlatform(
            {
              id: account.id,
              platform: account.platform as PlatformId,
              accountName: account.accountName,
              accessToken: account.accessToken,
              refreshToken: account.refreshToken,
              accountId: account.accountId,
            },
            publishMediaUrl,
            distCaption,
            async (accessToken, refreshToken) => {
              await db
                .update(connectedAccounts)
                .set({ accessToken, refreshToken })
                .where(eq(connectedAccounts.id, account.id));
            },
            title
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
          }

          if (result.success && result.metrics) {
            await db.insert(postMetrics).values({
              userId: session.userId,
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

      await db
        .update(posts)
        .set({ status: "published" })
        .where(eq(posts.id, post.id));

      await db
        .update(users)
        .set({ videosPublished: user.videosPublished + 1 })
        .where(eq(users.id, session.userId));

      await incrementUsage(session.userId, "post");

      fullSyncForUser(session.userId).catch((err) =>
        console.error("Post-publish analytics sync failed:", err)
      );

      if (publishSucceeded) {
        const ext = extensionFromMediaUrl(mediaUrl);
        const backupName = `${sanitizeBackupFilename(title)}.${ext}`;
        backupToGoogleDrive(session.userId, mediaUrl, backupName).catch((err) =>
          console.error("Google Drive backup failed:", err)
        );
      }
    }

    return NextResponse.json({ post, success: true });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
