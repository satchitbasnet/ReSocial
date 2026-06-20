import { eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  trackedHashtags,
  hashtagStats,
  connectedAccounts,
} from "@/lib/db/schema";
import {
  estimateTikTokHashtagStats,
  fetchInstagramHashtagStats,
  resolveInstagramContext,
} from "@/lib/listening/hashtags";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function syncHashtagsForUser(userId: string): Promise<number> {
  const db = getDb();
  const tags = await db
    .select()
    .from(trackedHashtags)
    .where(eq(trackedHashtags.userId, userId));

  let synced = 0;
  const today = startOfDay();

  for (const tag of tags) {
    let result;
    try {
      if (tag.platform === "instagram") {
        const [account] = await db
          .select()
          .from(connectedAccounts)
          .where(
            and(
              eq(connectedAccounts.userId, userId),
              eq(connectedAccounts.platform, "instagram"),
              eq(connectedAccounts.isActive, true)
            )
          )
          .limit(1);

        if (!account?.accessToken) continue;

        const ctx = await resolveInstagramContext(
          account.accessToken,
          account.accountId,
          account.refreshToken
        );
        if (!ctx) continue;

        result = await fetchInstagramHashtagStats(
          ctx.igUserId,
          ctx.pageAccessToken,
          tag.hashtag
        );
      } else if (tag.platform === "tiktok") {
        result = estimateTikTokHashtagStats(tag.hashtag);
      } else {
        continue;
      }
    } catch (err) {
      console.error(`[Listening] Hashtag sync failed for #${tag.hashtag}:`, err);
      continue;
    }

    const [existing] = await db
      .select({ id: hashtagStats.id })
      .from(hashtagStats)
      .where(
        and(
          eq(hashtagStats.userId, userId),
          eq(hashtagStats.hashtag, tag.hashtag),
          eq(hashtagStats.platform, tag.platform),
          gte(hashtagStats.statDate, today)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(hashtagStats)
        .set({
          postCount: result.postCount,
          avgEngagement: result.avgEngagement,
          trendScore: result.trendScore,
        })
        .where(eq(hashtagStats.id, existing.id));
    } else {
      await db.insert(hashtagStats).values({
        userId,
        hashtag: tag.hashtag,
        platform: tag.platform,
        statDate: today,
        postCount: result.postCount,
        avgEngagement: result.avgEngagement,
        trendScore: result.trendScore,
      });
    }
    synced++;
  }

  return synced;
}

export async function getHashtagsWithStats(userId: string) {
  const db = getDb();

  const tags = await db
    .select()
    .from(trackedHashtags)
    .where(eq(trackedHashtags.userId, userId))
    .orderBy(trackedHashtags.createdAt);

  const stats = await db
    .select()
    .from(hashtagStats)
    .where(eq(hashtagStats.userId, userId))
    .orderBy(sql`${hashtagStats.statDate} DESC`);

  const latestByTag = new Map<string, (typeof stats)[0]>();
  for (const s of stats) {
    const key = `${s.platform}:${s.hashtag}`;
    if (!latestByTag.has(key)) latestByTag.set(key, s);
  }

  return tags.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    stats: latestByTag.get(`${t.platform}:${t.hashtag}`) ?? null,
  }));
}
