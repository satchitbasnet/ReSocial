import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inboxMessages, posts } from "@/lib/db/schema";

const querySchema = z.object({
  platform: z.string().optional(),
  type: z.enum(["comment", "dm", "mention"]).optional(),
  status: z.enum(["unread", "replied", "all"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { platform, type, status, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const db = getDb();
    const conditions = [eq(inboxMessages.userId, session.userId)];

    if (platform) {
      conditions.push(
        eq(
          inboxMessages.platform,
          platform as (typeof inboxMessages.$inferSelect)["platform"]
        )
      );
    }
    if (type) {
      conditions.push(eq(inboxMessages.type, type));
    }
    if (status === "unread") {
      conditions.push(eq(inboxMessages.isRead, false));
    } else if (status === "replied") {
      conditions.push(eq(inboxMessages.isReplied, true));
    }

    const where = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inboxMessages)
      .where(where);

    const messages = await db
      .select({
        id: inboxMessages.id,
        platform: inboxMessages.platform,
        type: inboxMessages.type,
        authorName: inboxMessages.authorName,
        authorAvatar: inboxMessages.authorAvatar,
        content: inboxMessages.content,
        postId: inboxMessages.postId,
        platformPostId: inboxMessages.platformPostId,
        isRead: inboxMessages.isRead,
        isReplied: inboxMessages.isReplied,
        repliedAt: inboxMessages.repliedAt,
        assignedToUserId: inboxMessages.assignedToUserId,
        receivedAt: inboxMessages.receivedAt,
        postTitle: posts.title,
      })
      .from(inboxMessages)
      .leftJoin(posts, eq(inboxMessages.postId, posts.id))
      .where(where)
      .orderBy(desc(inboxMessages.receivedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      messages: messages.map((m) => ({
        ...m,
        repliedAt: m.repliedAt?.toISOString() ?? null,
        receivedAt: m.receivedAt.toISOString(),
      })),
      total: countRow?.count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Inbox list error:", error);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
