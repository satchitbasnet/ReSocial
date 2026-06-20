import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, connectedAccounts, posts } from "@/lib/db/schema";
import { getUsageStatus } from "@/lib/usage/tracker";

export async function getDashboardStats(userId: string) {
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  const usage = await getUsageStatus(userId);

  return {
    user,
    accountCount: accounts.length,
    postCount: userPosts.length,
    videosPublished: user?.videosPublished ?? 0,
    trialLimit: user?.plan === "trial" ? 10 : null,
    usage,
  };
}
