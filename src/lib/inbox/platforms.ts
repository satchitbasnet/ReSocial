import type { PlatformId } from "@/lib/constants";
import { refreshYouTubeToken } from "@/lib/platforms/youtube";
import { fetchFacebookPages } from "@/lib/platforms/facebook";

const GRAPH_VERSION = "v18.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_BASE = "https://graph.instagram.com/v21.0";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export interface FetchedInboxMessage {
  platformMessageId: string;
  type: "comment" | "dm" | "mention";
  authorName: string;
  authorAvatar?: string;
  content: string;
  receivedAt: Date;
  platformPostId: string;
  replyTargetId?: string;
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

async function igGraphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${IG_GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Instagram API error (${res.status})`);
  }
  return body as T;
}

async function igGraphPost<T>(
  path: string,
  accessToken: string,
  data: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${IG_GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, access_token: accessToken }),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Instagram API POST failed (${res.status})`);
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

async function graphPostJson<T>(
  path: string,
  accessToken: string,
  data: Record<string, unknown>
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

export async function replyInstagramDirectMessage(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  message: string
) {
  await igGraphPost(`/${igUserId}/messages`, accessToken, {
    recipient: { id: recipientId },
    message: { text: message.slice(0, 1000) },
  });
}

export async function commentOnInstagramMedia(
  accessToken: string,
  mediaId: string,
  message: string,
  useInstagramGraph = true
) {
  if (useInstagramGraph) {
    await igGraphPost(`/${mediaId}/comments`, accessToken, {
      message: message.slice(0, 2200),
    });
    return;
  }
  await graphPost(`/${mediaId}/comments`, accessToken, {
    message: message.slice(0, 2200),
  });
}

/** Tagged media for legacy Facebook Login + Page Instagram connections. */
export async function fetchInstagramTaggedMediaFb(
  pageAccessToken: string,
  igUserId: string
): Promise<FetchedInboxMessage[]> {
  const body = await graphGet<{
    data?: Array<{
      id: string;
      caption?: string;
      timestamp?: string;
      username?: string;
    }>;
  }>(
    `/${igUserId}/tags?fields=id,caption,timestamp,username&limit=25`,
    pageAccessToken
  );

  return (body.data ?? []).map((item) => ({
    platformMessageId: `tag_${item.id}`,
    type: "mention" as const,
    authorName: item.username ? `@${item.username}` : "Instagram user",
    content: item.caption?.trim()
      ? `Tagged you: ${item.caption}`
      : "Tagged you in a post",
    receivedAt: item.timestamp ? new Date(item.timestamp) : new Date(),
    platformPostId: item.id,
    replyTargetId: item.id,
  }));
}

/** Media where the IG account is tagged (photo mentions). */
export async function fetchInstagramTaggedMedia(
  accessToken: string,
  igUserId: string
): Promise<FetchedInboxMessage[]> {
  const body = await igGraphGet<{
    data?: Array<{
      id: string;
      caption?: string;
      timestamp?: string;
      username?: string;
      media_url?: string;
    }>;
  }>(
    `/${igUserId}/tags?fields=id,caption,timestamp,username,media_url&limit=25`,
    accessToken
  );

  return (body.data ?? []).map((item) => ({
    platformMessageId: `tag_${item.id}`,
    type: "mention" as const,
    authorName: item.username ? `@${item.username}` : "Instagram user",
    content: item.caption?.trim()
      ? `Tagged you: ${item.caption}`
      : "Tagged you in a post",
    receivedAt: item.timestamp ? new Date(item.timestamp) : new Date(),
    platformPostId: item.id,
    replyTargetId: item.id,
  }));
}

/** Instagram DMs via Instagram Login messaging API. */
export async function fetchInstagramDirectMessages(
  accessToken: string,
  igUserId: string
): Promise<FetchedInboxMessage[]> {
  const body = await igGraphGet<{
    data?: Array<{
      id: string;
      messages?: {
        data?: Array<{
          id: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; username?: string };
        }>;
      };
    }>;
  }>(
    `/${igUserId}/conversations?fields=messages{id,message,from,created_time}&limit=10`,
    accessToken
  );

  const out: FetchedInboxMessage[] = [];

  for (const convo of body.data ?? []) {
    for (const msg of convo.messages?.data ?? []) {
      if (!msg.id || !msg.message) continue;
      out.push({
        platformMessageId: msg.id,
        type: "dm",
        authorName: msg.from?.username ?? "Instagram user",
        content: msg.message,
        receivedAt: msg.created_time
          ? new Date(msg.created_time)
          : new Date(),
        platformPostId: convo.id,
        replyTargetId: msg.from?.id,
      });
    }
  }

  return out;
}

/** Instagram DMs for legacy Page-connected accounts (Messenger platform). */
export async function fetchInstagramPageDirectMessages(
  pageAccessToken: string,
  pageId: string
): Promise<FetchedInboxMessage[]> {
  const body = await graphGet<{
    data?: Array<{
      id: string;
      messages?: {
        data?: Array<{
          id: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; name?: string };
        }>;
      };
    }>;
  }>(
    `/${pageId}/conversations?platform=instagram&fields=messages{id,message,from,created_time}&limit=10`,
    pageAccessToken
  );

  const out: FetchedInboxMessage[] = [];

  for (const convo of body.data ?? []) {
    for (const msg of convo.messages?.data ?? []) {
      if (!msg.id || !msg.message) continue;
      out.push({
        platformMessageId: msg.id,
        type: "dm",
        authorName: msg.from?.name ?? "Instagram user",
        content: msg.message,
        receivedAt: msg.created_time
          ? new Date(msg.created_time)
          : new Date(),
        platformPostId: convo.id,
        replyTargetId: msg.from?.id,
      });
    }
  }

  return out;
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

export async function replyFacebookDirectMessage(
  pageId: string,
  pageAccessToken: string,
  recipientId: string,
  message: string
) {
  await graphPostJson(`/${pageId}/messages`, pageAccessToken, {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
    message: { text: message.slice(0, 2000) },
  });
}

export async function fetchFacebookPageDirectMessages(
  pageAccessToken: string,
  pageId: string
): Promise<FetchedInboxMessage[]> {
  const body = await graphGet<{
    data?: Array<{
      id: string;
      messages?: {
        data?: Array<{
          id: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; name?: string };
        }>;
      };
    }>;
  }>(
    `/${pageId}/conversations?fields=messages.limit(15){id,message,from,created_time}&limit=10`,
    pageAccessToken
  );

  const out: FetchedInboxMessage[] = [];

  for (const convo of body.data ?? []) {
    for (const msg of convo.messages?.data ?? []) {
      if (!msg.id || !msg.message) continue;
      out.push({
        platformMessageId: msg.id,
        type: "dm",
        authorName: msg.from?.name ?? "Facebook user",
        content: msg.message,
        receivedAt: msg.created_time
          ? new Date(msg.created_time)
          : new Date(),
        platformPostId: convo.id,
        replyTargetId: msg.from?.id,
      });
    }
  }

  return out;
}

export async function fetchFacebookPageMentions(
  pageAccessToken: string,
  pageId: string
): Promise<FetchedInboxMessage[]> {
  const body = await graphGet<{
    data?: Array<{
      id: string;
      message?: string;
      created_time?: string;
      from?: { name?: string };
    }>;
  }>(
    `/${pageId}/tagged?fields=id,message,from,created_time&limit=25`,
    pageAccessToken
  );

  return (body.data ?? []).map((post) => ({
    platformMessageId: `fb_tag_${post.id}`,
    type: "mention" as const,
    authorName: post.from?.name ?? "Facebook user",
    content: post.message?.trim()
      ? `Mentioned your Page: ${post.message}`
      : "Mentioned your Page in a post",
    receivedAt: post.created_time ? new Date(post.created_time) : new Date(),
    platformPostId: post.id,
    replyTargetId: post.id,
  }));
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
