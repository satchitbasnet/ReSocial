import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeTwitterCode,
  fetchTwitterUserInfo,
} from "@/lib/platforms/twitter";

const STATE_COOKIE = "twitter_oauth_state";
const PKCE_COOKIE = "twitter_pkce_verifier";

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
    accountsUrl.searchParams.set("error", `twitter_${error}`);
    return NextResponse.redirect(accountsUrl);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(PKCE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(PKCE_COOKIE);

  if (!code || !state || !savedState || state !== savedState || !codeVerifier) {
    accountsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(accountsUrl);
  }

  try {
    const tokens = await exchangeTwitterCode(code, codeVerifier);
    const userInfo = await fetchTwitterUserInfo(tokens.accessToken);
    const db = getDb();

    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.userId),
          eq(connectedAccounts.platform, "twitter"),
          eq(connectedAccounts.accountId, userInfo.id)
        )
      )
      .limit(1);

    const accountName = `@${userInfo.username}`;

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          accountName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || null,
          oauthScopes: tokens.scope || null,
          isActive: true,
        })
        .where(eq(connectedAccounts.id, existing.id));
    } else {
      await db.insert(connectedAccounts).values({
        userId: session.userId,
        platform: "twitter",
        accountName,
        accountId: userInfo.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        oauthScopes: tokens.scope || null,
        isActive: true,
      });
    }

    accountsUrl.searchParams.set("connected", "twitter");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("Twitter OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "twitter_oauth_failed");
    const message = err instanceof Error ? err.message : "";
    if (message) {
      accountsUrl.searchParams.set("error_detail", message.slice(0, 300));
    }
    return NextResponse.redirect(accountsUrl);
  }
}
