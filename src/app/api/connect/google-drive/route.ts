import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { buildGoogleDriveAuthUrl } from "@/lib/integrations/google-drive";

const STATE_COOKIE = "google_drive_oauth_state";
const STATE_TTL = 60 * 10;

export async function GET() {
  const appUrl = getAppUrl();
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  try {
    const state = randomBytes(24).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_TTL,
      path: "/",
    });

    return NextResponse.redirect(buildGoogleDriveAuthUrl(state));
  } catch (error) {
    console.error("Google Drive connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=google_drive_config", appUrl)
    );
  }
}
