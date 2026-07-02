import { getAppUrl } from "@/lib/config";

export type OAuthProviderId =
  | "tiktok"
  | "youtube"
  | "instagram"
  | "facebook"
  | "google_drive";

export interface OAuthProviderConfig {
  id: OAuthProviderId;
  name: string;
  configured: boolean;
  missingEnv: string[];
  redirectUri: string;
  connectPath: string;
  developerPortal?: string;
}

function envPresent(...keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

function missingEnv(...keys: string[]): string[] {
  return keys.filter((key) => !process.env[key]?.trim());
}

const PROVIDER_DEFS: Array<{
  id: OAuthProviderId;
  name: string;
  env: string[];
  callbackPath: string;
  connectPath: string;
  developerPortal: string;
}> = [
  {
    id: "tiktok",
    name: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/tiktok",
    connectPath: "/api/connect/tiktok",
    developerPortal: "https://developers.tiktok.com/",
  },
  {
    id: "youtube",
    name: "YouTube",
    env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/youtube",
    connectPath: "/api/connect/youtube",
    developerPortal: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "instagram",
    name: "Instagram",
    env: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/instagram",
    connectPath: "/api/connect/instagram",
    developerPortal: "https://developers.facebook.com/",
  },
  {
    id: "facebook",
    name: "Facebook",
    env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/facebook",
    connectPath: "/api/connect/facebook",
    developerPortal: "https://developers.facebook.com/",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/google-drive",
    connectPath: "/api/connect/google-drive",
    developerPortal: "https://console.cloud.google.com/apis/credentials",
  },
];

export function getOAuthProviderConfigs(): OAuthProviderConfig[] {
  const appUrl = getAppUrl();

  return PROVIDER_DEFS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    configured: envPresent(...provider.env),
    missingEnv: missingEnv(...provider.env),
    redirectUri: `${appUrl}${provider.callbackPath}`,
    connectPath: provider.connectPath,
    developerPortal: provider.developerPortal,
  }));
}

export function getOAuthDiagnostics() {
  const appUrl = getAppUrl();
  const publicUrl = process.env.NEXT_PUBLIC_URL?.trim();
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const urlMismatch =
    Boolean(publicUrl && publicAppUrl) && publicUrl !== publicAppUrl;

  const providers = getOAuthProviderConfigs();
  const configuredCount = providers.filter((p) => p.configured).length;

  return {
    appUrl,
    authSecretSet: Boolean(process.env.AUTH_SECRET?.trim()),
    urlEnv: {
      NEXT_PUBLIC_URL: publicUrl ?? null,
      NEXT_PUBLIC_APP_URL: publicAppUrl ?? null,
      mismatch: urlMismatch,
      hint: urlMismatch
        ? "Both NEXT_PUBLIC_URL and NEXT_PUBLIC_APP_URL are set to different values. OAuth redirect URIs use getAppUrl() — register the redirectUri below in each provider console."
        : null,
    },
    providers,
    summary: {
      configured: configuredCount,
      total: providers.length,
      ready: configuredCount > 0 && Boolean(process.env.AUTH_SECRET?.trim()),
    },
  };
}
