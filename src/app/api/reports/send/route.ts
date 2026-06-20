import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reportSchedules } from "@/lib/db/schema";
import {
  buildReportData,
  renderReportHtml,
  sendReportEmail,
} from "@/lib/reports/builder";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [schedule] = await db
    .select()
    .from(reportSchedules)
    .where(eq(reportSchedules.userId, session.userId))
    .limit(1);

  if (!schedule) {
    return NextResponse.json({ error: "No report schedule configured" }, { status: 404 });
  }

  const days = schedule.frequency === "weekly" ? 7 : 30;
  const data = await buildReportData(session.userId, days);
  const period = schedule.frequency === "weekly" ? "Weekly" : "Monthly";
  const html = renderReportHtml(data, period);
  const sent = await sendReportEmail(
    schedule.email,
    `Your ReSocial ${period} Report`,
    html
  );

  if (sent) {
    await db
      .update(reportSchedules)
      .set({ lastSentAt: new Date() })
      .where(eq(reportSchedules.id, schedule.id));
  }

  return NextResponse.json({ success: true, sent, preview: data });
}

/** Cron endpoint — call daily with CRON_SECRET header */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  const schedules = await db
    .select()
    .from(reportSchedules)
    .where(eq(reportSchedules.isActive, true));

  let sent = 0;
  for (const schedule of schedules) {
    const due =
      schedule.frequency === "weekly"
        ? schedule.dayOfWeek === dayOfWeek
        : schedule.dayOfMonth === dayOfMonth;

    if (!due) continue;

    if (schedule.lastSentAt) {
      const hoursSince =
        (now.getTime() - schedule.lastSentAt.getTime()) / 3600000;
      if (hoursSince < 20) continue;
    }

    const days = schedule.frequency === "weekly" ? 7 : 30;
    const data = await buildReportData(schedule.userId, days);
    const period = schedule.frequency === "weekly" ? "Weekly" : "Monthly";
    const html = renderReportHtml(data, period);
    const ok = await sendReportEmail(
      schedule.email,
      `Your ReSocial ${period} Report`,
      html
    );

    if (ok) {
      await db
        .update(reportSchedules)
        .set({ lastSentAt: now })
        .where(eq(reportSchedules.id, schedule.id));
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
