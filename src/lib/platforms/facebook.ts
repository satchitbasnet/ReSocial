import { getAppUrl } from "@/lib/config";

const GRAPH_VERSION = "v18.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const META_AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const FACEBOOK_SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "pages_messaging",
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

  let pageAccessToken = accessToken;

  const res = await fetch(`${GRAPH_BASE}/${accountId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_url: mediaUrl,
      description: caption.slice(0, 5000),
      access_token: pageAccessToken,
    }),
  });

  let body = await res.json();

  if ((!res.ok || body.error) && body.error?.code !== undefined) {
    const pages = await fetchFacebookPages(accessToken);
    const page = pages.find((p) => p.pageId === accountId);
    if (!page) {
      throw new Error("Facebook Page access lost. Reconnect Facebook.");
    }
    pageAccessToken = page.pageAccessToken;

    const retry = await fetch(`${GRAPH_BASE}/${accountId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: mediaUrl,
        description: caption.slice(0, 5000),
        access_token: pageAccessToken,
      }),
    });
    body = await retry.json();
    if (!retry.ok || body.error) {
      throw new Error(body.error?.message || "Facebook video publish failed");
    }
  } else if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Facebook video publish failed");
  }

  const platformPostId = body.id as string;
  const stats = await fetchFacebookVideoStats(pageAccessToken, platformPostId);

  return { platformPostId, stats };
}

async function resolveFacebookPageToken(
  accessToken: string,
  accountId: string
): Promise<string> {
  const pages = await fetchFacebookPages(accessToken);
  const page = pages.find((p) => p.pageId === accountId);
  if (!page) {
    throw new Error("Facebook Page access lost. Reconnect Facebook.");
  }
  return page.pageAccessToken;
}

export async function publishPhotosToFacebook(
  accessToken: string,
  accountId: string | null,
  imageUrls: string[],
  caption: string
): Promise<{ platformPostId: string; stats?: FacebookVideoStats }> {
  if (!accountId) {
    throw new Error("Facebook page ID missing");
  }

  const urls = imageUrls.filter((u) => u.startsWith("https://"));
  if (urls.length === 0) {
    throw new Error("Facebook requires public HTTPS image URLs.");
  }

  let pageAccessToken = accessToken;

  if (urls.length === 1) {
    const res = await fetch(`${GRAPH_BASE}/${accountId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urls[0],
        message: caption.slice(0, 5000),
        published: true,
        access_token: pageAccessToken,
      }),
    });
    let body = await res.json();

    if (!res.ok || body.error) {
      pageAccessToken = await resolveFacebookPageToken(accessToken, accountId);
      const retry = await fetch(`${GRAPH_BASE}/${accountId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urls[0],
          message: caption.slice(0, 5000),
          published: true,
          access_token: pageAccessToken,
        }),
      });
      body = await retry.json();
      if (!retry.ok || body.error) {
        throw new Error(body.error?.message || "Facebook photo publish failed");
      }
    }

    const platformPostId = body.id as string;
    return { platformPostId };
  }

  const attachedMedia: Array<{ media_fbid: string }> = [];

  for (const url of urls) {
    let res = await fetch(`${GRAPH_BASE}/${accountId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        published: false,
        access_token: pageAccessToken,
      }),
    });
    let body = await res.json();

    if (!res.ok || body.error) {
      pageAccessToken = await resolveFacebookPageToken(accessToken, accountId);
      res = await fetch(`${GRAPH_BASE}/${accountId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          published: false,
          access_token: pageAccessToken,
        }),
      });
      body = await res.json();
      if (!res.ok || body.error) {
        throw new Error(body.error?.message || "Facebook photo upload failed");
      }
    }

    attachedMedia.push({ media_fbid: body.id as string });
  }

  const feedRes = await fetch(`${GRAPH_BASE}/${accountId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: caption.slice(0, 5000),
      attached_media: attachedMedia,
      access_token: pageAccessToken,
    }),
  });
  const feedBody = await feedRes.json();
  if (!feedRes.ok || feedBody.error) {
    throw new Error(feedBody.error?.message || "Facebook carousel publish failed");
  }

  return { platformPostId: feedBody.id as string };
}

export interface FacebookSourceMedia {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaType: "video" | "image" | "carousel";
  timestamp: string;
}

type FbAttachment = {
  type?: string;
  media_type?: string;
  url?: string;
  media?: {
    image?: { src?: string };
    source?: string;
  };
  subattachments?: {
    data?: Array<{
      type?: string;
      media?: { image?: { src?: string }; source?: string };
    }>;
  };
};

function parseFacebookPostMedia(post: {
  id: string;
  message?: string;
  created_time?: string;
  attachments?: { data?: FbAttachment[] };
}): FacebookSourceMedia | null {
  const attachment = post.attachments?.data?.[0];
  if (!attachment) return null;

  const caption = post.message ?? "";
  const timestamp = post.created_time ?? new Date().toISOString();
  const subs = attachment.subattachments?.data;

  if (subs && subs.length > 1) {
    const urls = subs
      .map((sub) => sub.media?.image?.src ?? sub.media?.source)
      .filter((u): u is string => Boolean(u?.startsWith("https://")));
    if (urls.length === 0) return null;
    return {
      id: post.id,
      caption,
      mediaUrl: urls[0],
      mediaUrls: urls,
      mediaType: "carousel",
      timestamp,
    };
  }

  const isVideo =
    attachment.media_type === "video" ||
    attachment.type === "video_inline" ||
    attachment.type === "video_autoplay";

  if (isVideo) {
    const src = attachment.media?.source ?? attachment.url;
    if (!src?.startsWith("https://")) return null;
    return {
      id: post.id,
      caption,
      mediaUrl: src,
      mediaType: "video",
      timestamp,
    };
  }

  const imageSrc = attachment.media?.image?.src ?? attachment.url;
  if (!imageSrc?.startsWith("https://")) return null;

  return {
    id: post.id,
    caption,
    mediaUrl: imageSrc,
    mediaType: "image",
    timestamp,
  };
}

/** Recent Page posts with video/photo attachments for Repurpose source polling. */
export async function fetchFacebookRecentPosts(
  pageAccessToken: string,
  pageId: string,
  limit = 10
): Promise<FacebookSourceMedia[]> {
  const body = await graphGet<{
    data?: Array<{
      id: string;
      message?: string;
      created_time?: string;
      attachments?: { data?: FbAttachment[] };
    }>;
  }>(
    `/${pageId}/posts?fields=id,message,created_time,attachments{type,media_type,url,media,subattachments{type,media}}&limit=${limit}`,
    pageAccessToken
  );

  return (body.data ?? [])
    .map(parseFacebookPostMedia)
    .filter((item): item is FacebookSourceMedia => item !== null);
}
