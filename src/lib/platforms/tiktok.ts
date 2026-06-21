import { createHash, randomBytes } from "crypto";
import { getAppUrl } from "@/lib/config";
import { fetchMediaBuffer } from "@/lib/r2";

const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USER_INFO_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,union_id";
const TIKTOK_CREATOR_INFO_URL =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const TIKTOK_VIDEO_INIT_URL =
  "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TIKTOK_PUBLISH_STATUS_URL =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const TIKTOK_SCOPES = ["user.info.basic", "video.publish"].join(",");
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresIn: number;
  refreshExpiresIn: number;
  scope: string;
}

export interface TikTokUserInfo {
  openId: string;
  displayName: string;
}

interface TikTokApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    log_id?: string;
  };
}

function getTikTokCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set");
  }
  return { clientKey, clientSecret };
}

export function getTikTokRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/tiktok`;
}

export interface TikTokPkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** TikTok PKCE: SHA256(code_verifier) as lowercase hex (not base64url). */
export function generateTikTokPkce(): TikTokPkcePair {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = randomBytes(64);
  let codeVerifier = "";
  for (let i = 0; i < 64; i++) {
    codeVerifier += charset[bytes[i] % charset.length];
  }
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("hex");
  return { codeVerifier, codeChallenge };
}

export function buildTikTokAuthUrl(
  state: string,
  codeChallenge: string
): string {
  const { clientKey } = getTikTokCredentials();
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: TIKTOK_SCOPES,
    redirect_uri: getTikTokRedirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

async function parseTokenResponse(res: Response): Promise<TikTokTokens> {
  const body = await res.json();
  if (!res.ok || body.error) {
    const msg =
      body.error_description ||
      body.error?.message ||
      body.message ||
      "Token request failed";
    throw new Error(msg);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    openId: body.open_id,
    expiresIn: body.expires_in,
    refreshExpiresIn: body.refresh_expires_in,
    scope: body.scope,
  };
}

export async function exchangeTikTokCode(
  code: string,
  codeVerifier: string
): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getTikTokCredentials();

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getTikTokRedirectUri(),
      code_verifier: codeVerifier,
    }),
  });

  return parseTokenResponse(res);
}

export async function refreshTikTokToken(
  refreshToken: string
): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getTikTokCredentials();

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  return parseTokenResponse(res);
}

export async function fetchTikTokUserInfo(
  accessToken: string
): Promise<TikTokUserInfo> {
  const res = await fetch(TIKTOK_USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body: TikTokApiResponse<{
    user: { open_id: string; display_name: string };
  }> = await res.json();

  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Failed to fetch TikTok user info");
  }

  return {
    openId: body.data!.user.open_id,
    displayName: body.data!.user.display_name,
  };
}

export type TokenRefreshHandler = (
  accessToken: string,
  refreshToken: string
) => Promise<void>;

class TikTokApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "TikTokApiError";
  }
}

async function tiktokFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  return res;
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
      err instanceof TikTokApiError &&
      err.status === 401 &&
      refreshToken &&
      onRefresh
    ) {
      const tokens = await refreshTikTokToken(refreshToken);
      await onRefresh(tokens.accessToken, tokens.refreshToken);
      return fn(tokens.accessToken);
    }
    throw err;
  }
}

async function checkTikTokResponse<T>(
  res: Response,
  body: TikTokApiResponse<T>
): Promise<void> {
  if (
    res.status === 401 ||
    body.error?.code === "access_token_invalid"
  ) {
    throw new TikTokApiError("TikTok access token expired", 401);
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `TikTok API error (${res.status})`);
  }
}

async function queryCreatorPrivacyLevel(
  accessToken: string
): Promise<string> {
  const res = await tiktokFetch(TIKTOK_CREATOR_INFO_URL, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({}),
  });

  const body: TikTokApiResponse<{
    privacy_level_options: string[];
  }> = await res.json();

  await checkTikTokResponse(res, body);

  const options = body.data?.privacy_level_options ?? ["SELF_ONLY"];
  if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  if (options.includes("MUTUAL_FOLLOW_FRIENDS")) return "MUTUAL_FOLLOW_FRIENDS";
  return options[0] ?? "SELF_ONLY";
}

async function uploadVideoChunks(
  uploadUrl: string,
  videoBuffer: Buffer
): Promise<void> {
  const videoSize = videoBuffer.length;
  const chunkSize = Math.min(CHUNK_SIZE, videoSize);
  const totalChunks = Math.ceil(videoSize / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, videoSize) - 1;
    const chunk = videoBuffer.subarray(start, end + 1);

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      },
      body: new Uint8Array(chunk),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TikTok video upload failed: ${res.status} ${text}`);
    }
  }
}

async function waitForPublish(
  accessToken: string,
  publishId: string
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await tiktokFetch(TIKTOK_PUBLISH_STATUS_URL, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const body: TikTokApiResponse<{
      status: string;
      fail_reason?: string;
      publicaly_available_post_id?: string[];
    }> = await res.json();

    if (
      res.status === 401 ||
      body.error?.code === "access_token_invalid"
    ) {
      throw new TikTokApiError("TikTok access token expired", 401);
    }

    const status = body.data?.status;
    if (status === "PUBLISH_COMPLETE") {
      return body.data?.publicaly_available_post_id?.[0] ?? publishId;
    }
    if (status === "FAILED") {
      throw new Error(
        body.data?.fail_reason || "TikTok publish failed"
      );
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error("TikTok publish timed out");
}

export async function publishVideoToTikTok(
  accessToken: string,
  refreshToken: string | null,
  mediaUrl: string,
  caption: string,
  onTokenRefresh?: TokenRefreshHandler
): Promise<{ platformPostId: string }> {
  return withTokenRefresh(accessToken, refreshToken, onTokenRefresh, async (token) => {
    const videoBuffer = await fetchMediaBuffer(mediaUrl);
    const videoSize = videoBuffer.length;

    if (videoSize === 0) {
      throw new Error("Video file is empty");
    }

    const privacyLevel = await queryCreatorPrivacyLevel(token);
    const chunkSize = Math.min(CHUNK_SIZE, videoSize);
    const totalChunkCount = Math.ceil(videoSize / chunkSize);

    const initRes = await tiktokFetch(TIKTOK_VIDEO_INIT_URL, token, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        post_info: {
          title: caption.slice(0, 2200),
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
      }),
    });

    const initBody: TikTokApiResponse<{
      publish_id: string;
      upload_url: string;
    }> = await initRes.json();

    await checkTikTokResponse(initRes, initBody);

    const { publish_id, upload_url } = initBody.data!;
    await uploadVideoChunks(upload_url, videoBuffer);
    const platformPostId = await waitForPublish(token, publish_id);

    return { platformPostId };
  });
}
