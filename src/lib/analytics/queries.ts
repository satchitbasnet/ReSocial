import { eq, and, gte, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  distributions,
  posts,
  connectedAccounts,
  postMetrics,
  platformDailyStats,
  followerSnapshots,
  postingTimeInsights,
} from "@/lib/db/schema";
import {
  simulatePlatformMetrics,
  simulateNewFollowers,
  simulateFollowerCount,
} from "@/lib/analytics/metrics";
import type { PlatformId } from "@/lib/constants";

export type AnalyticsRange = "7d" | "30d" | "90d";

function rangeToDate(range: AnalyticsRange): Date {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Sync metrics from published distributions (simulates platform API pull). */
export async function syncAnalyticsForUser(userId: string): Promise<void> {
  const db = getDb();

  const published = await db
    .select({
      distributionId: distributions.id,
      postId: distributions.postId,
      platform: distributions.platform,
      publishedAt: distributions.publishedAt,
      title: posts.title,
      accountId: distributions.accountId,
    })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .where(
      and(eq(posts.userId, userId), eq(distributions.status, "published"))
    );

  const existing = await db
    .select({ distributionId: postMetrics.distributionId })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId));

  const existingSet = new Set(existing.map((e) => e.distributionId));

  for (const row of published) {
    if (existingSet.has(row.distributionId)) continue;

    const metrics = simulatePlatformMetrics(
      row.distributionId,
      row.platform
    );

    await db.insert(postMetrics).values({
      userId,
      distributionId: row.distributionId,
      postId: row.postId,
      platform: row.platform,
      ...metrics,
    });
  }

  // Rebuild daily rollups for user
  await db
    .delete(platformDailyStats)
    .where(eq(platformDailyStats.userId, userId));

  const allMetrics = await db
    .select({
      platform: postMetrics.platform,
      views: postMetrics.views,
      likes: postMetrics.likes,
      comments: postMetrics.comments,
      shares: postMetrics.shares,
      saves: postMetrics.saves,
      syncedAt: postMetrics.syncedAt,
      distributionId: postMetrics.distributionId,
    })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId));

  const dailyMap = new Map<
    string,
    { views: number; engagements: number; posts: number }
  >();

  for (const m of allMetrics) {
    const dateKey = startOfDay(m.syncedAt).toISOString();
    const key = `${m.platform}|${dateKey}`;
    const cur = dailyMap.get(key) ?? { views: 0, engagements: 0, posts: 0 };
    cur.views += m.views;
    cur.engagements += m.likes + m.comments + m.shares + m.saves;
    cur.posts += 1;
    dailyMap.set(key, cur);
  }

  for (const [key, val] of dailyMap) {
    const [platform, dateIso] = key.split("|");
    await db.insert(platformDailyStats).values({
      userId,
      platform: platform as PlatformId,
      statDate: new Date(dateIso),
      views: val.views,
      engagements: val.engagements,
      postsPublished: val.posts,
      newFollowers: simulateNewFollowers(`${userId}:${platform}`, platform),
    });
  }

  // Follower snapshots
  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  const recentSnapshots = await db
    .select()
    .from(followerSnapshots)
    .where(eq(followerSnapshots.userId, userId))
    .orderBy(desc(followerSnapshots.recordedAt))
    .limit(accounts.length);

  if (recentSnapshots.length < accounts.length) {
    for (const account of accounts) {
      const hasSnapshot = recentSnapshots.some(
        (s) => s.accountId === account.id
      );
      if (!hasSnapshot) {
        await db.insert(followerSnapshots).values({
          userId,
          accountId: account.id,
          platform: account.platform,
          followerCount: simulateFollowerCount(account.id),
        });
      }
    }
  }

  // Posting time insights from published distributions
  await db
    .delete(postingTimeInsights)
    .where(eq(postingTimeInsights.userId, userId));

  const publishedWithTime = await db
    .select({
      platform: distributions.platform,
      publishedAt: distributions.publishedAt,
      distributionId: distributions.id,
    })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .where(
      and(
        eq(posts.userId, userId),
        eq(distributions.status, "published"),
        sql`${distributions.publishedAt} IS NOT NULL`
      )
    );

  const timeBuckets = new Map<
    string,
    { totalRate: number; count: number }
  >();

  for (const row of publishedWithTime) {
    if (!row.publishedAt) continue;
    const dow = row.publishedAt.getDay();
    const hour = row.publishedAt.getHours();
    const key = `${row.platform}:${dow}:${hour}`;
    const m = simulatePlatformMetrics(row.distributionId, row.platform);
    const bucket = timeBuckets.get(key) ?? { totalRate: 0, count: 0 };
    bucket.totalRate += m.engagementRate;
    bucket.count += 1;
    timeBuckets.set(key, bucket);
  }

  for (const [key, bucket] of timeBuckets) {
    const [platform, dowStr, hourStr] = key.split(":");
    await db.insert(postingTimeInsights).values({
      userId,
      platform: platform as PlatformId,
      dayOfWeek: parseInt(dowStr, 10),
      hourOfDay: parseInt(hourStr, 10),
      avgEngagementRate: Math.round(bucket.totalRate / bucket.count),
      sampleSize: bucket.count,
    });
  }
}

export interface AnalyticsSummary {
  totalViews: number;
  engagementRate: number;
  newFollowers: number;
  postsPublished: number;
}

export interface SummaryChange {
  totalViews: number;
  engagementRate: number;
  newFollowers: number;
  postsPublished: number;
}

export interface PlatformViews {
  platform: string;
  views: number;
  percentage: number;
}

export interface TopPost {
  postId: string;
  title: string;
  platform: string;
  views: number;
  engagementRate: number;
  likes: number;
  mediaUrl?: string;
  publishedAt?: string;
}

export interface BestTimeSlot {
  platform: string;
  dayOfWeek: number;
  hourOfDay: number;
  avgEngagementRate: number;
  sampleSize: number;
}

export interface AnalyticsDashboard {
  summary: AnalyticsSummary;
  previousSummary: AnalyticsSummary;
  summaryChange: SummaryChange;
  viewsByPlatform: PlatformViews[];
  topPosts: TopPost[];
  bestTimeToPost: BestTimeSlot[];
  range: AnalyticsRange;
  lastSyncedAt: string | null;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function rangeToDays(range: AnalyticsRange): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

async function computeSummaryForRange(
  userId: string,
  since: Date,
  until?: Date
): Promise<AnalyticsSummary> {
  const db = getDb();

  const metrics = await db
    .select()
    .from(postMetrics)
    .where(
      until
        ? and(
            eq(postMetrics.userId, userId),
            gte(postMetrics.syncedAt, since),
            sql`${postMetrics.syncedAt} < ${until}`
          )
        : and(eq(postMetrics.userId, userId), gte(postMetrics.syncedAt, since))
    );

  const dailyStats = await db
    .select()
    .from(platformDailyStats)
    .where(
      until
        ? and(
            eq(platformDailyStats.userId, userId),
            gte(platformDailyStats.statDate, since),
            sql`${platformDailyStats.statDate} < ${until}`
          )
        : and(
            eq(platformDailyStats.userId, userId),
            gte(platformDailyStats.statDate, since)
          )
    );

  const totalViews = metrics.reduce((s, m) => s + m.views, 0);
  const totalEngagements = metrics.reduce(
    (s, m) => s + m.likes + m.comments + m.shares + m.saves,
    0
  );
  const engagementRate =
    totalViews > 0
      ? Math.round((totalEngagements / totalViews) * 10000) / 100
      : 0;

  return {
    totalViews,
    engagementRate,
    newFollowers: dailyStats.reduce((s, d) => s + d.newFollowers, 0),
    postsPublished: metrics.length,
  };
}

export async function getAnalyticsDashboard(
  userId: string,
  range: AnalyticsRange
): Promise<AnalyticsDashboard> {
  const db = getDb();
  const since = rangeToDate(range);
  const days = rangeToDays(range);
  const previousUntil = new Date(since);
  const previousSince = new Date(since);
  previousSince.setDate(previousSince.getDate() - days);

  const metricCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId));

  if ((metricCount[0]?.count ?? 0) === 0) {
    await syncAnalyticsForUser(userId);
  }

  const summary = await computeSummaryForRange(userId, since);
  const previousSummary = await computeSummaryForRange(
    userId,
    previousSince,
    previousUntil
  );

  const summaryChange: SummaryChange = {
    totalViews: pctChange(summary.totalViews, previousSummary.totalViews),
    engagementRate: pctChange(
      summary.engagementRate,
      previousSummary.engagementRate
    ),
    newFollowers: pctChange(
      summary.newFollowers,
      previousSummary.newFollowers
    ),
    postsPublished: pctChange(
      summary.postsPublished,
      previousSummary.postsPublished
    ),
  };

  const metrics = await db
    .select()
    .from(postMetrics)
    .where(
      and(eq(postMetrics.userId, userId), gte(postMetrics.syncedAt, since))
    );

  const platformViewsMap = new Map<string, number>();
  for (const m of metrics) {
    platformViewsMap.set(
      m.platform,
      (platformViewsMap.get(m.platform) ?? 0) + m.views
    );
  }

  const totalViews = summary.totalViews;

  const viewsByPlatform: PlatformViews[] = Array.from(
    platformViewsMap.entries()
  )
    .map(([platform, views]) => ({
      platform,
      views,
      percentage:
        totalViews > 0 ? Math.round((views / totalViews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.views - a.views);

  const postIds = [...new Set(metrics.map((m) => m.postId))];
  const postRows =
    postIds.length > 0
      ? await db
          .select({
            id: posts.id,
            title: posts.title,
            mediaUrl: posts.mediaUrl,
          })
          .from(posts)
          .where(inArray(posts.id, postIds))
      : [];

  const titleMap = new Map(postRows.map((p) => [p.id, p.title]));
  const mediaMap = new Map(postRows.map((p) => [p.id, p.mediaUrl]));

  const distRows =
    postIds.length > 0
      ? await db
          .select({
            postId: distributions.postId,
            platform: distributions.platform,
            publishedAt: distributions.publishedAt,
          })
          .from(distributions)
          .where(
            and(
              inArray(distributions.postId, postIds),
              eq(distributions.status, "published")
            )
          )
      : [];

  const publishedMap = new Map<string, Date | null>();
  for (const d of distRows) {
    if (!publishedMap.has(`${d.postId}:${d.platform}`)) {
      publishedMap.set(`${d.postId}:${d.platform}`, d.publishedAt);
    }
  }

  const topPosts: TopPost[] = [...metrics]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((m) => ({
      postId: m.postId,
      title: titleMap.get(m.postId) ?? "Untitled",
      platform: m.platform,
      views: m.views,
      engagementRate: m.engagementRate / 100,
      likes: m.likes,
      mediaUrl: mediaMap.get(m.postId),
      publishedAt:
        publishedMap.get(`${m.postId}:${m.platform}`)?.toISOString() ??
        m.syncedAt.toISOString(),
    }));

  const insights = await db
    .select()
    .from(postingTimeInsights)
    .where(eq(postingTimeInsights.userId, userId))
    .orderBy(desc(postingTimeInsights.avgEngagementRate));

  const bestByPlatform = new Map<string, BestTimeSlot>();
  for (const ins of insights) {
    if (!bestByPlatform.has(ins.platform)) {
      bestByPlatform.set(ins.platform, {
        platform: ins.platform,
        dayOfWeek: ins.dayOfWeek,
        hourOfDay: ins.hourOfDay,
        avgEngagementRate: ins.avgEngagementRate / 100,
        sampleSize: ins.sampleSize,
      });
    }
  }

  const lastMetric = await db
    .select({ syncedAt: postMetrics.syncedAt })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId))
    .orderBy(desc(postMetrics.syncedAt))
    .limit(1);

  return {
    summary,
    previousSummary,
    summaryChange,
    viewsByPlatform,
    topPosts,
    bestTimeToPost: Array.from(bestByPlatform.values()),
    range,
    lastSyncedAt: lastMetric[0]?.syncedAt?.toISOString() ?? null,
  };
}

export function planHasBestTimeInsight(plan: string): boolean {
  return ["pro", "agency"].includes(plan);
}
