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
import { oauthStateCookieOptions } from "@/lib/oauth-state";

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

    const cookieOpts = oauthStateCookieOptions();

    if (pages.length === 1) {
      const db = getDb();
      await upsertFacebookPageConnection(db, session.userId, pages[0]);
      accountsUrl.searchParams.set("connected", "facebook");
      const response = NextResponse.redirect(accountsUrl);
      response.cookies.delete(PENDING_FACEBOOK_TOKEN_COOKIE);
      return response;
    }

    accountsUrl.searchParams.set("facebook_pick", "1");
    const response = NextResponse.redirect(accountsUrl);
    response.cookies.set(
      PENDING_FACEBOOK_TOKEN_COOKIE,
      tokens.accessToken,
      cookieOpts
    );
    return response;
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "facebook_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
