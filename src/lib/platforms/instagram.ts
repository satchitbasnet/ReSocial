import { getAppUrl } from "@/lib/config";

const IG_GRAPH_VERSION = "v21.0";
const IG_GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;
const FB_GRAPH_VERSION = "v18.0";
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

const IG_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

/** Instagram API with Instagram Login. */
const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
].join(",");

export interface MetaTokens {
  accessToken: string;
  expiresIn: number;
  userId: string;
}

export interface InstagramAccountInfo {
  igUserId: string;
  displayName: string;
  followerCount: number;
  accountType?: string;
  /** Legacy Facebook Login connections only. */
  pageId?: string;
  pageAccessToken?: string;
}

export interface InstagramVideoStats {
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

export const INSTAGRAM_PERSONAL_ACCOUNT_NOTICE =
  "A Creator or Business Instagram account is required to connect.";

class InstagramApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

function getInstagramCredentials() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET must be set"
    );
  }
  return { clientId, clientSecret };
}

export function getInstagramRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/instagram`;
}

/** True when account was connected via legacy Facebook Login + Page flow. */
export function isLegacyInstagramAccountId(accountId: string | null): boolean {
  if (!accountId) return false;
  const parts = accountId.split(":");
  return parts.length >= 2 && Boolean(parts[1]);
}

export function getInstagramUserId(accountId: string | null): string | null {
  if (!accountId) return null;
  return accountId.split(":")[0] || null;
}

export function buildInstagramAuthUrl(state: string): string {
  const { clientId } = getInstagramCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getInstagramRedirectUri(),
    response_type: "code",
    scope: INSTAGRAM_SCOPES,
    state,
    enable_fb_login: "false",
  });
  return `${IG_AUTH_URL}?${params.toString()}`;
}

function parseTokenExchangeBody(body: Record<string, unknown>): {
  accessToken: string;
  userId: string;
} {
  if (Array.isArray(body.data) && body.data[0]) {
    const row = body.data[0] as { access_token?: string; user_id?: string };
    if (row.access_token && row.user_id) {
      return { accessToken: row.access_token, userId: String(row.user_id) };
    }
  }
  if (typeof body.access_token === "string" && body.user_id) {
    return {
      accessToken: body.access_token,
      userId: String(body.user_id),
    };
  }
  throw new Error(
    (body.error_message as string) ||
      (body as { error?: { message?: string } }).error?.message ||
      "Instagram token exchange failed"
  );
}

export async function exchangeInstagramCode(code: string): Promise<MetaTokens> {
  const { clientId, clientSecret } = getInstagramCredentials();
  const cleanCode = code.replace(/#_$/, "");

  const res = await fetch(IG_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: getInstagramRedirectUri(),
      code: cleanCode,
    }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (body.error_message as string) || "Instagram token exchange failed"
    );
  }

  const short = parseTokenExchangeBody(body);

  const longRes = await fetch(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: clientSecret,
      access_token: short.accessToken,
    })}`
  );
  const longBody = (await longRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!longRes.ok || !longBody.access_token) {
    return {
      accessToken: short.accessToken,
      expiresIn: 3600,
      userId: short.userId,
    };
  }

  return {
    accessToken: longBody.access_token,
    expiresIn: longBody.expires_in ?? 5184000,
    userId: short.userId,
  };
}

async function igGraphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${IG_GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (res.status === 401 || body.error?.code === 190) {
    throw new InstagramApiError("Instagram access token expired", 401);
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Instagram API error (${res.status})`);
  }
  return body as T;
}

async function fbGraphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${FB_GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (res.status === 401 || body.error?.code === 190) {
    throw new InstagramApiError("Instagram access token expired", 401);
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API error (${res.status})`);
  }
  return body as T;
}

async function igGraphPost<T>(
  path: string,
  accessToken: string,
  data: Record<string, string | boolean>
): Promise<T> {
  const res = await fetch(`${IG_GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, access_token: accessToken }),
  });
  const body = await res.json();
  if (res.status === 401 || body.error?.code === 190) {
    throw new InstagramApiError("Instagram access token expired", 401);
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Instagram API POST failed (${res.status})`);
  }
  return body as T;
}

async function fbGraphPost<T>(
  path: string,
  accessToken: string,
  data: Record<string, string | boolean>
): Promise<T> {
  const res = await fetch(`${FB_GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, access_token: accessToken }),
  });
  const body = await res.json();
  if (res.status === 401 || body.error?.code === 190) {
    throw new InstagramApiError("Instagram access token expired", 401);
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API POST failed (${res.status})`);
  }
  return body as T;
}

export async function fetchInstagramAccountInfo(
  accessToken: string,
  igUserId: string
): Promise<InstagramAccountInfo> {
  const profile = await igGraphGet<{
    username?: string;
    name?: string;
    followers_count?: number;
    account_type?: string;
  }>(
    `/${igUserId}?fields=username,name,followers_count,account_type`,
    accessToken
  );

  const accountType = profile.account_type?.toUpperCase() ?? "";
  if (
    accountType &&
    !["BUSINESS", "CREATOR", "MEDIA_CREATOR"].includes(accountType)
  ) {
    throw new Error(
      "This Instagram account is not a Professional Creator or Business account. Personal accounts cannot use the publishing API."
    );
  }

  return {
    igUserId,
    displayName: profile.username || profile.name || igUserId,
    followerCount: profile.followers_count ?? 0,
    accountType: profile.account_type,
  };
}

/** Legacy Facebook Login + Page lookup (kept for existing connections). */
export async function fetchLegacyInstagramAccountInfo(
  accessToken: string
): Promise<InstagramAccountInfo> {
  const pages = await fbGraphGet<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  }>(
    "/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100",
    accessToken
  );

  if (!pages.data?.length) {
    throw new Error(
      "No Facebook Page found. Reconnect using Instagram Login instead (Creator accounts do not need a Page)."
    );
  }

  const page = pages.data.find((p) => p.instagram_business_account?.id);
  if (!page?.instagram_business_account) {
    throw new Error(
      "No Instagram Professional account linked to your Facebook Page."
    );
  }

  const igUserId = page.instagram_business_account.id;
  const profile = await fbGraphGet<{
    username: string;
    followers_count?: number;
  }>(`/${igUserId}?fields=username,followers_count`, page.access_token);

  return {
    igUserId,
    pageId: page.id,
    displayName: profile.username || page.name,
    followerCount: profile.followers_count ?? 0,
    pageAccessToken: page.access_token,
  };
}

export async function fetchInstagramAccountInsights(
  igUserId: string,
  accessToken: string,
  useInstagramGraph = true
): Promise<{ reach: number; impressions: number }> {
  try {
    const graphGet = useInstagramGraph ? igGraphGet : fbGraphGet;
    const insights = await graphGet<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(
      `/${igUserId}/insights?metric=reach,impressions&period=day`,
      accessToken
    );

    const get = (name: string) =>
      insights.data?.find((m) => m.name === name)?.values?.[0]?.value ?? 0;

    return { reach: get("reach"), impressions: get("impressions") };
  } catch {
    return { reach: 0, impressions: 0 };
  }
}

export async function fetchInstagramMediaStats(
  mediaId: string,
  accessToken: string,
  useInstagramGraph = true
): Promise<InstagramVideoStats> {
  try {
    const graphGet = useInstagramGraph ? igGraphGet : fbGraphGet;
    const insights = await graphGet<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(
      `/${mediaId}/insights?metric=reach,views,likes,comments,shares,saved`,
      accessToken
    );

    const get = (name: string) =>
      insights.data?.find((m) => m.name === name)?.values?.[0]?.value ?? 0;

    const views = get("views") || get("reach");
    const likes = get("likes");
    const comments = get("comments");
    const shares = get("shares");
    const saves = get("saved");
    const engagements = likes + comments + shares + saves;
    const engagementRate =
      views > 0 ? Math.round((engagements / views) * 10000) : 0;

    return { views, likes, comments, shares, saves, engagementRate };
  } catch {
    return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 };
  }
}

async function waitForInstagramContainer(
  creationId: string,
  accessToken: string,
  useInstagramGraph: boolean
): Promise<void> {
  const graphGet = useInstagramGraph ? igGraphGet : fbGraphGet;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await graphGet<{ status_code: string }>(
      `/${creationId}?fields=status_code`,
      accessToken
    );
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error("Instagram media container processing failed");
    }
    if (i === 29) {
      throw new Error("Instagram media processing timed out");
    }
  }
}

async function publishInstagramContainer(
  igUserId: string,
  accessToken: string,
  creationId: string,
  useInstagramGraph: boolean
): Promise<{ platformPostId: string; stats?: InstagramVideoStats }> {
  const graphPost = useInstagramGraph ? igGraphPost : fbGraphPost;

  await waitForInstagramContainer(creationId, accessToken, useInstagramGraph);

  const publish = await graphPost<{ id: string }>(
    `/${igUserId}/media_publish`,
    accessToken,
    { creation_id: creationId }
  );

  const platformPostId = publish.id;
  const stats = await fetchInstagramMediaStats(
    platformPostId,
    accessToken,
    useInstagramGraph
  );

  return { platformPostId, stats };
}

async function resolveInstagramPublishContext(
  accessToken: string,
  accountId: string,
  storedPageAccessToken?: string | null
): Promise<{
  igUserId: string;
  token: string;
  useInstagramGraph: boolean;
}> {
  const igUserId = getInstagramUserId(accountId);
  if (!igUserId) {
    throw new Error("Invalid Instagram account ID format");
  }

  if (isLegacyInstagramAccountId(accountId)) {
    const [, pageId] = accountId.split(":");
    let pageAccessToken = storedPageAccessToken ?? null;

    if (!pageAccessToken) {
      const pages = await fbGraphGet<{
        data: Array<{ id: string; access_token: string }>;
      }>("/me/accounts?fields=id,access_token", accessToken);

      const page = pages.data?.find((p) => p.id === pageId);
      if (!page) {
        throw new Error("Facebook Page access lost. Reconnect Instagram.");
      }
      pageAccessToken = page.access_token;
    }

    return { igUserId, token: pageAccessToken, useInstagramGraph: false };
  }

  return { igUserId, token: accessToken, useInstagramGraph: true };
}

async function publishReel(
  igUserId: string,
  accessToken: string,
  mediaUrl: string,
  caption: string,
  useInstagramGraph: boolean
): Promise<{ platformPostId: string; stats?: InstagramVideoStats }> {
  const graphPost = useInstagramGraph ? igGraphPost : fbGraphPost;

  const container = await graphPost<{ id: string }>(`/${igUserId}/media`, accessToken, {
    media_type: "REELS",
    video_url: mediaUrl,
    caption: caption.slice(0, 2200),
    share_to_feed: true,
  });

  const creationId = container.id;
  return publishInstagramContainer(
    igUserId,
    accessToken,
    creationId,
    useInstagramGraph
  );
}

export async function publishPhotosToInstagram(
  accessToken: string,
  accountId: string | null,
  imageUrls: string[],
  caption: string,
  storedPageAccessToken?: string | null
): Promise<{ platformPostId: string; stats?: InstagramVideoStats }> {
  if (!accountId) {
    throw new Error("Instagram account ID missing");
  }

  const urls = imageUrls.filter((u) => u.startsWith("https://"));
  if (urls.length === 0) {
    throw new Error(
      "Instagram requires public HTTPS image URLs. Upload media to storage first."
    );
  }
  if (urls.length > 10) {
    throw new Error("Instagram carousels support up to 10 images.");
  }

  const { igUserId, token, useInstagramGraph } =
    await resolveInstagramPublishContext(
      accessToken,
      accountId,
      storedPageAccessToken
    );
  const graphPost = useInstagramGraph ? igGraphPost : fbGraphPost;

  if (urls.length === 1) {
    const container = await graphPost<{ id: string }>(
      `/${igUserId}/media`,
      token,
      {
        image_url: urls[0],
        caption: caption.slice(0, 2200),
      }
    );
    return publishInstagramContainer(
      igUserId,
      token,
      container.id,
      useInstagramGraph
    );
  }

  const childIds: string[] = [];
  for (const imageUrl of urls) {
    const child = await graphPost<{ id: string }>(`/${igUserId}/media`, token, {
      image_url: imageUrl,
      is_carousel_item: true,
    });
    childIds.push(child.id);
    await waitForInstagramContainer(child.id, token, useInstagramGraph);
  }

  const carousel = await graphPost<{ id: string }>(`/${igUserId}/media`, token, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: caption.slice(0, 2200),
  });

  return publishInstagramContainer(
    igUserId,
    token,
    carousel.id,
    useInstagramGraph
  );
}

export async function publishVideoToInstagram(
  accessToken: string,
  accountId: string | null,
  mediaUrl: string,
  caption: string,
  storedPageAccessToken?: string | null
): Promise<{ platformPostId: string; stats?: InstagramVideoStats }> {
  if (!accountId) {
    throw new Error("Instagram account ID missing");
  }

  if (!mediaUrl.startsWith("https://")) {
    throw new Error(
      "Instagram requires a public HTTPS video URL. Upload media to R2 first."
    );
  }

  const { igUserId, token, useInstagramGraph } =
    await resolveInstagramPublishContext(
      accessToken,
      accountId,
      storedPageAccessToken
    );

  return publishReel(igUserId, token, mediaUrl, caption, useInstagramGraph);
}

export interface InstagramSourceMedia {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaType: "video" | "image" | "carousel";
  timestamp: string;
}

async function fetchInstagramCarouselUrls(
  mediaId: string,
  accessToken: string
): Promise<string[]> {
  const res = await igGraphGet<{
    children?: { data?: Array<{ media_url?: string; media_type?: string }> };
  }>(
    `/${mediaId}?fields=children{media_url,media_type}`,
    accessToken
  );

  return (res.children?.data ?? [])
    .filter((c) => c.media_url && c.media_type === "IMAGE")
    .map((c) => c.media_url!);
}

/** Fetch recent IG media for Repurpose source polling (Instagram Login API). */
export async function fetchInstagramRecentMedia(
  accessToken: string,
  igUserId: string,
  limit = 10
): Promise<InstagramSourceMedia[]> {
  const res = await igGraphGet<{
    data: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      media_url?: string;
      timestamp?: string;
    }>;
  }>(
    `/${igUserId}/media?fields=id,caption,media_type,media_url,timestamp&limit=${limit}`,
    accessToken
  );

  const items = (res.data ?? []).filter((m) =>
    ["VIDEO", "REELS", "IMAGE", "CAROUSEL_ALBUM"].includes(m.media_type ?? "")
  );

  const mapped: InstagramSourceMedia[] = [];

  for (const m of items) {
    if (m.media_type === "CAROUSEL_ALBUM") {
      const urls = await fetchInstagramCarouselUrls(m.id, accessToken);
      if (urls.length === 0) continue;
      mapped.push({
        id: m.id,
        caption: m.caption ?? "",
        mediaUrl: urls[0],
        mediaUrls: urls,
        mediaType: "carousel",
        timestamp: m.timestamp ?? new Date().toISOString(),
      });
      continue;
    }

    if (!m.media_url) continue;

    mapped.push({
      id: m.id,
      caption: m.caption ?? "",
      mediaUrl: m.media_url,
      mediaType:
        m.media_type === "IMAGE" ? ("image" as const) : ("video" as const),
      timestamp: m.timestamp ?? new Date().toISOString(),
    });
  }

  return mapped;
}
