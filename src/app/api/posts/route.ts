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
} from "@/lib/db/schema";
import { resolveWorkflowForPublish } from "@/lib/media/workflow";
import { executePublishForPost } from "@/lib/publish/execute-distributions";
import { checkCanPublish, type UserPlan } from "@/lib/plans";
import { resolvePublishContext } from "@/lib/team/publish-context";
import { createApprovalRequest } from "@/lib/team/approvals";

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
    const publishCtx = await resolvePublishContext(session.userId, session.email);
    const workspaceUserId = publishCtx.workspaceUserId;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, workspaceUserId))
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
      workspaceUserId,
      user.plan as UserPlan
    );
    if (publishLimit && !scheduledAt && !publishCtx.requiresApproval) {
      return NextResponse.json(publishLimit, { status: 403 });
    }

    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, workspaceUserId));

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
      workspaceUserId,
      platformIds,
      workflowId
    );

    const needsApproval = publishCtx.requiresApproval;
    const postStatus = needsApproval
      ? "pending_approval"
      : scheduledAt
        ? "scheduled"
        : "processing";

    const [post] = await db
      .insert(posts)
      .values({
        userId: workspaceUserId,
        workflowId: workflow?.id ?? workflowId ?? null,
        title,
        caption: caption || "",
        mediaUrl,
        mediaType,
        status: postStatus,
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
          status: needsApproval
            ? ("pending" as const)
            : scheduledAt
              ? ("pending" as const)
              : ("processing" as const),
        }))
      )
      .returning();

    if (needsApproval) {
      await createApprovalRequest(db, post.id, publishCtx.actorUserId);
    } else if (!scheduledAt) {
      await executePublishForPost(db, post.id, workspaceUserId);
    }

    return NextResponse.json({
      post,
      success: true,
      pendingApproval: needsApproval,
    });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
