import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { trackedHashtags } from "@/lib/db/schema";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  await db
    .delete(trackedHashtags)
    .where(and(eq(trackedHashtags.id, id), eq(trackedHashtags.userId, session.userId)));

  return NextResponse.json({ success: true });
}
