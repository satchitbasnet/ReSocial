import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { trackedHashtags } from "@/lib/db/schema";
import { getHashtagsWithStats } from "@/lib/listening/sync";
import { getHashtagLimit, type UserPlan } from "@/lib/plans";
import { isListeningPlatform } from "@/lib/listening/hashtags";

const createSchema = z.object({
  hashtag: z.string().min(1).max(100),
  platform: z.enum(["tiktok", "instagram"]),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hashtags = await getHashtagsWithStats(session.userId);
  return NextResponse.json({
    hashtags,
    limit: getHashtagLimit(session.plan as UserPlan),
    plan: session.plan,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const hashtag = parsed.data.hashtag.replace(/^#/, "").trim().toLowerCase();
  const platform = parsed.data.platform;

  if (!isListeningPlatform(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }

  const db = getDb();
  const limit = getHashtagLimit(session.plan as UserPlan);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trackedHashtags)
    .where(eq(trackedHashtags.userId, session.userId));

  if ((countRow?.count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `Hashtag limit reached (${limit} on ${session.plan} plan).`,
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }

  const [existing] = await db
    .select({ id: trackedHashtags.id })
    .from(trackedHashtags)
    .where(
      and(
        eq(trackedHashtags.userId, session.userId),
        eq(trackedHashtags.hashtag, hashtag),
        eq(trackedHashtags.platform, platform)
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Already tracking this hashtag" }, { status: 409 });
  }

  const [tag] = await db
    .insert(trackedHashtags)
    .values({ userId: session.userId, hashtag, platform })
    .returning();

  return NextResponse.json({ hashtag: tag });
}
