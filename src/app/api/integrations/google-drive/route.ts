import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { driveConnections } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [connection] = await db
    .select({
      accountEmail: driveConnections.accountEmail,
      connectedAt: driveConnections.connectedAt,
      isActive: driveConnections.isActive,
    })
    .from(driveConnections)
    .where(
      and(
        eq(driveConnections.userId, session.userId),
        eq(driveConnections.isActive, true)
      )
    )
    .limit(1);

  return NextResponse.json({
    connected: Boolean(connection),
    accountEmail: connection?.accountEmail ?? null,
    connectedAt: connection?.connectedAt?.toISOString() ?? null,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  await db
    .update(driveConnections)
    .set({ isActive: false })
    .where(eq(driveConnections.userId, session.userId));

  return NextResponse.json({ success: true });
}
