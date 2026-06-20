import { eq, and, gte, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  posts,
  distributions,
  postMetrics,
} from "@/lib/db/schema";
import type { AnalyticsRange } from "@/lib/analytics/queries";

function rangeToDate(range: AnalyticsRange): Date {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface PlatformBreakdown {
  platform: string;
  distributionId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  publishedAt: string | null;
}

export interface PostPerformanceRow {
  postId: string;
  title: string;
  mediaUrl: string;
  mediaType: string;
  platforms: string[];
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
  publishedAt: string | null;
  breakdown: PlatformBreakdown[];
}

export async function getPostPerformanceComparison(
  userId: string,
  range: AnalyticsRange,
  platformFilter?: string
): Promise<PostPerformanceRow[]> {
  const db = getDb();
  const since = rangeToDate(range);

  const rows = await db
    .select({
      postId: posts.id,
      title: posts.title,
      mediaUrl: posts.mediaUrl,
      mediaType: posts.mediaType,
      distributionId: distributions.id,
      platform: distributions.platform,
      publishedAt: distributions.publishedAt,
      views: postMetrics.views,
      likes: postMetrics.likes,
      comments: postMetrics.comments,
      shares: postMetrics.shares,
      engagementRate: postMetrics.engagementRate,
    })
    .from(posts)
    .innerJoin(distributions, eq(distributions.postId, posts.id))
    .leftJoin(postMetrics, eq(postMetrics.distributionId, distributions.id))
    .where(
      and(
        eq(posts.userId, userId),
        eq(distributions.status, "published"),
        gte(distributions.publishedAt, since)
      )
    )
    .orderBy(desc(distributions.publishedAt));

  const byPost = new Map<string, PostPerformanceRow>();

  for (const row of rows) {
    if (platformFilter && row.platform !== platformFilter) continue;

    let entry = byPost.get(row.postId);
    if (!entry) {
      entry = {
        postId: row.postId,
        title: row.title,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType,
        platforms: [],
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        engagementRate: 0,
        publishedAt: null,
        breakdown: [],
      };
      byPost.set(row.postId, entry);
    }

    const views = row.views ?? 0;
    const likes = row.likes ?? 0;
    const comments = row.comments ?? 0;
    const shares = row.shares ?? 0;
    const engagementRate = (row.engagementRate ?? 0) / 100;

    if (!entry.platforms.includes(row.platform)) {
      entry.platforms.push(row.platform);
    }

    entry.breakdown.push({
      platform: row.platform,
      distributionId: row.distributionId,
      views,
      likes,
      comments,
      shares,
      engagementRate,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    });

    entry.totalViews += views;
    entry.totalLikes += likes;
    entry.totalComments += comments;
    entry.totalShares += shares;

    const publishedIso = row.publishedAt?.toISOString() ?? null;
    if (
      publishedIso &&
      (!entry.publishedAt || publishedIso > entry.publishedAt)
    ) {
      entry.publishedAt = publishedIso;
    }
  }

  return Array.from(byPost.values()).map((entry) => {
    const engagements =
      entry.totalLikes + entry.totalComments + entry.totalShares;
    const engagementRate =
      entry.totalViews > 0
        ? Math.round((engagements / entry.totalViews) * 10000) / 100
        : entry.breakdown.length > 0
          ? entry.breakdown.reduce((s, b) => s + b.engagementRate, 0) /
            entry.breakdown.length
          : 0;
    return { ...entry, engagementRate };
  });
}
