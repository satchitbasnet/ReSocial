import { eq, and, gte, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  postMetrics,
  platformDailyStats,
  posts,
} from "@/lib/db/schema";

export interface ReportData {
  totalViews: number;
  topPost: { title: string; views: number } | null;
  platformBreakdown: { platform: string; views: number; percentage: number }[];
  followerGrowth: number;
  bestDay: string | null;
}

export async function buildReportData(
  userId: string,
  days = 7
): Promise<ReportData> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const metrics = await db
    .select({
      views: sql<number>`coalesce(sum(${postMetrics.views}), 0)::int`,
    })
    .from(postMetrics)
    .where(
      and(eq(postMetrics.userId, userId), gte(postMetrics.syncedAt, since))
    );

  const byPlatform = await db
    .select({
      platform: postMetrics.platform,
      views: sql<number>`coalesce(sum(${postMetrics.views}), 0)::int`,
    })
    .from(postMetrics)
    .where(
      and(eq(postMetrics.userId, userId), gte(postMetrics.syncedAt, since))
    )
    .groupBy(postMetrics.platform);

  const totalViews = metrics[0]?.views ?? 0;

  const platformBreakdown = byPlatform.map((p) => ({
    platform: p.platform,
    views: p.views,
    percentage: totalViews > 0 ? Math.round((p.views / totalViews) * 100) : 0,
  }));

  const topPosts = await db
    .select({
      title: posts.title,
      views: postMetrics.views,
    })
    .from(postMetrics)
    .innerJoin(posts, eq(postMetrics.postId, posts.id))
    .where(
      and(eq(postMetrics.userId, userId), gte(postMetrics.syncedAt, since))
    )
    .orderBy(desc(postMetrics.views))
    .limit(1);

  const daily = await db
    .select({
      statDate: platformDailyStats.statDate,
      views: sql<number>`coalesce(sum(${platformDailyStats.views}), 0)::int`,
    })
    .from(platformDailyStats)
    .where(
      and(
        eq(platformDailyStats.userId, userId),
        gte(platformDailyStats.statDate, since)
      )
    )
    .groupBy(platformDailyStats.statDate)
    .orderBy(desc(sql`sum(${platformDailyStats.views})`))
    .limit(1);

  const followers = await db
    .select({
      growth: sql<number>`coalesce(sum(${platformDailyStats.newFollowers}), 0)::int`,
    })
    .from(platformDailyStats)
    .where(
      and(
        eq(platformDailyStats.userId, userId),
        gte(platformDailyStats.statDate, since)
      )
    );

  return {
    totalViews,
    topPost: topPosts[0]
      ? { title: topPosts[0].title, views: topPosts[0].views }
      : null,
    platformBreakdown,
    followerGrowth: followers[0]?.growth ?? 0,
    bestDay: daily[0]?.statDate
      ? new Date(daily[0].statDate).toLocaleDateString("en-US", {
          weekday: "long",
        })
      : null,
  };
}

export function renderReportHtml(data: ReportData, periodLabel: string) {
  const platformRows = data.platformBreakdown
    .map(
      (p) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;text-transform:capitalize">${p.platform}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${p.views.toLocaleString()}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${p.percentage}%</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h1 style="font-size:24px;margin-bottom:4px">ReSocial ${periodLabel} Report</h1>
      <p style="color:#666;margin-top:0">Your social performance summary</p>
      <div style="background:#f0f4ff;border-radius:12px;padding:20px;margin:24px 0">
        <p style="margin:0;font-size:14px;color:#4c6ef5">Total views</p>
        <p style="margin:4px 0 0;font-size:32px;font-weight:bold">${data.totalViews.toLocaleString()}</p>
      </div>
      ${
        data.topPost
          ? `<p><strong>Top post:</strong> ${data.topPost.title} (${data.topPost.views.toLocaleString()} views)</p>`
          : ""
      }
      <p><strong>Follower growth:</strong> +${data.followerGrowth.toLocaleString()}</p>
      ${data.bestDay ? `<p><strong>Best performing day:</strong> ${data.bestDay}</p>` : ""}
      <h3 style="margin-top:24px">Platform breakdown</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#666"><th style="padding:8px">Platform</th><th style="padding:8px;text-align:right">Views</th><th style="padding:8px;text-align:right">Share</th></tr></thead>
        <tbody>${platformRows || '<tr><td colspan="3" style="padding:8px;color:#999">No data yet</td></tr>'}</tbody>
      </table>
      <p style="margin-top:32px;font-size:12px;color:#999">Sent by ReSocial — Post once, reach everywhere.</p>
    </div>
  `;
}

export async function sendReportEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Reports] RESEND_API_KEY not set — skipping email send");
    return false;
  }

  const from = process.env.REPORT_FROM_EMAIL ?? "ReSocial <reports@resocial.app>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Reports] Resend error:", err);
    return false;
  }
  return true;
}
