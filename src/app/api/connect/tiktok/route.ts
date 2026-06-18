import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import { buildTikTokAuthUrl } from "@/lib/platforms/tiktok";

const STATE_COOKIE = "tiktok_oauth_state";
const STATE_TTL = 60 * 10; // 10 minutes

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

    const authUrl = buildTikTokAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("TikTok connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=tiktok_config", appUrl)
    );
  }
}
