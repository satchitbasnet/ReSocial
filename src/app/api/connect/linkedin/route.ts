import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { assertCanConnect } from "@/lib/connect-guard";
import {
  buildLinkedInAuthUrl,
  generatePkce,
} from "@/lib/platforms/linkedin";

const STATE_COOKIE = "linkedin_oauth_state";
const PKCE_COOKIE = "linkedin_pkce_verifier";
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
    const { codeVerifier, codeChallenge } = generatePkce();
    const cookieStore = await cookies();

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: STATE_TTL,
      path: "/",
    };

    cookieStore.set(STATE_COOKIE, state, cookieOpts);
    cookieStore.set(PKCE_COOKIE, codeVerifier, cookieOpts);

    return NextResponse.redirect(buildLinkedInAuthUrl(state, codeChallenge));
  } catch (error) {
    console.error("LinkedIn connect error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=linkedin_config", appUrl)
    );
  }
}
