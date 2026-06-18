import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { checkCanConnectPlatform, type UserPlan } from "@/lib/plans";

/** Returns a redirect response if the user cannot connect another platform. */
export async function assertCanConnect(): Promise<NextResponse | null> {
  const session = await getSession();
  const appUrl = getAppUrl();
  const accountsUrl = new URL("/dashboard/accounts", appUrl);

  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const limit = await checkCanConnectPlatform(
    session.userId,
    session.plan as UserPlan
  );
  if (limit) {
    accountsUrl.searchParams.set("error", "plan_limit_platforms");
    return NextResponse.redirect(accountsUrl);
  }

  return null;
}

/** JSON guard for API routes that return JSON errors. */
export async function checkCanConnectJson(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkCanConnectPlatform(
    session.userId,
    session.plan as UserPlan
  );
  if (limit) {
    return NextResponse.json(limit, { status: 403 });
  }

  return null;
}
