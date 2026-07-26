import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import { buildTikTokAuthUrl, generateTikTokPkce } from "@/lib/platforms/tiktok";
import { oauthRedirect } from "@/lib/oauth-state";

const STATE_COOKIE = "tiktok_oauth_state";
const PKCE_COOKIE = "tiktok_pkce_verifier";

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
    const { codeVerifier, codeChallenge } = generateTikTokPkce();
    const authUrl = buildTikTokAuthUrl(state, codeChallenge);
    return oauthRedirect(authUrl, [
      { name: STATE_COOKIE, value: state },
      { name: PKCE_COOKIE, value: codeVerifier },
    ]);
  } catch (error) {
    console.error("TikTok connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=tiktok_config", appUrl)
    );
  }
}
