import { getAppUrl } from "@/lib/config";

const GRAPH_VERSION = "v18.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const META_AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

export interface MetaTokens {
  accessToken: string;
  expiresIn: number;
}

export interface InstagramAccountInfo {
  igUserId: string;
  pageId: string;
  displayName: string;
  followerCount: number;
  pageAccessToken: string;
  reach?: number;
  impressions?: number;
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

export function buildInstagramAuthUrl(state: string): string {
  const { clientId } = getInstagramCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getInstagramRedirectUri(),
    response_type: "code",
    scope: INSTAGRAM_SCOPES,
    state,
    display: "page",
    extras: JSON.stringify({ setup: { channel: "IG_API_ONBOARDING" } }),
  });
  return `${META_AUTH_URL}?${params.toString()}`;
}

export async function exchangeInstagramCode(code: string): Promise<MetaTokens> {
  const { clientId, clientSecret } = getInstagramCredentials();

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getInstagramRedirectUri(),
      code,
    }),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Instagram token exchange failed");
  }

  const longLived = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: body.access_token,
    }),
  });
  const longBody = await longLived.json();
  if (!longLived.ok || longBody.error) {
    return { accessToken: body.access_token, expiresIn: body.expires_in };
  }
  return {
    accessToken: longBody.access_token,
    expiresIn: longBody.expires_in,
  };
}

async function graphGet<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const url = `${GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
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

export async function fetchInstagramAccountInfo(
  accessToken: string
): Promise<InstagramAccountInfo> {
  const pages = await graphGet<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  }>("/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100", accessToken);

  if (!pages.data?.length) {
    throw new Error(
      "No Facebook Pages found. Create a Facebook Page, then link your Instagram Business or Creator account to it."
    );
  }

  const page = pages.data.find((p) => p.instagram_business_account?.id);
  if (!page?.instagram_business_account) {
    throw new Error(
      "No Instagram Business or Creator account is linked to your Facebook Page. In Instagram, switch to a Professional account, then connect it to your Page in Meta Business Suite."
    );
  }

  const igUserId = page.instagram_business_account.id;
  const profile = await graphGet<{
    username: string;
    followers_count?: number;
  }>(`/${igUserId}?fields=username,followers_count`, page.access_token);

  return {
    igUserId,
    pageId: page.id,
    displayName: profile.username || page.name,
    followerCount: profile.followers_count ?? 0,
    pageAccessToken: page.access_token,
    ...(await fetchInstagramAccountInsights(igUserId, page.access_token)),
  };
}

/** Account-level insights: reach, impressions, follower count (last 24h). */
export async function fetchInstagramAccountInsights(
  igUserId: string,
  pageAccessToken: string
): Promise<{ reach: number; impressions: number }> {
  try {
    const insights = await graphGet<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(
      `/${igUserId}/insights?metric=reach,impressions&period=day`,
      pageAccessToken
    );

    const get = (name: string) =>
      insights.data?.find((m) => m.name === name)?.values?.[0]?.value ?? 0;

    return { reach: get("reach"), impressions: get("impressions") };
  } catch {
    return { reach: 0, impressions: 0 };
  }
}

export async function fetchInstagramMediaStats(
  _userAccessToken: string,
  mediaId: string,
  pageAccessToken: string
): Promise<InstagramVideoStats> {
  try {
    const insights = await graphGet<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(
      `/${mediaId}/insights?metric=reach,views,likes,comments,shares,saved`,
      pageAccessToken
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

export async function publishReelToInstagram(
  userAccessToken: string,
  igUserId: string,
  pageAccessToken: string,
  mediaUrl: string,
  caption: string
): Promise<{ platformPostId: string; stats?: InstagramVideoStats }> {
  const container = await graphPost<{
    id: string;
  }>(`/${igUserId}/media`, pageAccessToken, {
    media_type: "REELS",
    video_url: mediaUrl,
    caption: caption.slice(0, 2200),
    share_to_feed: true,
  });

  const creationId = container.id;
  let publishedId: string | null = null;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await graphGet<{ status_code: string; id?: string }>(
      `/${creationId}?fields=status_code`,
      pageAccessToken
    );
    if (status.status_code === "FINISHED") {
      publishedId = creationId;
      break;
    }
    if (status.status_code === "ERROR") {
      throw new Error("Instagram media container processing failed");
    }
  }

  if (!publishedId) {
    throw new Error("Instagram media processing timed out");
  }

  const publish = await graphPost<{ id: string }>(
    `/${igUserId}/media_publish`,
    pageAccessToken,
    { creation_id: creationId }
  );

  const platformPostId = publish.id;
  const stats = await fetchInstagramMediaStats(
    userAccessToken,
    platformPostId,
    pageAccessToken
  );

  return { platformPostId, stats };
}

async function graphPost<T>(
  path: string,
  accessToken: string,
  data: Record<string, string | boolean>
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
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

  const [igUserId, pageId] = accountId.split(":");
  if (!igUserId || !pageId) {
    throw new Error("Invalid Instagram account ID format");
  }

  let pageAccessToken = storedPageAccessToken ?? null;

  if (!pageAccessToken) {
    const pages = await graphGet<{
      data: Array<{ id: string; access_token: string }>;
    }>("/me/accounts?fields=id,access_token", accessToken);

    const page = pages.data?.find((p) => p.id === pageId);
    if (!page) {
      throw new Error("Facebook Page access lost. Reconnect Instagram.");
    }
    pageAccessToken = page.access_token;
  }

  return publishReelToInstagram(
    accessToken,
    igUserId,
    pageAccessToken,
    mediaUrl,
    caption
  );
}
