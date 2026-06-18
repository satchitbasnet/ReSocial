import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import { buildYouTubeAuthUrl } from "@/lib/platforms/youtube";

const STATE_COOKIE = "youtube_oauth_state";
const STATE_TTL = 60 * 10;

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
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_TTL,
      path: "/",
    });

    return NextResponse.redirect(buildYouTubeAuthUrl(state));
  } catch (error) {
    console.error("YouTube connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=youtube_config", appUrl)
    );
  }
}
