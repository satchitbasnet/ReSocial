import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pollRepurposeSources } from "@/lib/repurpose/source-poller";

/** Every 15 minutes — poll workflow sources for new content to repurpose. */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const result = await pollRepurposeSources(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron] repurpose-sources failed:", err);
    return NextResponse.json({ error: "Repurpose poll failed" }, { status: 500 });
  }
}
