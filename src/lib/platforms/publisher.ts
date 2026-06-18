import { PLATFORMS, type PlatformId } from "@/lib/constants";

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

/**
 * Platform publisher interface.
 * In production, each platform would use its official OAuth API.
 * This MVP simulates publishing for demo purposes.
 */
export async function publishToPlatform(
  platform: PlatformId,
  accountName: string,
  mediaUrl: string,
  caption: string
): Promise<PublishResult> {
  const platformConfig = PLATFORMS.find((p) => p.id === platform);
  if (!platformConfig) {
    return { success: false, error: "Unknown platform" };
  }

  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

  // Simulate occasional failures (5% rate) for realism
  if (Math.random() < 0.05) {
    return {
      success: false,
      error: `${platformConfig.name} API rate limit exceeded. Will retry.`,
    };
  }

  const platformPostId = `${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log(
    `[ReSocial] Published to ${platformConfig.name} (@${accountName}): ${caption.slice(0, 50)}...`
  );

  return { success: true, platformPostId };
}

export function getOAuthUrl(platform: PlatformId, redirectUri: string): string {
  const baseUrls: Record<PlatformId, string> = {
    tiktok: "https://www.tiktok.com/v2/auth/authorize",
    youtube: "https://accounts.google.com/o/oauth2/v2/auth",
    instagram: "https://api.instagram.com/oauth/authorize",
    facebook: "https://www.facebook.com/v18.0/dialog/oauth",
    linkedin: "https://www.linkedin.com/oauth/v2/authorization",
    twitter: "https://twitter.com/i/oauth2/authorize",
    pinterest: "https://www.pinterest.com/oauth",
    snapchat: "https://accounts.snapchat.com/login/oauth2/authorize",
  };

  const clientIds: Partial<Record<PlatformId, string>> = {
    tiktok: process.env.TIKTOK_CLIENT_ID,
    youtube: process.env.YOUTUBE_CLIENT_ID,
    instagram: process.env.INSTAGRAM_CLIENT_ID,
    facebook: process.env.FACEBOOK_CLIENT_ID,
    linkedin: process.env.LINKEDIN_CLIENT_ID,
    twitter: process.env.TWITTER_CLIENT_ID,
  };

  const clientId = clientIds[platform];
  if (!clientId) {
    return `/dashboard/accounts?connect=${platform}&demo=true`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "publish",
    state: platform,
  });

  return `${baseUrls[platform]}?${params.toString()}`;
}
