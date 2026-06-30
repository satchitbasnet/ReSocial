import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts, followerSnapshots } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeYouTubeCode,
  fetchYouTubeChannelInfo,
} from "@/lib/platforms/youtube";

const STATE_COOKIE = "youtube_oauth_state";
const CONTEXT_COOKIE = "youtube_oauth_context";

function parseOAuthContext(raw: string | undefined): {
  permission: string;
  label: string;
} {
  if (!raw) return { permission: "basic", label: "" };
  try {
    const parsed = JSON.parse(raw) as { permission?: string; label?: string };
    return {
      permission: parsed.permission ?? "basic",
      label: parsed.label?.trim() ?? "",
    };
  } catch {
    return { permission: "basic", label: "" };
  }
}

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
    accountsUrl.searchParams.set("error", `youtube_${error}`);
    return NextResponse.redirect(accountsUrl);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const oauthContext = parseOAuthContext(
    cookieStore.get(CONTEXT_COOKIE)?.value
  );
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(CONTEXT_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    accountsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(accountsUrl);
  }

  try {
    const tokens = await exchangeYouTubeCode(code);
    const channel = await fetchYouTubeChannelInfo(tokens.accessToken);
    const displayName = oauthContext.label || channel.displayName;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.userId),
          eq(connectedAccounts.platform, "youtube"),
          eq(connectedAccounts.accountId, channel.channelId)
        )
      )
      .limit(1);

    let accountId: string;

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          accountName: displayName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || existing.refreshToken,
          oauthScopes: tokens.scope,
          isActive: true,
        })
        .where(eq(connectedAccounts.id, existing.id));
      accountId = existing.id;
    } else {
      const [inserted] = await db
        .insert(connectedAccounts)
        .values({
          userId: session.userId,
          platform: "youtube",
          accountName: displayName,
          accountId: channel.channelId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          oauthScopes: tokens.scope,
          isActive: true,
        })
        .returning({ id: connectedAccounts.id });
      accountId = inserted.id;
    }

    await db.insert(followerSnapshots).values({
      userId: session.userId,
      accountId,
      platform: "youtube",
      followerCount: channel.subscriberCount,
    });

    accountsUrl.searchParams.set("connected", "youtube");
    return NextResponse.redirect(accountsUrl);
  } catch (err) {
    console.error("YouTube OAuth callback error:", err);
    accountsUrl.searchParams.set("error", "youtube_oauth_failed");
    return NextResponse.redirect(accountsUrl);
  }
}
