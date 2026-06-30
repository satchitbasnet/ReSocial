import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { connectedAccounts, followerSnapshots } from "@/lib/db/schema";
import type { FacebookPageInfo } from "@/lib/platforms/facebook";

export const PENDING_FACEBOOK_TOKEN_COOKIE = "facebook_pending_token";

export async function upsertFacebookPageConnection(
  db: Db,
  userId: string,
  page: FacebookPageInfo,
  connectionLabel?: string
): Promise<string> {
  const accountName = connectionLabel?.trim() || page.displayName;

  const [existing] = await db
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.platform, "facebook"),
        eq(connectedAccounts.accountId, page.pageId)
      )
    )
    .limit(1);

  let accountRowId: string;

  if (existing) {
    await db
      .update(connectedAccounts)
      .set({
        accountName,
        accessToken: page.pageAccessToken,
        isActive: true,
      })
      .where(eq(connectedAccounts.id, existing.id));
    accountRowId = existing.id;
  } else {
    const [inserted] = await db
      .insert(connectedAccounts)
      .values({
        userId,
        platform: "facebook",
        accountName,
        accountId: page.pageId,
        accessToken: page.pageAccessToken,
        isActive: true,
      })
      .returning({ id: connectedAccounts.id });
    accountRowId = inserted.id;
  }

  await db.insert(followerSnapshots).values({
    userId,
    accountId: accountRowId,
    platform: "facebook",
    followerCount: page.followerCount,
  });

  return accountRowId;
}
