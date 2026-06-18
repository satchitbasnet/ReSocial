import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "resocial_session";

interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  plan: string;
  exp: number;
}

function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const [, payloadB64] = token.split(".");
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const session = getSessionFromRequest(request);
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboard && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
