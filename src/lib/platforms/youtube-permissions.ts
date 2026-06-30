export type YouTubePermissionTier = "full" | "basic" | "read_only";

export interface YouTubePermissionOption {
  id: YouTubePermissionTier;
  label: string;
  description: string;
  recommended?: boolean;
  scopes: string[];
}

export const YOUTUBE_PERMISSION_OPTIONS: YouTubePermissionOption[] = [
  {
    id: "full",
    label: "Full",
    description:
      "Full is similar to Basic with the added ability to upload your own subtitle files to YouTube and publish first comment",
    recommended: true,
    scopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
      "https://www.googleapis.com/auth/youtube",
    ],
  },
  {
    id: "basic",
    label: "Basic",
    description:
      "Basic is used for viewing videos, upload videos, creating playlists, and uploading thumbnails",
    scopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
  },
  {
    id: "read_only",
    label: "Read-only",
    description: "Read-only is used for viewing videos only (no uploading allowed)",
    scopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
  },
];

export function isYouTubePermissionTier(
  value: string | null | undefined
): value is YouTubePermissionTier {
  return value === "full" || value === "basic" || value === "read_only";
}

export function getYouTubePermissionOption(
  tier: YouTubePermissionTier
): YouTubePermissionOption {
  return (
    YOUTUBE_PERMISSION_OPTIONS.find((o) => o.id === tier) ??
    YOUTUBE_PERMISSION_OPTIONS[0]
  );
}

export function getYouTubeScopesForTier(tier: YouTubePermissionTier): string[] {
  return getYouTubePermissionOption(tier).scopes;
}

export function youtubeScopesAllowUpload(oauthScopes: string | null): boolean {
  if (!oauthScopes) return true;
  return (
    oauthScopes.includes("youtube.upload") ||
    oauthScopes.includes("https://www.googleapis.com/auth/youtube")
  );
}
