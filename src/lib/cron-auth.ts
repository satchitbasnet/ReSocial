import { NextResponse } from "next/server";

/** Shared auth for /api/cron/* and report cron routes. */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${expected}`) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
