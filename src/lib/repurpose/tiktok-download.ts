import {
  isMediaStorageConfigured,
  MAX_UPLOAD_BYTES,
  uploadMediaBuffer,
} from "@/lib/r2";

function unescapeTikTokUrl(raw: string): string {
  return raw.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

function extractTikTokVideoUrl(html: string): string | null {
  const patterns = [
    /"playAddr":"([^"]+)"/,
    /"downloadAddr":"([^"]+)"/,
    /"playApi":"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = unescapeTikTokUrl(match[1]);
      if (url.startsWith("http")) return url;
    }
  }

  return null;
}

/**
 * Resolve a public TikTok share URL to a downloadable MP4 and store in R2 / Blob.
 */
export async function downloadTikTokVideoForRepurpose(
  userId: string,
  shareUrl: string
): Promise<string> {
  if (!isMediaStorageConfigured()) {
    throw new Error("Media storage is not configured");
  }

  const pageRes = await fetch(shareUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    redirect: "follow",
  });

  if (!pageRes.ok) {
    throw new Error(`TikTok page fetch failed (${pageRes.status})`);
  }

  const html = await pageRes.text();
  const videoUrl = extractTikTokVideoUrl(html);
  if (!videoUrl) {
    throw new Error("Could not resolve a downloadable TikTok video URL");
  }

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`TikTok video download failed (${videoRes.status})`);
  }

  const length = parseInt(videoRes.headers.get("content-length") ?? "0", 10);
  if (length > MAX_UPLOAD_BYTES) {
    throw new Error("TikTok video exceeds upload size limit");
  }

  const buffer = Buffer.from(await videoRes.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("TikTok video exceeds upload size limit");
  }
  if (buffer.length === 0) {
    throw new Error("TikTok video file is empty");
  }

  return uploadMediaBuffer(userId, buffer, "video/mp4");
}
