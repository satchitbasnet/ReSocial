import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inboxMessages } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.userId, session.userId),
          eq(inboxMessages.isRead, false)
        )
      );

    return NextResponse.json({ unread: row?.count ?? 0 });
  } catch {
    return NextResponse.json({ unread: 0 });
  }
}
