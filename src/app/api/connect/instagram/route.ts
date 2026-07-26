import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import { buildInstagramAuthUrl } from "@/lib/platforms/instagram";
import { oauthRedirect } from "@/lib/oauth-state";

const STATE_COOKIE = "instagram_oauth_state";

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
    return oauthRedirect(buildInstagramAuthUrl(state), [
      { name: STATE_COOKIE, value: state },
    ]);
  } catch (error) {
    console.error("Instagram connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=instagram_config", appUrl)
    );
  }
}
