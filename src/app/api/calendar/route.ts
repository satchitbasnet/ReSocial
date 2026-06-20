import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, or, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts, distributions, connectedAccounts } from "@/lib/db/schema";

const querySchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  platform: z.string().optional(),
});

function parseRangeDate(value: string, endOfDay = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  if (!value.includes("T") && endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else if (!value.includes("T")) {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function resolveCalendarDate(
  post: { scheduledAt: Date | null; status: string; createdAt: Date },
  dists: { publishedAt: Date | null }[]
) {
  if (post.scheduledAt) return post.scheduledAt;
  const published = dists
    .map((d) => d.publishedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return published ?? post.createdAt;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  try {
    const start = parseRangeDate(parsed.data.start);
    const end = parseRangeDate(parsed.data.end, true);
    const platformFilter = parsed.data.platform;

    const db = getDb();

    const userPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.userId, session.userId),
          or(
            and(
              isNotNull(posts.scheduledAt),
              gte(posts.scheduledAt, start),
              lte(posts.scheduledAt, end)
            ),
            and(
              isNull(posts.scheduledAt),
              gte(posts.createdAt, start),
              lte(posts.createdAt, end)
            )
          )
        )
      )
      .orderBy(posts.scheduledAt, posts.createdAt);

    const calendarPosts = await Promise.all(
      userPosts.map(async (post) => {
        const dists = await db
          .select({
            id: distributions.id,
            platform: distributions.platform,
            status: distributions.status,
            publishedAt: distributions.publishedAt,
            errorMessage: distributions.errorMessage,
            accountName: connectedAccounts.accountName,
          })
          .from(distributions)
          .leftJoin(
            connectedAccounts,
            eq(distributions.accountId, connectedAccounts.id)
          )
          .where(eq(distributions.postId, post.id));

        const filteredDists = platformFilter
          ? dists.filter((d) => d.platform === platformFilter)
          : dists;

        if (platformFilter && filteredDists.length === 0) {
          return null;
        }

        const calendarDate = resolveCalendarDate(post, dists);

        if (calendarDate < start || calendarDate > end) {
          return null;
        }

        return {
          id: post.id,
          title: post.title,
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
          createdAt: post.createdAt.toISOString(),
          calendarDate: calendarDate.toISOString(),
          distributions: filteredDists.map((d) => ({
            ...d,
            publishedAt: d.publishedAt?.toISOString() ?? null,
          })),
        };
      })
    );

    return NextResponse.json({
      posts: calendarPosts.filter(Boolean),
    });
  } catch (error) {
    console.error("Calendar fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
