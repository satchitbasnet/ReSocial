import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { PlatformId } from "@/lib/constants";
import { fetchMediaBuffer, uploadMediaBuffer } from "@/lib/r2";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH ?? ffmpegPath);
}
if (ffprobeStatic.path) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH ?? ffprobeStatic.path);
}

interface VideoDimensions {
  width: number;
  height: number;
}

interface WatermarkLayout {
  corner: "bottom-left" | "bottom-right";
  widthRatio: number;
  heightRatio: number;
}

const PLATFORM_DIMENSIONS: Record<PlatformId, { width: number; height: number }> =
  {
    tiktok: { width: 1080, height: 1920 },
    instagram: { width: 1080, height: 1920 },
    youtube: { width: 1920, height: 1080 },
    facebook: { width: 1080, height: 1080 },
    twitter: { width: 1920, height: 1080 },
    pinterest: { width: 1080, height: 1920 },
    snapchat: { width: 1080, height: 1920 },
  };

/** Known watermark positions when repurposing from each platform. */
const WATERMARK_LAYOUTS: Partial<Record<PlatformId, WatermarkLayout>> = {
  tiktok: { corner: "bottom-left", widthRatio: 0.28, heightRatio: 0.1 },
  instagram: { corner: "bottom-right", widthRatio: 0.28, heightRatio: 0.1 },
  facebook: { corner: "bottom-right", widthRatio: 0.22, heightRatio: 0.08 },
  youtube: { corner: "bottom-right", widthRatio: 0.22, heightRatio: 0.08 },
  snapchat: { corner: "bottom-left", widthRatio: 0.25, heightRatio: 0.1 },
};

function isVideoMedia(inputUrl: string, mediaType?: string): boolean {
  if (mediaType?.startsWith("video")) return true;
  return /\.(mp4|mov|webm)(\?|$)/i.test(inputUrl);
}

function probeVideo(inputPath: string): Promise<VideoDimensions> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const video = metadata.streams.find((s) => s.codec_type === "video");
      resolve({
        width: video?.width ?? 1080,
        height: video?.height ?? 1920,
      });
    });
  });
}

function buildDelogoFilter(
  dims: VideoDimensions,
  layout: WatermarkLayout
): string {
  const w = Math.max(32, Math.round(dims.width * layout.widthRatio));
  const h = Math.max(32, Math.round(dims.height * layout.heightRatio));
  const margin = Math.round(dims.width * 0.02);
  const y = Math.max(0, dims.height - h - margin);

  const x =
    layout.corner === "bottom-left"
      ? margin
      : Math.max(0, dims.width - w - margin);

  return `delogo=x=${x}:y=${y}:w=${w}:h=${h}`;
}

function buildResizeFilter(width: number, height: number): string {
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  videoFilters: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);

    for (const filter of videoFilters) {
      cmd = cmd.videoFilters(filter);
    }

    cmd
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function withTempVideo<T>(
  inputUrl: string,
  fn: (inputPath: string, workDir: string) => Promise<T>
): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), "resocial-media-"));
  const inputPath = join(workDir, "input.mp4");

  try {
    const buffer = await fetchMediaBuffer(inputUrl);
    await writeFile(inputPath, buffer);
    return await fn(inputPath, workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function transcodeAndUpload(
  inputUrl: string,
  userId: string,
  buildFilters: (dims: VideoDimensions) => string[]
): Promise<string> {
  return withTempVideo(inputUrl, async (inputPath, workDir) => {
    const dims = await probeVideo(inputPath);
    const filters = buildFilters(dims);

    if (filters.length === 0) {
      return inputUrl;
    }

    const outputPath = join(workDir, "output.mp4");
    await runFfmpeg(inputPath, outputPath, filters);
    const outputBuffer = await readFile(outputPath);
    return uploadMediaBuffer(userId, outputBuffer, "video/mp4");
  });
}

/**
 * Crops/blurs the platform watermark region (delogo filter).
 */
export async function removeWatermark(
  inputUrl: string,
  platform: PlatformId,
  userId: string,
  mediaType?: string
): Promise<string> {
  if (!isVideoMedia(inputUrl, mediaType)) {
    return inputUrl;
  }

  const layout = WATERMARK_LAYOUTS[platform];
  if (!layout) {
    return inputUrl;
  }

  return transcodeAndUpload(inputUrl, userId, (dims) => [
    buildDelogoFilter(dims, layout),
  ]);
}

/**
 * Resizes video to the target platform aspect ratio.
 */
export async function resizeForPlatform(
  inputUrl: string,
  platform: PlatformId,
  userId: string,
  mediaType?: string
): Promise<string> {
  if (!isVideoMedia(inputUrl, mediaType)) {
    return inputUrl;
  }

  const preset = PLATFORM_DIMENSIONS[platform];
  if (!preset) {
    return inputUrl;
  }

  return transcodeAndUpload(inputUrl, userId, () => [
    buildResizeFilter(preset.width, preset.height),
  ]);
}

export interface ProcessMediaOptions {
  autoResize: boolean;
  removeWatermark: boolean;
  sourcePlatform?: PlatformId | null;
  mediaType?: string;
}

/**
 * Applies watermark removal and/or resize in a single ffmpeg pass, uploads to R2.
 */
export async function processMediaForPlatform(
  inputUrl: string,
  platform: PlatformId,
  userId: string,
  options: ProcessMediaOptions
): Promise<string> {
  const { autoResize, removeWatermark: stripWatermark, sourcePlatform, mediaType } =
    options;

  if (!isVideoMedia(inputUrl, mediaType)) {
    return inputUrl;
  }

  if (!autoResize && !stripWatermark) {
    return inputUrl;
  }

  return transcodeAndUpload(inputUrl, userId, (dims) => {
    const filters: string[] = [];

    if (stripWatermark) {
      const wmPlatform = sourcePlatform ?? platform;
      const layout = WATERMARK_LAYOUTS[wmPlatform];
      if (layout) {
        filters.push(buildDelogoFilter(dims, layout));
      }
    }

    if (autoResize) {
      const preset = PLATFORM_DIMENSIONS[platform];
      if (preset) {
        filters.push(buildResizeFilter(preset.width, preset.height));
      }
    }

    return filters;
  });
}

/** In-memory cache for processed URLs within a single publish batch. */
const batchCache = new Map<string, string>();

export function clearMediaProcessCache(): void {
  batchCache.clear();
}

export interface PrepareMediaResult {
  url: string;
  didRunFfmpeg: boolean;
}

/**
 * Prepare media for a target platform using workflow flags (cached per batch).
 */
export async function prepareMediaForPublish(
  inputUrl: string,
  platform: PlatformId,
  userId: string,
  options: ProcessMediaOptions
): Promise<PrepareMediaResult> {
  if (!options.autoResize && !options.removeWatermark) {
    return { url: inputUrl, didRunFfmpeg: false };
  }

  const cacheKey = [
    inputUrl,
    platform,
    options.autoResize,
    options.removeWatermark,
    options.sourcePlatform ?? "",
    options.mediaType ?? "",
  ].join("|");

  const cached = batchCache.get(cacheKey);
  if (cached) {
    return { url: cached, didRunFfmpeg: false };
  }

  const processed = await processMediaForPlatform(
    inputUrl,
    platform,
    userId,
    options
  );
  batchCache.set(cacheKey, processed);
  return {
    url: processed,
    didRunFfmpeg: processed !== inputUrl,
  };
}
