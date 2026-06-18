import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts, followerSnapshots } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeFacebookCode,
  fetchFacebookPages,
} from "@/lib/platforms/facebook";

const STATE_COOKIE = "facebook_oauth_state";

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
    accountsUrl.searchParams.set("error", `facebook_${error}`);
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
    const tokens = await exchangeFacebookCode(code);
    const pages = await fetchFacebookPages(tokens.accessToken);

    if (pages.length === 0) {
      accountsUrl.searchParams.set("error", "facebook_no_pages");
      return NextResponse.redirect(accountsUrl);
    }

    const page = pages[0];
    const db = getDb();

    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.userId),
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
          accountName: page.displayName,
          accessToken: tokens.accessToken,
          isActive: true,
        })
        .where(eq(connectedAccounts.id, existing.id));
      accountRowId = existing.id;
    } else {
      const [inserted] = await db
        .insert(connectedAccounts)
        .values({
          userId: session.userId,
          platform: "facebook",
          accountName: page.displayName,
          accountId: page.pageId,
          accessToken: tokens.accessToken,
          isActive: true,
        })
        .returning({ id: connectedAccounts.id });
      accountRowId = inserted.id;
    }

    await db.insert(followerSnapshots).values({
      userId: session.userId,
      accountId: accountRowId,
      platform: "facebook",
      followerCount: page.followerCount,
    });

    accountsUrl.searchParams.set("connected", "facebook");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "facebook_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
