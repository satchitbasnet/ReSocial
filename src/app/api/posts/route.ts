import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  posts,
  distributions,
  connectedAccounts,
  users,
} from "@/lib/db/schema";
import { publishToPlatform } from "@/lib/platforms/publisher";
import type { PlatformId } from "@/lib/constants";

const createPostSchema = z.object({
  title: z.string().min(1),
  caption: z.string().optional(),
  mediaUrl: z.string().min(1),
  mediaType: z.string().default("video"),
  platformIds: z.array(z.string()).min(1),
  scheduledAt: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const userPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.userId, session.userId))
      .orderBy(desc(posts.createdAt))
      .limit(50);

    const postsWithDistributions = await Promise.all(
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

        return { ...post, distributions: dists };
      })
    );

    return NextResponse.json({ posts: postsWithDistributions });
  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { title, caption, mediaUrl, mediaType, platformIds, scheduledAt } =
      parsed.data;

    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan === "trial" && user.videosPublished >= 10) {
      return NextResponse.json(
        { error: "Trial limit reached (10 videos). Please upgrade your plan." },
        { status: 403 }
      );
    }

    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, session.userId));

    const targetAccounts = accounts.filter(
      (a) => platformIds.includes(a.platform) && a.isActive
    );

    if (targetAccounts.length === 0) {
      return NextResponse.json(
        { error: "No connected accounts for selected platforms. Connect accounts first." },
        { status: 400 }
      );
    }

    const [post] = await db
      .insert(posts)
      .values({
        userId: session.userId,
        title,
        caption: caption || "",
        mediaUrl,
        mediaType,
        status: scheduledAt ? "scheduled" : "processing",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      })
      .returning();

    const distRecords = await db
      .insert(distributions)
      .values(
        targetAccounts.map((account) => ({
          postId: post.id,
          accountId: account.id,
          platform: account.platform,
          status: "processing" as const,
        }))
      )
      .returning();

    // Publish asynchronously
    if (!scheduledAt) {
      await Promise.all(
        distRecords.map(async (dist) => {
          const account = targetAccounts.find((a) => a.id === dist.accountId)!;
          const result = await publishToPlatform(
            dist.platform as PlatformId,
            account.accountName,
            mediaUrl,
            caption || title
          );

          await db
            .update(distributions)
            .set({
              status: result.success ? "published" : "failed",
              platformPostId: result.platformPostId,
              errorMessage: result.error,
              publishedAt: result.success ? new Date() : null,
            })
            .where(eq(distributions.id, dist.id));
        })
      );

      await db
        .update(posts)
        .set({ status: "published" })
        .where(eq(posts.id, post.id));

      await db
        .update(users)
        .set({ videosPublished: user.videosPublished + 1 })
        .where(eq(users.id, session.userId));
    }

    return NextResponse.json({ post, success: true });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
