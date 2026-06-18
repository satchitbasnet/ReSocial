import { getAppUrl } from "@/lib/config";
import { fetchMediaBuffer } from "@/lib/r2";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export interface YouTubeChannelInfo {
  channelId: string;
  displayName: string;
  subscriberCount: number;
}

export interface YouTubeVideoStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

export type TokenRefreshHandler = (
  accessToken: string,
  refreshToken: string
) => Promise<void>;

class YouTubeApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

function getYouTubeCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getYouTubeRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/youtube`;
}

export function buildYouTubeAuthUrl(state: string): string {
  const { clientId } = getYouTubeCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getYouTubeRedirectUri(),
    response_type: "code",
    scope: YOUTUBE_SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function parseTokenResponse(res: Response): Promise<YouTubeTokens> {
  const body = await res.json();
  if (!res.ok) {
    const msg =
      body.error_description || body.error || "YouTube token request failed";
    throw new Error(msg);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? "",
    expiresIn: body.expires_in,
    scope: body.scope ?? "",
  };
}

export async function exchangeYouTubeCode(code: string): Promise<YouTubeTokens> {
  const { clientId, clientSecret } = getYouTubeCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getYouTubeRedirectUri(),
    }),
  });
  return parseTokenResponse(res);
}

export async function refreshYouTubeToken(
  refreshToken: string
): Promise<YouTubeTokens> {
  const { clientId, clientSecret } = getYouTubeCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return parseTokenResponse(res);
}

async function youtubeFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
}

async function withTokenRefresh<T>(
  accessToken: string,
  refreshToken: string | null,
  onRefresh: TokenRefreshHandler | undefined,
  fn: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(accessToken);
  } catch (err) {
    if (
      err instanceof YouTubeApiError &&
      err.status === 401 &&
      refreshToken &&
      onRefresh
    ) {
      const tokens = await refreshYouTubeToken(refreshToken);
      await onRefresh(tokens.accessToken, tokens.refreshToken || refreshToken);
      return fn(tokens.accessToken);
    }
    throw err;
  }
}

export async function fetchYouTubeChannelInfo(
  accessToken: string
): Promise<YouTubeChannelInfo> {
  const url = `${YOUTUBE_CHANNELS_URL}?part=snippet,statistics&mine=true`;
  const res = await youtubeFetch(url, accessToken);
  const body = await res.json();

  if (res.status === 401) {
    throw new YouTubeApiError("YouTube access token expired", 401);
  }
  if (!res.ok) {
    throw new Error(
      body.error?.message || `Failed to fetch YouTube channel (${res.status})`
    );
  }

  const channel = body.items?.[0];
  if (!channel) {
    throw new Error("No YouTube channel found for this account");
  }

  return {
    channelId: channel.id,
    displayName: channel.snippet?.title ?? "YouTube Channel",
    subscriberCount: parseInt(channel.statistics?.subscriberCount ?? "0", 10),
  };
}

export async function fetchYouTubeVideoStats(
  accessToken: string,
  videoId: string
): Promise<YouTubeVideoStats> {
  const url = `${YOUTUBE_VIDEOS_URL}?part=statistics&id=${encodeURIComponent(videoId)}`;
  const res = await youtubeFetch(url, accessToken);
  const body = await res.json();

  if (res.status === 401) {
    throw new YouTubeApiError("YouTube access token expired", 401);
  }
  if (!res.ok) {
    throw new Error(body.error?.message || "Failed to fetch video stats");
  }

  const stats = body.items?.[0]?.statistics;
  const views = parseInt(stats?.viewCount ?? "0", 10);
  const likes = parseInt(stats?.likeCount ?? "0", 10);
  const comments = parseInt(stats?.commentCount ?? "0", 10);
  const shares = 0;
  const saves = 0;
  const engagements = likes + comments;
  const engagementRate =
    views > 0 ? Math.round((engagements / views) * 10000) : 0;

  return { views, likes, comments, shares, saves, engagementRate };
}

async function resumableUpload(
  accessToken: string,
  videoBuffer: Buffer,
  title: string,
  description: string
): Promise<string> {
  const initRes = await youtubeFetch(
    `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/*",
        "X-Upload-Content-Length": String(videoBuffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title: title.slice(0, 100),
          description: description.slice(0, 5000),
        },
        status: { privacyStatus: "public" },
      }),
    }
  );

  if (initRes.status === 401) {
    throw new YouTubeApiError("YouTube access token expired", 401);
  }
  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`YouTube upload init failed: ${initRes.status} ${err}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("YouTube did not return resumable upload URL");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/*",
      "Content-Length": String(videoBuffer.length),
    },
    body: new Uint8Array(videoBuffer),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`YouTube video upload failed: ${uploadRes.status} ${err}`);
  }

  const result = await uploadRes.json();
  const videoId = result.id as string | undefined;
  if (!videoId) {
    throw new Error("YouTube upload succeeded but no video ID returned");
  }
  return videoId;
}

export async function publishVideoToYouTube(
  accessToken: string,
  refreshToken: string | null,
  mediaUrl: string,
  title: string,
  caption: string,
  onTokenRefresh?: TokenRefreshHandler
): Promise<{ platformPostId: string; stats?: YouTubeVideoStats }> {
  return withTokenRefresh(accessToken, refreshToken, onTokenRefresh, async (token) => {
    const videoBuffer = await fetchMediaBuffer(mediaUrl);
    if (videoBuffer.length === 0) {
      throw new Error("Video file is empty");
    }

    const platformPostId = await resumableUpload(
      token,
      videoBuffer,
      title,
      caption
    );

    let stats: YouTubeVideoStats | undefined;
    try {
      stats = await fetchYouTubeVideoStats(token, platformPostId);
    } catch {
      // Stats may not be available immediately after upload
    }

    return { platformPostId, stats };
  });
}
