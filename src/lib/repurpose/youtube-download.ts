import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  isMediaStorageConfigured,
  MAX_UPLOAD_BYTES,
  uploadMediaBuffer,
} from "@/lib/r2";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH ?? ffmpegPath);
}
if (ffprobeStatic.path) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH ?? ffprobeStatic.path);
}

const INNERTUBE_API_KEY = "AIzaSyAO_FJ2SluUfQ0S4npQX_LPtZY7gzdmhWQ";

interface InnertubeFormat {
  itag?: number;
  mimeType?: string;
  url?: string;
  contentLength?: string;
  qualityLabel?: string;
  height?: number;
}

interface InnertubePlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: {
    formats?: InnertubeFormat[];
    adaptiveFormats?: InnertubeFormat[];
  };
}

async function fetchInnertubePlayer(
  videoId: string
): Promise<InnertubePlayerResponse> {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
      },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`YouTube player API failed (${res.status})`);
  }

  return res.json() as Promise<InnertubePlayerResponse>;
}

function parseContentLength(format: InnertubeFormat): number {
  return parseInt(format.contentLength ?? "0", 10) || 0;
}

function isMuxedMp4(format: InnertubeFormat): boolean {
  if (!format.url || !format.mimeType) return false;
  return (
    format.mimeType.includes("video/mp4") &&
    format.mimeType.includes("audio")
  );
}

function isVideoOnlyMp4(format: InnertubeFormat): boolean {
  if (!format.url || !format.mimeType) return false;
  return (
    format.mimeType.startsWith("video/mp4") &&
    !format.mimeType.includes("audio")
  );
}

function isAudioMp4(format: InnertubeFormat): boolean {
  if (!format.url || !format.mimeType) return false;
  return format.mimeType.startsWith("audio/mp4");
}

function pickMuxedFormat(formats: InnertubeFormat[]): InnertubeFormat | null {
  const muxed = formats
    .filter(isMuxedMp4)
    .filter((f) => parseContentLength(f) <= MAX_UPLOAD_BYTES || !f.contentLength);

  if (muxed.length === 0) return null;

  muxed.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return muxed[0];
}

function pickVideoAndAudio(formats: InnertubeFormat[]): {
  video: InnertubeFormat;
  audio: InnertubeFormat;
} | null {
  const videos = formats
    .filter(isVideoOnlyMp4)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  const audios = formats.filter(isAudioMp4);

  if (videos.length === 0 || audios.length === 0) return null;
  return { video: videos[0], audio: audios[0] };
}

async function downloadUrlToBuffer(
  url: string,
  maxBytes = MAX_UPLOAD_BYTES
): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Video download failed (${res.status})`);
  }

  const length = parseInt(res.headers.get("content-length") ?? "0", 10);
  if (length > maxBytes) {
    throw new Error(
      `Video exceeds ${Math.round(maxBytes / 1024 / 1024)}MB upload limit`
    );
  }

  const chunks: Buffer[] = [];
  let total = 0;

  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new Error("Video exceeds upload size limit");
    }
    return buf;
  }

  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("Video exceeds upload size limit");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
        "-shortest",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function muxAndUpload(
  userId: string,
  videoUrl: string,
  audioUrl: string
): Promise<string> {
  const workDir = await mkdtemp(join(tmpdir(), "resocial-yt-"));
  const videoPath = join(workDir, "video.mp4");
  const audioPath = join(workDir, "audio.m4a");
  const outputPath = join(workDir, "output.mp4");

  try {
    const [videoBuf, audioBuf] = await Promise.all([
      downloadUrlToBuffer(videoUrl),
      downloadUrlToBuffer(audioUrl),
    ]);
    await writeFile(videoPath, videoBuf);
    await writeFile(audioPath, audioBuf);
    await mergeVideoAudio(videoPath, audioPath, outputPath);
    const output = await readFile(outputPath);
    if (output.length > MAX_UPLOAD_BYTES) {
      throw new Error("Merged video exceeds upload size limit");
    }
    return uploadMediaBuffer(userId, output, "video/mp4");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Download a public YouTube video and store it in R2 / Vercel Blob.
 * Used by Repurpose workflows when YouTube is the source platform.
 */
export async function downloadYouTubeVideoForRepurpose(
  userId: string,
  videoId: string
): Promise<string> {
  if (!isMediaStorageConfigured()) {
    throw new Error("Media storage is not configured");
  }

  const player = await fetchInnertubePlayer(videoId);
  const status = player.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(
      player.playabilityStatus?.reason ??
        `YouTube video is not playable (${status})`
    );
  }

  const allFormats = [
    ...(player.streamingData?.formats ?? []),
    ...(player.streamingData?.adaptiveFormats ?? []),
  ];

  const muxed = pickMuxedFormat(allFormats);
  if (muxed?.url) {
    const buffer = await downloadUrlToBuffer(muxed.url);
    return uploadMediaBuffer(userId, buffer, "video/mp4");
  }

  const separate = pickVideoAndAudio(allFormats);
  if (separate?.video.url && separate.audio.url) {
    return muxAndUpload(userId, separate.video.url, separate.audio.url);
  }

  throw new Error(
    "Could not resolve a downloadable stream for this YouTube video"
  );
}
