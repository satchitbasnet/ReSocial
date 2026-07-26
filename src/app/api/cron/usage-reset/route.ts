import { NextResponse } from "next/server";
import { rollExpiredUsagePeriods } from "@/lib/usage/tracker";
import { assertCronAuthorized } from "@/lib/cron-auth";

/** Daily cron — sync Stripe billing periods and roll forward expired usage meters. */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const result = await rollExpiredUsagePeriods();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron] usage-reset failed:", err);
    return NextResponse.json({ error: "Usage reset failed" }, { status: 500 });
  }
}
