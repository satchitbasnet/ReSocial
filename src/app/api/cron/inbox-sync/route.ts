import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { syncInboxForUser } from "@/lib/inbox/sync";
import { assertCronAuthorized } from "@/lib/cron-auth";

/** Hourly — sync inbox comments for users with connected accounts. */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const db = getDb();
  const rows = await db
    .selectDistinct({ userId: connectedAccounts.userId })
    .from(connectedAccounts)
    .limit(100);

  let totalMessages = 0;
  let usersSynced = 0;

  for (const row of rows) {
    try {
      const count = await syncInboxForUser(row.userId);
      totalMessages += count;
      usersSynced++;
    } catch (err) {
      console.error(`[Cron] inbox sync failed for ${row.userId}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    usersSynced,
    newMessages: totalMessages,
  });
}
