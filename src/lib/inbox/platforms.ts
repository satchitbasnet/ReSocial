import type { PlatformId } from "@/lib/constants";
import { refreshYouTubeToken } from "@/lib/platforms/youtube";
import { fetchFacebookPages } from "@/lib/platforms/facebook";

const GRAPH_VERSION = "v18.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export interface FetchedInboxMessage {
  platformMessageId: string;
  type: "comment" | "dm" | "mention";
  authorName: string;
  authorAvatar?: string;
  content: string;
  receivedAt: Date;
  platformPostId: string;
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API error (${res.status})`);
  }
  return body as T;
}

async function graphPost<T>(
  path: string,
  accessToken: string,
  data: Record<string, string>
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, access_token: accessToken }),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API POST failed (${res.status})`);
  }
  return body as T;
}

async function youtubeGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${YOUTUBE_API}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || `YouTube API error (${res.status})`);
  }
  return body as T;
}

async function youtubePost<T>(
  path: string,
  accessToken: string,
  data: unknown
): Promise<T> {
  const url = `${YOUTUBE_API}${path}?part=snippet&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || `YouTube API POST failed (${res.status})`);
  }
  return body as T;
}

async function withYouTubeToken<T>(
  accessToken: string,
  refreshToken: string | null,
  onRefresh: (token: string) => Promise<void>,
  fn: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(accessToken);
  } catch {
    if (!refreshToken) throw new Error("YouTube token expired. Reconnect your account.");
    const refreshed = await refreshYouTubeToken(refreshToken);
    await onRefresh(refreshed.accessToken);
    return await fn(refreshed.accessToken);
  }
}

export async function fetchInstagramComments(
  pageAccessToken: string,
  mediaId: string
): Promise<FetchedInboxMessage[]> {
  const body = await graphGet<{
    data: Array<{
      id: string;
      text?: string;
      timestamp?: string;
      from?: { username?: string; profile_picture_url?: string };
    }>;
  }>(
    `/${mediaId}/comments?fields=id,text,timestamp,from{username,profile_picture_url}`,
    pageAccessToken
  );

  return (body.data ?? []).map((c) => ({
    platformMessageId: c.id,
    type: "comment" as const,
    authorName: c.from?.username ?? "Unknown",
    authorAvatar: c.from?.profile_picture_url,
    content: c.text ?? "",
    receivedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
    platformPostId: mediaId,
  }));
}

export async function replyInstagramComment(
  pageAccessToken: string,
  commentId: string,
  message: string
) {
  await graphPost(`/${commentId}/replies`, pageAccessToken, {
    message: message.slice(0, 2200),
  });
}

export async function fetchFacebookComments(
  pageAccessToken: string,
  postId: string
): Promise<FetchedInboxMessage[]> {
  const body = await graphGet<{
    data: Array<{
      id: string;
      message?: string;
      created_time?: string;
      from?: { name?: string; picture?: { data?: { url?: string } } };
    }>;
  }>(
    `/${postId}/comments?fields=id,message,created_time,from{name,picture}`,
    pageAccessToken
  );

  return (body.data ?? []).map((c) => ({
    platformMessageId: c.id,
    type: "comment" as const,
    authorName: c.from?.name ?? "Unknown",
    authorAvatar: c.from?.picture?.data?.url,
    content: c.message ?? "",
    receivedAt: c.created_time ? new Date(c.created_time) : new Date(),
    platformPostId: postId,
  }));
}

export async function replyFacebookComment(
  pageAccessToken: string,
  commentId: string,
  message: string
) {
  await graphPost(`/${commentId}/comments`, pageAccessToken, {
    message: message.slice(0, 8000),
  });
}

export async function fetchYouTubeComments(
  accessToken: string,
  videoId: string
): Promise<FetchedInboxMessage[]> {
  const body = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet: {
        topLevelComment: {
          id: string;
          snippet: {
            textDisplay: string;
            authorDisplayName: string;
            authorProfileImageUrl?: string;
            publishedAt: string;
          };
        };
      };
    }>;
  }>(
    `/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=50&order=time`,
    accessToken
  );

  return (body.items ?? []).map((item) => {
    const c = item.snippet.topLevelComment;
    return {
      platformMessageId: c.id,
      type: "comment" as const,
      authorName: c.snippet.authorDisplayName,
      authorAvatar: c.snippet.authorProfileImageUrl,
      content: c.snippet.textDisplay,
      receivedAt: new Date(c.snippet.publishedAt),
      platformPostId: videoId,
    };
  });
}

export async function replyYouTubeComment(
  accessToken: string,
  commentId: string,
  message: string
) {
  await youtubePost("/comments", accessToken, {
    snippet: {
      parentId: commentId,
      textOriginal: message.slice(0, 10000),
    },
  });
}

export async function resolvePageAccessToken(
  platform: PlatformId,
  accessToken: string,
  accountId: string | null,
  storedPageToken: string | null
): Promise<string | null> {
  if (platform === "instagram" || platform === "facebook") {
    if (storedPageToken) return storedPageToken;
    if (!accessToken) return null;

    if (platform === "facebook" && accountId) {
      const pages = await fetchFacebookPages(accessToken);
      return pages.find((p) => p.pageId === accountId)?.pageAccessToken ?? null;
    }

    if (platform === "instagram" && accountId) {
      const [, pageId] = accountId.split(":");
      const pages = await graphGet<{
        data: Array<{ id: string; access_token: string }>;
      }>("/me/accounts?fields=id,access_token", accessToken);
      return pages.data?.find((p) => p.id === pageId)?.access_token ?? null;
    }
  }
  return accessToken;
}

export { withYouTubeToken };
