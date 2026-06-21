import { eq, and, gte, sql } from "drizzle-orm";
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
  fetchYouTubeVideoStats,
  refreshYouTubeToken,
  fetchYouTubeChannelInfo,
} from "@/lib/platforms/youtube";
import { fetchInstagramMediaStats } from "@/lib/platforms/instagram";
import { fetchFacebookVideoStats, fetchFacebookPages } from "@/lib/platforms/facebook";
import {
  simulatePlatformMetrics,
  simulateNewFollowers,
} from "@/lib/analytics/metrics";
import type { PlatformId } from "@/lib/constants";
import { PLATFORMS } from "@/lib/constants";

const ACTIVE_PLATFORM_IDS = new Set(PLATFORMS.map((p) => p.id));

function isActivePlatform(platform: string): platform is PlatformId {
  return ACTIVE_PLATFORM_IDS.has(platform as PlatformId);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function syncPostMetrics(distributionId: string): Promise<void> {
  const db = getDb();

  const [row] = await db
    .select({
      distributionId: distributions.id,
      postId: distributions.postId,
      platform: distributions.platform,
      platformPostId: distributions.platformPostId,
      userId: posts.userId,
      accessToken: connectedAccounts.accessToken,
      refreshToken: connectedAccounts.refreshToken,
      platformAccountId: connectedAccounts.accountId,
      connectedAccountId: distributions.accountId,
    })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .innerJoin(connectedAccounts, eq(distributions.accountId, connectedAccounts.id))
    .where(
      and(
        eq(distributions.id, distributionId),
        eq(distributions.status, "published")
      )
    )
    .limit(1);

  if (!row?.platformPostId || !row.accessToken) return;

  let metrics = simulatePlatformMetrics(distributionId, row.platform);

  try {
    if (row.platform === "youtube" && row.refreshToken) {
      let token = row.accessToken;
      try {
        metrics = await fetchYouTubeVideoStats(token, row.platformPostId);
      } catch {
        const refreshed = await refreshYouTubeToken(row.refreshToken);
        token = refreshed.accessToken;
        await db
          .update(connectedAccounts)
          .set({ accessToken: token })
          .where(eq(connectedAccounts.id, row.connectedAccountId));
        metrics = await fetchYouTubeVideoStats(token, row.platformPostId);
      }
    } else if (row.platform === "instagram" && row.platformAccountId) {
      const userToken = row.accessToken;
      const pageToken =
        row.refreshToken ??
        (userToken
          ? await (async () => {
              const [, pageId] = row.platformAccountId!.split(":");
              const pages = await fetch(
                `https://graph.facebook.com/v18.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userToken)}`
              ).then((r) =>
                r.json() as Promise<{
                  data?: Array<{ id: string; access_token: string }>;
                }>
              );
              return pages.data?.find((p) => p.id === pageId)?.access_token;
            })()
          : undefined);

      if (pageToken && userToken) {
        metrics = await fetchInstagramMediaStats(
          userToken,
          row.platformPostId,
          pageToken
        );
      }
    } else if (row.platform === "facebook" && row.platformAccountId) {
      const pages = await fetchFacebookPages(row.accessToken);
      const page = pages.find((p) => p.pageId === row.platformAccountId);
      if (page) {
        metrics = await fetchFacebookVideoStats(
          page.pageAccessToken,
          row.platformPostId
        );
      }
    }
  } catch (err) {
    console.error(`syncPostMetrics failed for ${distributionId}:`, err);
  }

  const [existing] = await db
    .select({ id: postMetrics.id })
    .from(postMetrics)
    .where(eq(postMetrics.distributionId, distributionId))
    .limit(1);

  if (existing) {
    await db
      .update(postMetrics)
      .set({ ...metrics, syncedAt: new Date() })
      .where(eq(postMetrics.id, existing.id));
  } else {
    await db.insert(postMetrics).values({
      userId: row.userId,
      distributionId,
      postId: row.postId,
      platform: row.platform,
      ...metrics,
    });
  }
}

export async function syncFollowerSnapshot(accountId: string): Promise<void> {
  const db = getDb();

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account?.accessToken) return;

  let followerCount = 0;

  try {
    if (account.platform === "youtube") {
      const channel = await fetchYouTubeChannelInfo(account.accessToken);
      followerCount = channel.subscriberCount;
    } else if (account.platform === "instagram" && account.accountId) {
      const [igUserId] = account.accountId.split(":");
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${igUserId}?fields=followers_count&access_token=${encodeURIComponent(account.accessToken)}`
      );
      const body = await res.json();
      followerCount = body.followers_count ?? 0;
    } else if (account.platform === "facebook") {
      const pages = await fetchFacebookPages(account.accessToken);
      const page = pages.find((p) => p.pageId === account.accountId);
      followerCount = page?.followerCount ?? 0;
    }
  } catch (err) {
    console.error(`syncFollowerSnapshot failed for ${accountId}:`, err);
    return;
  }

  await db.insert(followerSnapshots).values({
    userId: account.userId,
    accountId: account.id,
    platform: account.platform,
    followerCount,
  });
}

export async function syncDailyStats(
  userId: string,
  platform: PlatformId,
  date: Date
): Promise<void> {
  const db = getDb();
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const metrics = await db
    .select()
    .from(postMetrics)
    .where(
      and(
        eq(postMetrics.userId, userId),
        eq(postMetrics.platform, platform),
        gte(postMetrics.syncedAt, dayStart),
        sql`${postMetrics.syncedAt} < ${dayEnd}`
      )
    );

  const views = metrics.reduce((s, m) => s + m.views, 0);
  const engagements = metrics.reduce(
    (s, m) => s + m.likes + m.comments + m.shares + m.saves,
    0
  );

  const [existing] = await db
    .select({ id: platformDailyStats.id })
    .from(platformDailyStats)
    .where(
      and(
        eq(platformDailyStats.userId, userId),
        eq(platformDailyStats.platform, platform),
        eq(platformDailyStats.statDate, dayStart)
      )
    )
    .limit(1);

  const values = {
    views,
    engagements,
    postsPublished: metrics.length,
    newFollowers: simulateNewFollowers(`${userId}:${platform}:${dayStart.toISOString()}`, platform),
  };

  if (existing) {
    await db
      .update(platformDailyStats)
      .set(values)
      .where(eq(platformDailyStats.id, existing.id));
  } else {
    await db.insert(platformDailyStats).values({
      userId,
      platform,
      statDate: dayStart,
      ...values,
    });
  }
}

export async function calculatePostingTimeInsights(
  userId: string,
  platform: PlatformId
): Promise<void> {
  const db = getDb();

  const rows = await db
    .select({
      publishedAt: distributions.publishedAt,
      engagementRate: postMetrics.engagementRate,
    })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .innerJoin(postMetrics, eq(postMetrics.distributionId, distributions.id))
    .where(
      and(
        eq(posts.userId, userId),
        eq(distributions.platform, platform),
        eq(distributions.status, "published"),
        sql`${distributions.publishedAt} IS NOT NULL`
      )
    );

  const buckets = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    if (!row.publishedAt) continue;
    const dow = row.publishedAt.getDay();
    const hour = row.publishedAt.getHours();
    const key = `${dow}:${hour}`;
    const b = buckets.get(key) ?? { total: 0, count: 0 };
    b.total += row.engagementRate;
    b.count += 1;
    buckets.set(key, b);
  }

  await db
    .delete(postingTimeInsights)
    .where(
      and(
        eq(postingTimeInsights.userId, userId),
        eq(postingTimeInsights.platform, platform)
      )
    );

  for (const [key, bucket] of buckets) {
    const [dowStr, hourStr] = key.split(":");
    await db.insert(postingTimeInsights).values({
      userId,
      platform,
      dayOfWeek: parseInt(dowStr, 10),
      hourOfDay: parseInt(hourStr, 10),
      avgEngagementRate: Math.round(bucket.total / bucket.count),
      sampleSize: bucket.count,
    });
  }
}

export async function fullSyncForUser(userId: string): Promise<void> {
  const db = getDb();

  const published = await db
    .select({ id: distributions.id })
    .from(distributions)
    .innerJoin(posts, eq(distributions.postId, posts.id))
    .where(
      and(eq(posts.userId, userId), eq(distributions.status, "published"))
    );

  for (const dist of published) {
    await syncPostMetrics(dist.id);
  }

  const accounts = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  for (const account of accounts) {
    await syncFollowerSnapshot(account.id);
  }

  const platforms = new Set<PlatformId>();
  const metrics = await db
    .select({ platform: postMetrics.platform, syncedAt: postMetrics.syncedAt })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId));

  for (const m of metrics) {
    if (!isActivePlatform(m.platform)) continue;
    platforms.add(m.platform);
    await syncDailyStats(userId, m.platform, m.syncedAt);
  }

  for (const platform of platforms) {
    await calculatePostingTimeInsights(userId, platform);
  }
}
