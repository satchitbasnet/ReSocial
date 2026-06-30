import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  canReviewApprovals,
  resolvePublishContext,
} from "@/lib/team/publish-context";
import {
  listPendingApprovals,
  reviewApproval,
} from "@/lib/team/approvals";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ctx = await resolvePublishContext(session.userId, session.email);
    const canReview = await canReviewApprovals(
      session.userId,
      ctx.workspaceUserId
    );

    if (!canReview) {
      return NextResponse.json({ approvals: [], canReview: false });
    }

    const db = getDb();
    const approvals = await listPendingApprovals(db, ctx.workspaceUserId);
    return NextResponse.json({ approvals, canReview: true });
  } catch (error) {
    console.error("List approvals error:", error);
    return NextResponse.json(
      { error: "Failed to load approvals" },
      { status: 500 }
    );
  }
}

const reviewSchema = z.object({
  postId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const ctx = await resolvePublishContext(session.userId, session.email);
    const canReview = await canReviewApprovals(
      session.userId,
      ctx.workspaceUserId
    );

    if (!canReview) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getDb();
    const result = await reviewApproval(
      db,
      parsed.data.postId,
      session.userId,
      parsed.data.action,
      parsed.data.note
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Review approval error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Approval action failed",
      },
      { status: 500 }
    );
  }
}
