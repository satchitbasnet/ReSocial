import { NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const OAUTH_STATE_TTL = 60 * 10;

export function oauthStateCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_TTL,
    path: "/",
  };
}

/** Attach OAuth state cookies to the redirect (required for App Router). */
export function oauthRedirect(
  url: string | URL,
  cookies: Array<{ name: string; value: string }>
) {
  const response = NextResponse.redirect(url);
  const options = oauthStateCookieOptions();
  for (const { name, value } of cookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
