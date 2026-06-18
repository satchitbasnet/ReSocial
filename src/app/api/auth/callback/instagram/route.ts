import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts, followerSnapshots } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeInstagramCode,
  fetchInstagramAccountInfo,
} from "@/lib/platforms/instagram";

const STATE_COOKIE = "instagram_oauth_state";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const accountsUrl = new URL("/dashboard/accounts", appUrl);

  const session = await getSession();
  if (!session) {
    accountsUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(accountsUrl);
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    accountsUrl.searchParams.set("error", `instagram_${error}`);
    return NextResponse.redirect(accountsUrl);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    accountsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(accountsUrl);
  }

  try {
    const tokens = await exchangeInstagramCode(code);
    const account = await fetchInstagramAccountInfo(tokens.accessToken);
    const compositeId = `${account.igUserId}:${account.pageId}`;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.userId),
          eq(connectedAccounts.platform, "instagram"),
          eq(connectedAccounts.accountId, compositeId)
        )
      )
      .limit(1);

    let accountRowId: string;

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          accountName: account.displayName,
          accessToken: tokens.accessToken,
          refreshToken: account.pageAccessToken,
          isActive: true,
        })
        .where(eq(connectedAccounts.id, existing.id));
      accountRowId = existing.id;
    } else {
      const [inserted] = await db
        .insert(connectedAccounts)
        .values({
          userId: session.userId,
          platform: "instagram",
          accountName: account.displayName,
          accountId: compositeId,
          accessToken: tokens.accessToken,
          refreshToken: account.pageAccessToken,
          isActive: true,
        })
        .returning({ id: connectedAccounts.id });
      accountRowId = inserted.id;
    }

    await db.insert(followerSnapshots).values({
      userId: session.userId,
      accountId: accountRowId,
      platform: "instagram",
      followerCount: account.followerCount,
    });

    accountsUrl.searchParams.set("connected", "instagram");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("Instagram OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "instagram_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
