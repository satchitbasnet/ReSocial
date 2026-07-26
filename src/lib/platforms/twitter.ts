import { createHash, randomBytes } from "crypto";
import { getAppUrl } from "@/lib/config";
import { fetchMediaBuffer } from "@/lib/r2";

const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const TWITTER_ME_URL = "https://api.twitter.com/2/users/me";
const TWITTER_TWEETS_URL = "https://api.twitter.com/2/tweets";
const TWITTER_MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

const TWITTER_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
  "media.write",
].join(" ");

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB — under X's ~5 MB APPEND limit

export interface TwitterTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
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

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

/** OAuth 2.0 PKCE: S256 challenge as base64url (Twitter/X standard). */
export function generateTwitterPkce(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = randomBytes(32).toString("base64url");
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

async function parseTokenResponse(res: Response): Promise<TwitterTokens> {
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(
      body.error_description || body.error || "Twitter token request failed"
    );
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? "",
    expiresIn: body.expires_in ?? 7200,
    scope: body.scope ?? "",
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
    }),
  });

  return parseTokenResponse(res);
}

export async function fetchTwitterUserInfo(
  accessToken: string
): Promise<TwitterUserInfo> {
  const res = await fetch(`${TWITTER_ME_URL}?user.fields=name,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok || !body.data?.id) {
    throw new Error(body.detail || body.title || "Failed to fetch X user info");
  }
  return {
    id: body.data.id,
    username: body.data.username,
    name: body.data.name || body.data.username,
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

function detectMediaCategory(
  mime: string,
  isVideo: boolean
): { mediaType: string; mediaCategory: string } {
  if (isVideo) {
    return { mediaType: "video/mp4", mediaCategory: "tweet_video" };
  }
  if (mime.includes("gif")) {
    return { mediaType: "image/gif", mediaCategory: "tweet_gif" };
  }
  if (mime.includes("png")) {
    return { mediaType: "image/png", mediaCategory: "tweet_image" };
  }
  if (mime.includes("webp")) {
    return { mediaType: "image/webp", mediaCategory: "tweet_image" };
  }
  return { mediaType: "image/jpeg", mediaCategory: "tweet_image" };
}

function guessMimeFromUrl(url: string, isVideo: boolean): string {
  const lower = url.toLowerCase();
  if (isVideo) return "video/mp4";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

async function mediaCommand(
  accessToken: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(TWITTER_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new TwitterApiError("X access token expired", 401);
  }
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        (body as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ||
        `X media upload failed (${res.status})`
    );
  }
  return body as Record<string, unknown>;
}

async function appendChunk(
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
    `chunk_${segmentIndex}.bin`
  );

  const res = await fetch(TWITTER_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (res.status === 401) {
    throw new TwitterApiError("X access token expired", 401);
  }
  // APPEND returns 2xx with empty body on success
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X media APPEND failed: ${res.status} ${text}`);
  }
}

async function waitForMediaProcessing(
  accessToken: string,
  mediaId: string
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = await fetch(
      `${TWITTER_MEDIA_UPLOAD_URL}?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const body = await res.json();
    if (res.status === 401) {
      throw new TwitterApiError("X access token expired", 401);
    }

    const info = body.processing_info as
      | { state?: string; check_after_secs?: number; error?: { message?: string } }
      | undefined;

    if (!info) return;

    if (info.state === "succeeded") return;
    if (info.state === "failed") {
      throw new Error(info.error?.message || "X media processing failed");
    }

    const wait = Math.max(1, info.check_after_secs ?? 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error("X media processing timed out");
}

async function uploadMedia(
  accessToken: string,
  buffer: Buffer,
  mediaType: string,
  mediaCategory: string
): Promise<string> {
  const init = await mediaCommand(accessToken, {
    command: "INIT",
    total_bytes: String(buffer.length),
    media_type: mediaType,
    media_category: mediaCategory,
  });

  const mediaId = String(init.media_id_string || init.media_id);
  if (!mediaId || mediaId === "undefined") {
    throw new Error("X media INIT did not return media_id");
  }

  const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.length);
    await appendChunk(accessToken, mediaId, i, buffer.subarray(start, end));
  }

  await mediaCommand(accessToken, {
    command: "FINALIZE",
    media_id: mediaId,
  });

  if (mediaCategory === "tweet_video" || mediaCategory === "tweet_gif") {
    await waitForMediaProcessing(accessToken, mediaId);
  }

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

  const res = await fetch(TWITTER_TWEETS_URL, {
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
      body.detail ||
        body.title ||
        body.errors?.[0]?.message ||
        `X tweet failed (${res.status})`
    );
  }
  return body.data.id as string;
}

/** Publish text and optional media (image or video) to X. */
export async function publishToTwitter(
  accessToken: string,
  refreshToken: string | null,
  mediaUrl: string | null,
  caption: string,
  options?: {
    mediaType?: string;
    mediaUrls?: string[];
    onTokenRefresh?: TokenRefreshHandler;
  }
): Promise<{ platformPostId: string }> {
  return withTokenRefresh(
    accessToken,
    refreshToken,
    options?.onTokenRefresh,
    async (token) => {
      const mediaIds: string[] = [];
      const urls =
        options?.mediaUrls?.length
          ? options.mediaUrls
          : mediaUrl
            ? [mediaUrl]
            : [];

      // X allows up to 4 images, or 1 video/gif
      const isVideo =
        options?.mediaType === "video" ||
        urls.some((u) => /\.(mp4|mov|webm)(\?|$)/i.test(u));

      if (isVideo && urls[0]) {
        const buffer = await fetchMediaBuffer(urls[0]);
        const mime = guessMimeFromUrl(urls[0], true);
        const { mediaType, mediaCategory } = detectMediaCategory(mime, true);
        const id = await uploadMedia(token, buffer, mediaType, mediaCategory);
        mediaIds.push(id);
      } else {
        for (const url of urls.slice(0, 4)) {
          const buffer = await fetchMediaBuffer(url);
          const mime = guessMimeFromUrl(url, false);
          const { mediaType, mediaCategory } = detectMediaCategory(mime, false);
          const id = await uploadMedia(token, buffer, mediaType, mediaCategory);
          mediaIds.push(id);
        }
      }

      const platformPostId = await createTweet(
        token,
        caption,
        mediaIds.length ? mediaIds : undefined
      );
      return { platformPostId };
    }
  );
}
