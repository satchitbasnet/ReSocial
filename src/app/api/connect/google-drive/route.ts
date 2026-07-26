import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { buildGoogleDriveAuthUrl } from "@/lib/integrations/google-drive";
import { oauthRedirect } from "@/lib/oauth-state";

const STATE_COOKIE = "google_drive_oauth_state";

export async function GET() {
  const appUrl = getAppUrl();
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  try {
    const state = randomBytes(24).toString("hex");
    return oauthRedirect(buildGoogleDriveAuthUrl(state), [
      { name: STATE_COOKIE, value: state },
    ]);
  } catch (error) {
    console.error("Google Drive connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_config", appUrl)
    );
  }
}
