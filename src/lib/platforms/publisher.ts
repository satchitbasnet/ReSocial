import { PLATFORMS, type PlatformId } from "@/lib/constants";
import { getAppUrl } from "@/lib/config";
import {
  publishVideoToTikTok,
  type TokenRefreshHandler,
} from "@/lib/platforms/tiktok";
import {
  publishVideoToYouTube,
} from "@/lib/platforms/youtube";
import { youtubeScopesAllowUpload } from "@/lib/platforms/youtube-permissions";
import { publishVideoToInstagram, publishPhotosToInstagram } from "@/lib/platforms/instagram";
import { publishVideoToFacebook, publishPhotosToFacebook } from "@/lib/platforms/facebook";

export interface PublishMediaOptions {
  mediaType?: string;
  mediaUrls?: string[];
}

function isPhotoPost(mediaType?: string): boolean {
  return mediaType === "image" || mediaType === "carousel";
}

function resolvePhotoUrls(mediaUrl: string, options?: PublishMediaOptions): string[] {
  if (options?.mediaUrls?.length) return options.mediaUrls;
  if (isPhotoPost(options?.mediaType)) return [mediaUrl];
  return [];
}

export interface PublishMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  metrics?: PublishMetrics;
}

export interface PublishAccount {
  id: string;
  platform: PlatformId;
  accountName: string;
  accessToken: string | null;
  refreshToken: string | null;
  accountId: string | null;
  oauthScopes: string | null;
}

/**
 * Publish content to a connected platform account.
 * TikTok uses the real Content Posting API when OAuth tokens are present.
 */
export async function publishToPlatform(
  account: PublishAccount,
  mediaUrl: string,
  caption: string,
  onTokenRefresh?: TokenRefreshHandler,
  title?: string,
  mediaOptions?: PublishMediaOptions
): Promise<PublishResult> {
  const platformConfig = PLATFORMS.find((p) => p.id === account.platform);
  if (!platformConfig) {
    return { success: false, error: "Unknown platform" };
  }

  const photoUrls = resolvePhotoUrls(mediaUrl, mediaOptions);
  const publishingPhotos = isPhotoPost(mediaOptions?.mediaType);

  if (publishingPhotos) {
    if (account.platform === "tiktok" || account.platform === "youtube") {
      return {
        success: false,
        error: `${platformConfig.name} only supports video posts.`,
      };
    }
  } else if (
    mediaOptions?.mediaType &&
    mediaOptions.mediaType !== "video" &&
    account.platform !== "instagram" &&
    account.platform !== "facebook"
  ) {
    return {
      success: false,
      error: `${platformConfig.name} does not support this media type yet.`,
    };
  }

  if (account.platform === "tiktok") {
    if (!account.accessToken || account.accessToken === "demo_token") {
      return {
        success: false,
        error: "TikTok account not connected via OAuth. Reconnect at Accounts.",
      };
    }

    try {
      const { platformPostId } = await publishVideoToTikTok(
        account.accessToken,
        account.refreshToken,
        mediaUrl,
        caption,
        onTokenRefresh
      );

      return { success: true, platformPostId };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "TikTok publish failed";
      console.error(
        `[ReSocial] TikTok publish error (@${account.accountName}):`,
        message
      );
      return { success: false, error: message };
    }
  }

  if (account.platform === "youtube") {
    if (!account.accessToken || account.accessToken === "demo_token") {
      return {
        success: false,
        error: "YouTube account not connected via OAuth. Reconnect at Accounts.",
      };
    }

    if (!youtubeScopesAllowUpload(account.oauthScopes)) {
      return {
        success: false,
        error:
          "This YouTube connection is read-only. Reconnect with Basic or Full permissions to upload.",
      };
    }

    try {
      const { platformPostId, stats } = await publishVideoToYouTube(
        account.accessToken,
        account.refreshToken,
        mediaUrl,
        title || caption,
        caption,
        onTokenRefresh
      );

      return {
        success: true,
        platformPostId,
        metrics: stats as PublishMetrics | undefined,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "YouTube publish failed";
      console.error(
        `[ReSocial] YouTube publish error (@${account.accountName}):`,
        message
      );
      return { success: false, error: message };
    }
  }

  if (account.platform === "instagram") {
    if (!account.accessToken || account.accessToken === "demo_token") {
      return {
        success: false,
        error: "Instagram account not connected via OAuth. Reconnect at Accounts.",
      };
    }
    try {
      if (publishingPhotos) {
        const { platformPostId, stats } = await publishPhotosToInstagram(
          account.accessToken,
          account.accountId,
          photoUrls,
          caption,
          account.refreshToken
        );
        return { success: true, platformPostId, metrics: stats };
      }

      const { platformPostId, stats } = await publishVideoToInstagram(
        account.accessToken,
        account.accountId,
        mediaUrl,
        caption,
        account.refreshToken
      );
      return { success: true, platformPostId, metrics: stats };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Instagram publish failed";
      return { success: false, error: message };
    }
  }

  if (account.platform === "facebook") {
    if (!account.accessToken || account.accessToken === "demo_token") {
      return {
        success: false,
        error: "Facebook account not connected via OAuth. Reconnect at Accounts.",
      };
    }
    try {
      if (publishingPhotos) {
        const { platformPostId } = await publishPhotosToFacebook(
          account.accessToken,
          account.accountId,
          photoUrls,
          caption
        );
        return { success: true, platformPostId };
      }

      const { platformPostId, stats } = await publishVideoToFacebook(
        account.accessToken,
        account.accountId,
        mediaUrl,
        caption
      );
      return { success: true, platformPostId, metrics: stats };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Facebook publish failed";
      return { success: false, error: message };
    }
  }

  // Remaining platforms: simulated
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

  if (Math.random() < 0.05) {
    return {
      success: false,
      error: `${platformConfig.name} API rate limit exceeded. Will retry.`,
    };
  }

  const platformPostId = `${account.platform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log(
    `[ReSocial] Published to ${platformConfig.name} (@${account.accountName}): ${caption.slice(0, 50)}...`
  );

  return { success: true, platformPostId };
}

export function getOAuthUrl(platform: PlatformId): string {
  if (platform === "tiktok") {
    return `${getAppUrl()}/api/connect/tiktok`;
  }
  if (platform === "youtube") {
    return `${getAppUrl()}/api/connect/youtube`;
  }
  if (platform === "instagram") {
    return `${getAppUrl()}/api/connect/instagram`;
  }
  if (platform === "facebook") {
    return `${getAppUrl()}/api/connect/facebook`;
  }

  const baseUrls: Record<PlatformId, string> = {
    tiktok: `${getAppUrl()}/api/connect/tiktok`,
    youtube: "https://accounts.google.com/o/oauth2/v2/auth",
    instagram: "https://api.instagram.com/oauth/authorize",
    facebook: "https://www.facebook.com/v18.0/dialog/oauth",
    twitter: "https://twitter.com/i/oauth2/authorize",
    pinterest: "https://www.pinterest.com/oauth",
    snapchat: "https://accounts.snapchat.com/login/oauth2/authorize",
  };

  const clientIds: Partial<Record<PlatformId, string>> = {
    youtube: process.env.YOUTUBE_CLIENT_ID,
    instagram: process.env.INSTAGRAM_CLIENT_ID,
    facebook: process.env.FACEBOOK_CLIENT_ID,
    twitter: process.env.TWITTER_CLIENT_ID,
  };

  const clientId = clientIds[platform];
  if (!clientId) {
    return `/dashboard/accounts?connect=${platform}&demo=true`;
  }

  const redirectUri = `${getAppUrl()}/api/auth/callback/${platform}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "publish",
    state: platform,
  });

  return `${baseUrls[platform]}?${params.toString()}`;
}
