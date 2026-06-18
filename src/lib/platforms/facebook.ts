import { getAppUrl } from "@/lib/config";

const GRAPH_VERSION = "v18.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const META_AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const FACEBOOK_SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
].join(",");

export interface MetaTokens {
  accessToken: string;
  expiresIn: number;
}

export interface FacebookPageInfo {
  pageId: string;
  displayName: string;
  followerCount: number;
  pageAccessToken: string;
}

export interface FacebookVideoStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

function getFacebookCredentials() {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getFacebookRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/facebook`;
}

export function buildFacebookAuthUrl(state: string): string {
  const { clientId } = getFacebookCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getFacebookRedirectUri(),
    response_type: "code",
    scope: FACEBOOK_SCOPES,
    state,
  });
  return `${META_AUTH_URL}?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string): Promise<MetaTokens> {
  const { clientId, clientSecret } = getFacebookCredentials();
  const url = `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getFacebookRedirectUri(),
    code,
  })}`;

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Facebook token exchange failed");
  }

  const longLived = await fetch(
    `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: body.access_token,
    })}`
  );
  const longBody = await longLived.json();
  if (!longLived.ok || longBody.error) {
    return { accessToken: body.access_token, expiresIn: body.expires_in };
  }
  return {
    accessToken: longBody.access_token,
    expiresIn: longBody.expires_in,
  };
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API error (${res.status})`);
  }
  return body as T;
}

export async function fetchFacebookPages(
  accessToken: string
): Promise<FacebookPageInfo[]> {
  const pages = await graphGet<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      followers_count?: number;
    }>;
  }>("/me/accounts?fields=id,name,access_token,followers_count", accessToken);

  return (pages.data ?? []).map((p) => ({
    pageId: p.id,
    displayName: p.name,
    followerCount: p.followers_count ?? 0,
    pageAccessToken: p.access_token,
  }));
}

export async function fetchFacebookVideoStats(
  pageAccessToken: string,
  videoId: string
): Promise<FacebookVideoStats> {
  try {
    const video = await graphGet<{
      views?: number;
      likes?: { summary: { total_count: number } };
      comments?: { summary: { total_count: number } };
      shares?: { count: number };
    }>(
      `/${videoId}?fields=views,likes.summary(true),comments.summary(true),shares`,
      pageAccessToken
    );

    const views = video.views ?? 0;
    const likes = video.likes?.summary?.total_count ?? 0;
    const comments = video.comments?.summary?.total_count ?? 0;
    const shares = video.shares?.count ?? 0;
    const saves = 0;
    const engagements = likes + comments + shares;
    const engagementRate =
      views > 0 ? Math.round((engagements / views) * 10000) : 0;

    return { views, likes, comments, shares, saves, engagementRate };
  } catch {
    return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 };
  }
}

export async function publishVideoToFacebook(
  accessToken: string,
  accountId: string | null,
  mediaUrl: string,
  caption: string
): Promise<{ platformPostId: string; stats?: FacebookVideoStats }> {
  if (!accountId) {
    throw new Error("Facebook page ID missing");
  }

  const pages = await fetchFacebookPages(accessToken);
  const page = pages.find((p) => p.pageId === accountId);
  if (!page) {
    throw new Error("Facebook Page access lost. Reconnect Facebook.");
  }

  const res = await fetch(`${GRAPH_BASE}/${page.pageId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_url: mediaUrl,
      description: caption.slice(0, 5000),
      access_token: page.pageAccessToken,
    }),
  });

  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Facebook video publish failed");
  }

  const platformPostId = body.id as string;
  const stats = await fetchFacebookVideoStats(page.pageAccessToken, platformPostId);

  return { platformPostId, stats };
}
