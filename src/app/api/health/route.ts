import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/config";

export async function GET() {
  const appUrl = getAppUrl();
  const ig = process.env.INSTAGRAM_CLIENT_ID ?? "";
  const fb = process.env.FACEBOOK_CLIENT_ID ?? "";
  const igSecret = process.env.INSTAGRAM_CLIENT_SECRET ?? "";

  return NextResponse.json({
    status: "ok",
    service: "resocial",
    oauth: {
      instagramConfigured: Boolean(ig && igSecret),
      instagramDistinctFromFacebook: Boolean(ig && fb && ig !== fb),
      facebookConfigured: Boolean(fb && process.env.FACEBOOK_CLIENT_SECRET),
      tiktokConfigured: Boolean(
        process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET
      ),
      appUrl,
      redirectUris: {
        instagram: `${appUrl}/api/auth/callback/instagram`,
        facebook: `${appUrl}/api/auth/callback/facebook`,
        tiktok: `${appUrl}/api/auth/callback/tiktok`,
        youtube: `${appUrl}/api/auth/callback/youtube`,
      },
    },
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  });
}
