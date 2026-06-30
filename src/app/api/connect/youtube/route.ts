import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import { buildYouTubeAuthUrl } from "@/lib/platforms/youtube";
import {
  isYouTubePermissionTier,
  type YouTubePermissionTier,
} from "@/lib/platforms/youtube-permissions";

const STATE_COOKIE = "youtube_oauth_state";
const CONTEXT_COOKIE = "youtube_oauth_context";
const STATE_TTL = 60 * 10;

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  try {
    const blocked = await assertCanConnect();
    if (blocked) return blocked;

    const permissionParam = request.nextUrl.searchParams.get("permission");
    const permission: YouTubePermissionTier = isYouTubePermissionTier(
      permissionParam
    )
      ? permissionParam
      : "basic";

    const label = request.nextUrl.searchParams.get("label")?.trim() || "";

    const state = randomBytes(24).toString("hex");
    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: STATE_TTL,
      path: "/",
    };

    cookieStore.set(STATE_COOKIE, state, cookieOpts);
    cookieStore.set(
      CONTEXT_COOKIE,
      JSON.stringify({ permission, label }),
      cookieOpts
    );

    return NextResponse.redirect(buildYouTubeAuthUrl(state, permission));
  } catch (error) {
    console.error("YouTube connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=youtube_config", appUrl)
    );
  }
}
