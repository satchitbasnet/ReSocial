import { NextResponse } from "next/server";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { executePublishForPost } from "@/lib/publish/execute-distributions";

/** Every 5 minutes — publish posts whose scheduledAt has passed. */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  const duePosts = await db
    .select({
      id: posts.id,
      userId: posts.userId,
    })
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        isNotNull(posts.scheduledAt),
        lte(posts.scheduledAt, now)
      )
    )
    .limit(20);

  let published = 0;
  let failed = 0;

  for (const row of duePosts) {
    try {
      const result = await executePublishForPost(db, row.id, row.userId);
      if (result.publishSucceeded) published++;
      else failed++;
    } catch (err) {
      failed++;
      console.error(`[Cron] scheduled publish failed for ${row.id}:`, err);
      await db
        .update(posts)
        .set({ status: "failed" })
        .where(eq(posts.id, row.id));
    }
  }

  return NextResponse.json({
    ok: true,
    checked: duePosts.length,
    published,
    failed,
  });
}
