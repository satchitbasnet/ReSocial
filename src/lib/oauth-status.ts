import { getAppUrl } from "@/lib/config";

export type OAuthPlatformId =
  | "tiktok"
  | "youtube"
  | "instagram"
  | "facebook"
  | "google-drive";

export interface OAuthPlatformStatus {
  id: OAuthPlatformId;
  name: string;
  configured: boolean;
  missingEnv: string[];
  redirectUri: string;
  notes: string[];
}

const PLATFORM_META: Record<
  OAuthPlatformId,
  { name: string; env: [string, string]; callbackPath: string; notes: string[] }
> = {
  tiktok: {
    name: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/tiktok",
    notes: [
      "Enable Login Kit and Content Posting API in the TikTok developer portal.",
      "Register the redirect URI exactly as shown (no trailing slash).",
    ],
  },
  youtube: {
    name: "YouTube",
    env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/youtube",
    notes: [
      "Create a separate Google Cloud OAuth client for YouTube (not Google Drive).",
      "Add https://www.googleapis.com/auth/youtube scopes in the consent screen.",
    ],
  },
  instagram: {
    name: "Instagram",
    env: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/instagram",
    notes: [
      "Use the Instagram App ID + Secret from Meta → Instagram → API setup with Instagram Login.",
      "Requires a Creator or Business Instagram account (personal accounts fail).",
    ],
  },
  facebook: {
    name: "Facebook",
    env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/facebook",
    notes: [
      "Use your Meta/Facebook App ID and App Secret.",
      "The connecting user must admin at least one Facebook Page.",
    ],
  },
  "google-drive": {
    name: "Google Drive",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/google-drive",
    notes: [
      "Create a separate Google Cloud OAuth client for Drive (not YouTube).",
      "If reconnecting, revoke prior access in Google Account settings first.",
    ],
  },
};

function isEnvSet(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

export function getOAuthPlatformStatus(
  platform: OAuthPlatformId
): OAuthPlatformStatus {
  const meta = PLATFORM_META[platform];
  const missingEnv = meta.env.filter((key) => !isEnvSet(key));
  const appUrl = getAppUrl();

  return {
    id: platform,
    name: meta.name,
    configured: missingEnv.length === 0,
    missingEnv,
    redirectUri: `${appUrl}${meta.callbackPath}`,
    notes: meta.notes,
  };
}

export function getOAuthDiagnostics() {
  const appUrl = getAppUrl();
  const platforms = (
    Object.keys(PLATFORM_META) as OAuthPlatformId[]
  ).map(getOAuthPlatformStatus);

  return {
    appUrl,
    urlEnv: {
      NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
      resolvedFrom:
        process.env.NEXT_PUBLIC_URL
          ? "NEXT_PUBLIC_URL"
          : process.env.NEXT_PUBLIC_APP_URL
            ? "NEXT_PUBLIC_APP_URL"
            : "default (http://localhost:3000)",
    },
    platforms,
    configuredCount: platforms.filter((p) => p.configured).length,
    totalCount: platforms.length,
    checklist: [
      "Set NEXT_PUBLIC_APP_URL to your exact public URL (https, no trailing slash).",
      "Add each redirect URI below to the matching provider developer console.",
      "Set each platform's client ID/secret env vars on your host (Render, Vercel, etc.).",
      "Stay logged in during OAuth — callbacks require your session cookie.",
      "X/Twitter, Pinterest, and Snapchat are not OAuth-connected yet in this app.",
    ],
  };
}
