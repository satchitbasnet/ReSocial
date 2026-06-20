import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inboxMessages } from "@/lib/db/schema";
import { planHasTeamCollaboration } from "@/lib/plans";

const patchSchema = z.object({
  isRead: z.boolean().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (
      parsed.data.assignedToUserId !== undefined &&
      !planHasTeamCollaboration(session.plan)
    ) {
      return NextResponse.json(
        { error: "Team assignment requires Agency plan", upgradeRequired: true },
        { status: 403 }
      );
    }

    const db = getDb();
    const updates: Partial<typeof inboxMessages.$inferInsert> = {};

    if (parsed.data.isRead !== undefined) {
      updates.isRead = parsed.data.isRead;
    }
    if (parsed.data.assignedToUserId !== undefined) {
      updates.assignedToUserId = parsed.data.assignedToUserId;
    }

    const [updated] = await db
      .update(inboxMessages)
      .set(updates)
      .where(and(eq(inboxMessages.id, id), eq(inboxMessages.userId, session.userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({ message: updated });
  } catch (error) {
    console.error("Inbox patch error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
