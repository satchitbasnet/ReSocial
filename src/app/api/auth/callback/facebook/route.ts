import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAppUrl } from "@/lib/config";
import {
  exchangeFacebookCode,
  fetchFacebookPages,
} from "@/lib/platforms/facebook";
import { upsertFacebookPageConnection, PENDING_FACEBOOK_TOKEN_COOKIE } from "@/lib/platforms/facebook-connect";

const STATE_COOKIE = "facebook_oauth_state";
const COOKIE_TTL = 60 * 10;

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

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: COOKIE_TTL,
      path: "/",
    };

    cookieStore.set(PENDING_FACEBOOK_TOKEN_COOKIE, tokens.accessToken, cookieOpts);

    if (pages.length === 1) {
      const db = getDb();
      await upsertFacebookPageConnection(db, session.userId, pages[0]);
      cookieStore.delete(PENDING_FACEBOOK_TOKEN_COOKIE);
      accountsUrl.searchParams.set("connected", "facebook");
      return NextResponse.redirect(accountsUrl);
    }

    accountsUrl.searchParams.set("facebook_pick", "1");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "facebook_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
