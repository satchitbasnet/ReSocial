import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { driveConnections } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/config";
import {
  exchangeGoogleDriveCode,
  fetchGoogleAccountEmail,
  ensureDriveBackupFolder,
} from "@/lib/integrations/google-drive";

const STATE_COOKIE = "google_drive_oauth_state";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const settingsUrl = new URL("/dashboard/settings", appUrl);

  const session = await getSession();
  if (!session) {
    settingsUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(settingsUrl);
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    settingsUrl.searchParams.set("error", `google_drive_${error}`);
    return NextResponse.redirect(settingsUrl);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    settingsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeGoogleDriveCode(code);
    if (!tokens.refreshToken) {
      settingsUrl.searchParams.set("error", "google_drive_no_refresh");
      return NextResponse.redirect(settingsUrl);
    }

    const accountEmail = await fetchGoogleAccountEmail(tokens.accessToken);
    const db = getDb();

    const [existing] = await db
      .select()
      .from(driveConnections)
      .where(eq(driveConnections.userId, session.userId))
      .limit(1);

    if (existing) {
      await db
        .update(driveConnections)
        .set({
          accountEmail,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isActive: true,
        })
        .where(eq(driveConnections.id, existing.id));
    } else {
      await db.insert(driveConnections).values({
        userId: session.userId,
        accountEmail,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isActive: true,
      });
    }

    await ensureDriveBackupFolder(session.userId, tokens.accessToken);

    settingsUrl.searchParams.set("connected", "google_drive");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    settingsUrl.searchParams.set("error", "google_drive_oauth_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
