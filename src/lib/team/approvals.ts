import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { postApprovals, posts, distributions, connectedAccounts } from "@/lib/db/schema";
import { executePublishForPost } from "@/lib/publish/execute-distributions";

export async function createApprovalRequest(
  db: Db,
  postId: string,
  requestedBy: string
) {
  await db.insert(postApprovals).values({
    postId,
    requestedBy,
    status: "pending",
  });
}

export async function listPendingApprovals(db: Db, workspaceUserId: string) {
  const rows = await db
    .select({
      approvalId: postApprovals.id,
      postId: posts.id,
      title: posts.title,
      caption: posts.caption,
      mediaType: posts.mediaType,
      scheduledAt: posts.scheduledAt,
      createdAt: postApprovals.createdAt,
      requestedBy: postApprovals.requestedBy,
      note: postApprovals.note,
    })
    .from(postApprovals)
    .innerJoin(posts, eq(postApprovals.postId, posts.id))
    .where(
      and(
        eq(posts.userId, workspaceUserId),
        eq(postApprovals.status, "pending"),
        eq(posts.status, "pending_approval")
      )
    )
    .orderBy(desc(postApprovals.createdAt));

  const withTargets = await Promise.all(
    rows.map(async (row) => {
      const dists = await db
        .select({
          platform: distributions.platform,
          accountName: connectedAccounts.accountName,
        })
        .from(distributions)
        .leftJoin(
          connectedAccounts,
          eq(distributions.accountId, connectedAccounts.id)
        )
        .where(eq(distributions.postId, row.postId));
      return { ...row, distributions: dists };
    })
  );

  return withTargets;
}

export async function reviewApproval(
  db: Db,
  postId: string,
  reviewerId: string,
  action: "approve" | "reject",
  note?: string
) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post || post.status !== "pending_approval") {
    throw new Error("Post is not pending approval");
  }

  if (action === "reject") {
    await db
      .update(postApprovals)
      .set({ status: "rejected", reviewedBy: reviewerId, note })
      .where(
        and(eq(postApprovals.postId, postId), eq(postApprovals.status, "pending"))
      );
    await db.update(posts).set({ status: "failed" }).where(eq(posts.id, postId));
    return { published: false };
  }

  await db
    .update(postApprovals)
    .set({ status: "approved", reviewedBy: reviewerId, note })
    .where(
      and(eq(postApprovals.postId, postId), eq(postApprovals.status, "pending"))
    );

  if (post.scheduledAt && post.scheduledAt > new Date()) {
    await db
      .update(posts)
      .set({ status: "scheduled" })
      .where(eq(posts.id, postId));
    return { published: false, scheduled: true };
  }

  await executePublishForPost(db, postId, post.userId);
  return { published: true };
}
