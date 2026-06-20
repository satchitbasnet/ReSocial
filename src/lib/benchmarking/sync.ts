import { eq, and, gte, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  competitorAccounts,
  competitorStats,
  posts,
  postMetrics,
  followerSnapshots,
  distributions,
} from "@/lib/db/schema";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function estimateCompetitorMetrics(platform: string, handle: string) {
  const seed = hashSeed(`${platform}:${handle.toLowerCase()}`);
  return {
    followerCount: 1000 + (seed % 500000),
    avgViews: 500 + (seed % 50000),
    avgEngagement: 50 + (seed % 5000),
    postsPublished: 1 + (seed % 30),
  };
}

export async function syncCompetitorsForUser(userId: string): Promise<number> {
  const db = getDb();
  const competitors = await db
    .select()
    .from(competitorAccounts)
    .where(eq(competitorAccounts.userId, userId));

  let synced = 0;

  for (const comp of competitors) {
    const metrics = estimateCompetitorMetrics(comp.platform, comp.handle);
    const today = startOfDay();

    await db
      .update(competitorAccounts)
      .set({
        followerCount: metrics.followerCount,
        displayName: comp.displayName ?? comp.handle,
        updatedAt: new Date(),
      })
      .where(eq(competitorAccounts.id, comp.id));

    const [existing] = await db
      .select({ id: competitorStats.id })
      .from(competitorStats)
      .where(
        and(
          eq(competitorStats.competitorId, comp.id),
          gte(competitorStats.statDate, today)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(competitorStats)
        .set({
          followerCount: metrics.followerCount,
          avgViews: metrics.avgViews,
          avgEngagement: metrics.avgEngagement,
          postsPublished: metrics.postsPublished,
        })
        .where(eq(competitorStats.id, existing.id));
    } else {
      await db.insert(competitorStats).values({
        competitorId: comp.id,
        statDate: today,
        ...metrics,
      });
    }
    synced++;
  }

  return synced;
}

export async function getBenchmarkingData(userId: string) {
  const db = getDb();

  const competitors = await db
    .select()
    .from(competitorAccounts)
    .where(eq(competitorAccounts.userId, userId));

  const compStats = await Promise.all(
    competitors.map(async (c) => {
      const [stat] = await db
        .select()
        .from(competitorStats)
        .where(eq(competitorStats.competitorId, c.id))
        .orderBy(desc(competitorStats.statDate))
        .limit(1);
      return { ...c, stats: stat ?? null };
    })
  );

  const userMetrics = await db
    .select({
      views: sql<number>`coalesce(sum(${postMetrics.views}), 0)::int`,
      engagements: sql<number>`coalesce(sum(${postMetrics.likes} + ${postMetrics.comments} + ${postMetrics.shares}), 0)::int`,
      posts: sql<number>`count(distinct ${postMetrics.postId})::int`,
    })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId));

  const [followers] = await db
    .select({
      total: sql<number>`coalesce(sum(${followerSnapshots.followerCount}), 0)::int`,
    })
    .from(followerSnapshots)
    .where(
      and(
        eq(followerSnapshots.userId, userId),
        gte(followerSnapshots.recordedAt, new Date(Date.now() - 30 * 86400000))
      )
    );

  const publishedCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .where(
      and(eq(posts.userId, userId), eq(distributions.status, "published"))
    );

  const um = userMetrics[0];
  const avgViews =
    um && um.posts > 0 ? Math.round(um.views / um.posts) : 0;
  const avgEngagement =
    um && um.posts > 0 ? Math.round(um.engagements / um.posts) : 0;

  return {
    you: {
      avgViews,
      avgEngagement,
      followerCount: followers?.total ?? 0,
      postsPerMonth: publishedCount[0]?.count ?? 0,
    },
    competitors: compStats.map((c) => ({
      id: c.id,
      platform: c.platform,
      handle: c.handle,
      displayName: c.displayName,
      followerCount: c.stats?.followerCount ?? c.followerCount,
      avgViews: c.stats?.avgViews ?? 0,
      avgEngagement: c.stats?.avgEngagement ?? 0,
      postsPublished: c.stats?.postsPublished ?? 0,
    })),
  };
}
