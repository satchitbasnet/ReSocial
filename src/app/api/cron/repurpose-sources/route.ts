import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pollRepurposeSources } from "@/lib/repurpose/source-poller";
import { assertCronAuthorized } from "@/lib/cron-auth";

/** Every 15 minutes — poll workflow sources for new content to repurpose. */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const result = await pollRepurposeSources(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron] repurpose-sources failed:", err);
    return NextResponse.json({ error: "Repurpose poll failed" }, { status: 500 });
  }
}
