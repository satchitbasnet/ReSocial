import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { put as putBlob } from "@vercel/blob";
import { randomBytes } from "crypto";

const ALLOWED_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

export function getAllowedExtensions(): string[] {
  return Object.values(ALLOWED_MIME);
}

export function isAllowedMimeType(mime: string): boolean {
  return mime in ALLOWED_MIME;
}

export function mimeToExtension(mime: string): string {
  return ALLOWED_MIME[mime] ?? "bin";
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL must be set"
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function getR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function buildObjectKey(userId: string, ext: string): string {
  const id = randomBytes(8).toString("hex");
  return `${userId}/${Date.now()}-${id}.${ext}`;
}

export function getPublicMediaUrl(key: string): string {
  const { publicUrl } = getR2Config();
  const base = publicUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const { bucket } = getR2Config();
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = getPublicMediaUrl(key);

  return { uploadUrl, key, publicUrl };
}

/** Fetch media bytes from R2 public URL or legacy local /uploads path. */
export async function fetchMediaBuffer(mediaUrl: string): Promise<Buffer> {
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch media from R2: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  if (mediaUrl.startsWith("/uploads/")) {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    return readFile(path.join(process.cwd(), "public", mediaUrl));
  }

  const { bucket } = getR2Config();
  const key = mediaUrl.startsWith("/") ? mediaUrl.slice(1) : mediaUrl;
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const body = res.Body;
  if (!body) throw new Error("Empty R2 object body");
  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

/** Upload a processed media buffer to R2 and return the public URL. */
export async function uploadMediaBuffer(
  userId: string,
  buffer: Buffer,
  contentType = "video/mp4"
): Promise<string> {
  const ext = mimeToExtension(contentType);
  const key = buildObjectKey(userId, ext);

  if (isR2Configured()) {
    const { bucket } = getR2Config();
    const client = getR2Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return getPublicMediaUrl(key);
  }

  if (isBlobConfigured()) {
    const { url } = await putBlob(key, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return url;
  }

  throw new Error("Media storage is not configured");
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL
  );
}

export function isMediaStorageConfigured(): boolean {
  return isR2Configured() || isBlobConfigured();
}

export function getMediaStorageProvider(): "r2" | "vercel-blob" | null {
  if (isR2Configured()) return "r2";
  if (isBlobConfigured()) return "vercel-blob";
  return null;
}
