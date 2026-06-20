import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";

const rescheduleSchema = z.object({
  scheduledAt: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const scheduledDate = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    if (scheduledDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.userId, session.userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!["scheduled", "draft"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Only scheduled or draft posts can be rescheduled" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(posts)
      .set({
        scheduledAt: scheduledDate,
        status: "scheduled",
      })
      .where(eq(posts.id, id))
      .returning();

    return NextResponse.json({ post: updated });
  } catch (error) {
    console.error("Reschedule post error:", error);
    return NextResponse.json({ error: "Failed to reschedule post" }, { status: 500 });
  }
}
