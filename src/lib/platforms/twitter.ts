import { createHash, randomBytes } from "crypto";
import { getAppUrl } from "@/lib/config";
import { fetchMediaBuffer } from "@/lib/r2";

const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const TWITTER_USER_URL = "https://api.twitter.com/2/users/me";
const TWITTER_TWEET_URL = "https://api.twitter.com/2/tweets";
const TWITTER_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";

const TWITTER_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
  "media.write",
].join(" ");

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB (under X's 5 MB APPEND limit)

export interface TwitterTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}

export interface TwitterUserInfo {
  id: string;
  username: string;
  name: string;
}

export type TokenRefreshHandler = (
  accessToken: string,
  refreshToken: string
) => Promise<void>;

function getTwitterCredentials() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getTwitterRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/twitter`;
}

export interface TwitterPkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** X OAuth 2.0 PKCE: S256 code_challenge as base64url(SHA256(verifier)). */
export function generateTwitterPkce(): TwitterPkcePair {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = randomBytes(64);
  let codeVerifier = "";
  for (let i = 0; i < 64; i++) {
    codeVerifier += charset[bytes[i] % charset.length];
  }
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildTwitterAuthUrl(
  state: string,
  codeChallenge: string
): string {
  const { clientId } = getTwitterCredentials();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getTwitterRedirectUri(),
    scope: TWITTER_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${TWITTER_AUTH_URL}?${params.toString()}`;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function parseTokenResponse(res: Response): Promise<TwitterTokens> {
  const body = await res.json();
  if (!res.ok || body.error) {
    const msg =
      body.error_description || body.error || body.message || "Token request failed";
    throw new Error(typeof msg === "string" ? msg : "Token request failed");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? "",
    expiresIn: body.expires_in,
    scope: body.scope ?? "",
    tokenType: body.token_type ?? "bearer",
  };
}

export async function exchangeTwitterCode(
  code: string,
  codeVerifier: string
): Promise<TwitterTokens> {
  const { clientId, clientSecret } = getTwitterCredentials();

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: getTwitterRedirectUri(),
      code_verifier: codeVerifier,
    }),
  });

  return parseTokenResponse(res);
}

export async function refreshTwitterToken(
  refreshToken: string
): Promise<TwitterTokens> {
  const { clientId, clientSecret } = getTwitterCredentials();

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  return parseTokenResponse(res);
}

export async function fetchTwitterUserInfo(
  accessToken: string
): Promise<TwitterUserInfo> {
  const res = await fetch(
    `${TWITTER_USER_URL}?user.fields=id,name,username`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const body = await res.json();
  if (!res.ok || !body.data?.id) {
    throw new Error(
      body.detail || body.title || "Failed to fetch X user info"
    );
  }

  return {
    id: body.data.id,
    username: body.data.username,
    name: body.data.name ?? body.data.username,
  };
}

class TwitterApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "TwitterApiError";
  }
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
      err instanceof TwitterApiError &&
      err.status === 401 &&
      refreshToken &&
      onRefresh
    ) {
      const tokens = await refreshTwitterToken(refreshToken);
      await onRefresh(tokens.accessToken, tokens.refreshToken);
      return fn(tokens.accessToken);
    }
    throw err;
  }
}

function mimeFromUrl(mediaUrl: string, mediaTypeHint?: string): string {
  if (mediaTypeHint === "image" || mediaTypeHint === "carousel") {
    const lower = mediaUrl.toLowerCase();
    if (lower.includes(".png")) return "image/png";
    if (lower.includes(".gif")) return "image/gif";
    return "image/jpeg";
  }
  if (mediaTypeHint === "video") return "video/mp4";
  const lower = mediaUrl.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".mov")) return "video/quicktime";
  if (lower.includes(".webm")) return "video/webm";
  return "video/mp4";
}

function mediaCategory(mime: string): "tweet_image" | "tweet_gif" | "tweet_video" {
  if (mime === "image/gif") return "tweet_gif";
  if (mime.startsWith("image/")) return "tweet_image";
  return "tweet_video";
}

interface MediaUploadResponse {
  data?: {
    id?: string;
    media_id_string?: string;
    processing_info?: {
      state: string;
      check_after_secs?: number;
      error?: { message?: string };
    };
  };
  media_id_string?: string;
  processing_info?: {
    state: string;
    check_after_secs?: number;
    error?: { message?: string };
  };
  errors?: Array<{ message?: string; detail?: string }>;
  title?: string;
  detail?: string;
}

function extractMediaId(body: MediaUploadResponse): string | null {
  return (
    body.data?.id ??
    body.data?.media_id_string ??
    body.media_id_string ??
    null
  );
}

function extractProcessingInfo(body: MediaUploadResponse) {
  return body.data?.processing_info ?? body.processing_info;
}

async function initMediaUpload(
  accessToken: string,
  totalBytes: number,
  mime: string
): Promise<string> {
  const form = new FormData();
  form.append("command", "INIT");
  form.append("total_bytes", String(totalBytes));
  form.append("media_type", mime);
  form.append("media_category", mediaCategory(mime));

  const res = await fetch(TWITTER_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const body: MediaUploadResponse = await res.json();
  if (res.status === 401) {
    throw new TwitterApiError("X access token expired", 401);
  }
  const mediaId = extractMediaId(body);
  if (!res.ok || !mediaId) {
    throw new Error(
      body.errors?.[0]?.message ||
        body.detail ||
        body.title ||
        `X media INIT failed (${res.status})`
    );
  }
  return mediaId;
}

async function appendMediaChunk(
  accessToken: string,
  mediaId: string,
  segmentIndex: number,
  chunk: Buffer
): Promise<void> {
  const form = new FormData();
  form.append("command", "APPEND");
  form.append("media_id", mediaId);
  form.append("segment_index", String(segmentIndex));
  form.append(
    "media",
    new Blob([new Uint8Array(chunk)]),
    `chunk-${segmentIndex}`
  );

  const res = await fetch(TWITTER_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (res.status === 401) {
    throw new TwitterApiError("X access token expired", 401);
  }
  // APPEND returns 2xx with empty/minimal body on success
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X media APPEND failed: ${res.status} ${text}`);
  }
}

async function finalizeMediaUpload(
  accessToken: string,
  mediaId: string
): Promise<MediaUploadResponse> {
  const form = new FormData();
  form.append("command", "FINALIZE");
  form.append("media_id", mediaId);

  const res = await fetch(TWITTER_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const body: MediaUploadResponse = await res.json();
  if (res.status === 401) {
    throw new TwitterApiError("X access token expired", 401);
  }
  if (!res.ok) {
    throw new Error(
      body.errors?.[0]?.message ||
        body.detail ||
        body.title ||
        `X media FINALIZE failed (${res.status})`
    );
  }
  return body;
}

async function waitForMediaProcessing(
  accessToken: string,
  mediaId: string,
  initial?: MediaUploadResponse
): Promise<void> {
  let info = initial ? extractProcessingInfo(initial) : undefined;

  for (let attempt = 0; attempt < 60; attempt++) {
    if (!info) return;
    if (info.state === "succeeded") return;
    if (info.state === "failed") {
      throw new Error(info.error?.message || "X media processing failed");
    }

    const waitSecs = Math.max(info.check_after_secs ?? 2, 1);
    await new Promise((r) => setTimeout(r, waitSecs * 1000));

    const res = await fetch(
      `${TWITTER_MEDIA_UPLOAD_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const body: MediaUploadResponse = await res.json();
    if (res.status === 401) {
      throw new TwitterApiError("X access token expired", 401);
    }
    if (!res.ok) {
      throw new Error(
        body.errors?.[0]?.message ||
          body.detail ||
          `X media STATUS failed (${res.status})`
      );
    }
    info = extractProcessingInfo(body);
  }

  throw new Error("X media processing timed out");
}

async function uploadMedia(
  accessToken: string,
  mediaUrl: string,
  mediaTypeHint?: string
): Promise<string> {
  const buffer = await fetchMediaBuffer(mediaUrl);
  if (buffer.length === 0) {
    throw new Error("Media file is empty");
  }

  const mime = mimeFromUrl(mediaUrl, mediaTypeHint);
  const mediaId = await initMediaUpload(accessToken, buffer.length, mime);

  const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.length);
    await appendMediaChunk(accessToken, mediaId, i, buffer.subarray(start, end));
  }

  const finalized = await finalizeMediaUpload(accessToken, mediaId);
  await waitForMediaProcessing(accessToken, mediaId, finalized);
  return mediaId;
}

async function createTweet(
  accessToken: string,
  text: string,
  mediaIds?: string[]
): Promise<string> {
  const payload: {
    text: string;
    media?: { media_ids: string[] };
  } = {
    text: text.slice(0, 280),
  };
  if (mediaIds?.length) {
    payload.media = { media_ids: mediaIds };
  }

  const res = await fetch(TWITTER_TWEET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (res.status === 401) {
    throw new TwitterApiError("X access token expired", 401);
  }
  if (!res.ok || !body.data?.id) {
    throw new Error(
      body.errors?.[0]?.message ||
        body.detail ||
        body.title ||
        `X tweet create failed (${res.status})`
    );
  }
  return body.data.id as string;
}

export async function publishToTwitter(
  accessToken: string,
  refreshToken: string | null,
  mediaUrl: string,
  caption: string,
  onTokenRefresh?: TokenRefreshHandler,
  mediaTypeHint?: string,
  extraMediaUrls?: string[]
): Promise<{ platformPostId: string }> {
  return withTokenRefresh(
    accessToken,
    refreshToken,
    onTokenRefresh,
    async (token) => {
      const urls = [mediaUrl, ...(extraMediaUrls ?? [])].filter(Boolean);
      // X allows up to 4 images, or 1 video/gif
      const isVideo =
        mediaTypeHint === "video" ||
        mimeFromUrl(mediaUrl, mediaTypeHint).startsWith("video/");
      const limited = isVideo ? urls.slice(0, 1) : urls.slice(0, 4);

      const mediaIds: string[] = [];
      for (const url of limited) {
        mediaIds.push(await uploadMedia(token, url, mediaTypeHint));
      }

      const platformPostId = await createTweet(token, caption, mediaIds);
      return { platformPostId };
    }
  );
}
