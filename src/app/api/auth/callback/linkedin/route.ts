import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeLinkedInCode,
  fetchLinkedInProfile,
} from "@/lib/platforms/linkedin";

const STATE_COOKIE = "linkedin_oauth_state";
const PKCE_COOKIE = "linkedin_pkce_verifier";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const accountsUrl = new URL("/dashboard/accounts", appUrl);

  const session = await getSession();
  if (!session) {
    accountsUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(accountsUrl);
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    accountsUrl.searchParams.set("error", `linkedin_${error}`);
    return NextResponse.redirect(accountsUrl);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(PKCE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(PKCE_COOKIE);

  if (!code || !state || !savedState || state !== savedState || !codeVerifier) {
    accountsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(accountsUrl);
  }

  try {
    const tokens = await exchangeLinkedInCode(code, codeVerifier);
    const profile = await fetchLinkedInProfile(tokens.accessToken);
    const db = getDb();

    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.userId),
          eq(connectedAccounts.platform, "linkedin"),
          eq(connectedAccounts.accountId, profile.memberId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          accountName: profile.displayName,
          accessToken: tokens.accessToken,
          isActive: true,
        })
        .where(eq(connectedAccounts.id, existing.id));
    } else {
      await db.insert(connectedAccounts).values({
        userId: session.userId,
        platform: "linkedin",
        accountName: profile.displayName,
        accountId: profile.memberId,
        accessToken: tokens.accessToken,
        isActive: true,
      });
    }

    accountsUrl.searchParams.set("connected", "linkedin");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("LinkedIn OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "linkedin_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
