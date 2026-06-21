import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeTikTokCode,
  fetchTikTokUserInfo,
} from "@/lib/platforms/tiktok";

const STATE_COOKIE = "tiktok_oauth_state";
const PKCE_COOKIE = "tiktok_pkce_verifier";

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
    accountsUrl.searchParams.set("error", `tiktok_${error}`);
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
    const tokens = await exchangeTikTokCode(code, codeVerifier);
    const userInfo = await fetchTikTokUserInfo(tokens.accessToken);

    const db = getDb();

    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.userId),
          eq(connectedAccounts.platform, "tiktok"),
          eq(connectedAccounts.accountId, userInfo.openId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          accountName: userInfo.displayName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isActive: true,
        })
        .where(eq(connectedAccounts.id, existing.id));
    } else {
      await db.insert(connectedAccounts).values({
        userId: session.userId,
        platform: "tiktok",
        accountName: userInfo.displayName,
        accountId: userInfo.openId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isActive: true,
      });
    }

    accountsUrl.searchParams.set("connected", "tiktok");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("TikTok OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "tiktok_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
