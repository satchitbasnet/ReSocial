import { NextResponse } from "next/server";
import { rollExpiredUsagePeriods } from "@/lib/usage/tracker";

/** Daily cron — sync Stripe billing periods and roll forward expired usage meters. */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rollExpiredUsagePeriods();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron] usage-reset failed:", err);
    return NextResponse.json({ error: "Usage reset failed" }, { status: 500 });
  }
}
