import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import {
  buildTwitterAuthUrl,
  generateTwitterPkce,
} from "@/lib/platforms/twitter";
import { oauthRedirect } from "@/lib/oauth-state";

const STATE_COOKIE = "twitter_oauth_state";
const PKCE_COOKIE = "twitter_pkce_verifier";

export async function GET() {
  const appUrl = getAppUrl();
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  try {
    const blocked = await assertCanConnect();
    if (blocked) return blocked;

    const state = randomBytes(24).toString("hex");
    const { codeVerifier, codeChallenge } = generateTwitterPkce();
    const authUrl = buildTwitterAuthUrl(state, codeChallenge);
    return oauthRedirect(authUrl, [
      { name: STATE_COOKIE, value: state },
      { name: PKCE_COOKIE, value: codeVerifier },
    ]);
  } catch (error) {
    console.error("Twitter connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=twitter_config", appUrl)
    );
  }
}
