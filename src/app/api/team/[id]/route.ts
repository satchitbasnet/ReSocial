import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { planHasTeamCollaboration } from "@/lib/plans";

const roleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasTeamCollaboration(session.plan)) {
    return NextResponse.json({ error: "Agency plan required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(teamMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(teamMembers.id, id), eq(teamMembers.ownerId, session.userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasTeamCollaboration(session.plan)) {
    return NextResponse.json({ error: "Agency plan required" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.id, id), eq(teamMembers.ownerId, session.userId)));

  return NextResponse.json({ success: true });
}
