import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { getAppUrl } from "@/lib/config";
import { getDb } from "@/lib/db";
import { driveConnections } from "@/lib/db/schema";
import { fetchMediaBuffer } from "@/lib/r2";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_FOLDER_NAME = "ReSocial Backups";
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024;

export interface GoogleDriveTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class GoogleDriveApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "GoogleDriveApiError";
  }
}

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getGoogleDriveRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/google-drive`;
}

export function buildGoogleDriveAuthUrl(state: string): string {
  const { clientId } = getGoogleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleDriveRedirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function parseTokenResponse(res: Response): Promise<GoogleDriveTokens> {
  const body = await res.json();
  if (!res.ok) {
    const msg =
      body.error_description || body.error || "Google token request failed";
    throw new Error(msg);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? "",
    expiresIn: body.expires_in,
  };
}

export async function exchangeGoogleDriveCode(
  code: string
): Promise<GoogleDriveTokens> {
  const { clientId, clientSecret } = getGoogleCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleDriveRedirectUri(),
    }),
  });
  return parseTokenResponse(res);
}

export async function refreshGoogleDriveToken(
  refreshToken: string
): Promise<GoogleDriveTokens> {
  const { clientId, clientSecret } = getGoogleCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return parseTokenResponse(res);
}

export async function fetchGoogleAccountEmail(
  accessToken: string
): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || "Failed to fetch Google account info");
  }
  return (body.email as string) ?? "Google Drive";
}

async function driveFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    throw new GoogleDriveApiError("Google Drive access token expired", 401);
  }
  return res;
}

async function findOrCreateBackupFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listRes = await driveFetch(
    `${DRIVE_API}/files?q=${query}&fields=files(id,name)&spaces=drive`,
    accessToken
  );
  const listBody = await listRes.json();
  if (!listRes.ok) {
    throw new Error(listBody.error?.message || "Failed to list Drive folders");
  }

  const existing = listBody.files?.[0]?.id as string | undefined;
  if (existing) return existing;

  const createRes = await driveFetch(`${DRIVE_API}/files`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const createBody = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createBody.error?.message || "Failed to create backup folder");
  }
  return createBody.id as string;
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

async function multipartUpload(
  accessToken: string,
  folderId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const boundary = `resocial_${randomBytes(12).toString("hex")}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
  });

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const closing = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, buffer, closing]);

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  if (res.status === 401) {
    throw new GoogleDriveApiError("Google Drive access token expired", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive multipart upload failed: ${res.status} ${err}`);
  }
}

async function resumableUpload(
  accessToken: string,
  folderId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const initRes = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: filename,
      parents: [folderId],
      mimeType,
    }),
  });

  if (initRes.status === 401) {
    throw new GoogleDriveApiError("Google Drive access token expired", 401);
  }
  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Drive resumable init failed: ${initRes.status} ${err}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Drive did not return resumable upload URL");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive resumable upload failed: ${uploadRes.status} ${err}`);
  }
}

async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  const mimeType = mimeFromFilename(filename);
  if (buffer.length > RESUMABLE_THRESHOLD) {
    await resumableUpload(accessToken, folderId, filename, buffer, mimeType);
  } else {
    await multipartUpload(accessToken, folderId, filename, buffer, mimeType);
  }
}

async function withDriveTokenRefresh<T>(
  userId: string,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  const db = getDb();
  const [connection] = await db
    .select()
    .from(driveConnections)
    .where(
      and(
        eq(driveConnections.userId, userId),
        eq(driveConnections.isActive, true)
      )
    )
    .limit(1);

  if (!connection) {
    throw new Error("Google Drive not connected");
  }

  try {
    return await fn(connection.accessToken);
  } catch (err) {
    if (
      err instanceof GoogleDriveApiError &&
      err.status === 401 &&
      connection.refreshToken
    ) {
      const tokens = await refreshGoogleDriveToken(connection.refreshToken);
      await db
        .update(driveConnections)
        .set({ accessToken: tokens.accessToken })
        .where(eq(driveConnections.id, connection.id));
      return fn(tokens.accessToken);
    }
    throw err;
  }
}

export function sanitizeBackupFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export function extensionFromMediaUrl(mediaUrl: string): string {
  const match = mediaUrl.match(/\.(\w+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() ?? "mp4";
}

export async function hasDriveBackupEnabled(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: driveConnections.id })
    .from(driveConnections)
    .where(
      and(
        eq(driveConnections.userId, userId),
        eq(driveConnections.isActive, true)
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Copies an R2 media file to the user's Google Drive "ReSocial Backups" folder.
 */
export async function backupToGoogleDrive(
  userId: string,
  mediaUrl: string,
  filename: string
): Promise<void> {
  const enabled = await hasDriveBackupEnabled(userId);
  if (!enabled) return;

  const buffer = await fetchMediaBuffer(mediaUrl);
  if (buffer.length === 0) {
    throw new Error("Media file is empty");
  }

  const safeName = sanitizeBackupFilename(filename);

  await withDriveTokenRefresh(userId, async (accessToken) => {
    const db = getDb();
    const [connection] = await db
      .select()
      .from(driveConnections)
      .where(eq(driveConnections.userId, userId))
      .limit(1);

    let folderId = connection?.folderId;
    if (!folderId) {
      folderId = await findOrCreateBackupFolder(accessToken);
      await db
        .update(driveConnections)
        .set({ folderId })
        .where(eq(driveConnections.userId, userId));
    }

    await uploadFileToDrive(accessToken, folderId, safeName, buffer);
  });
}

export async function ensureDriveBackupFolder(
  userId: string,
  accessToken: string
): Promise<string> {
  const folderId = await findOrCreateBackupFolder(accessToken);
  const db = getDb();
  await db
    .update(driveConnections)
    .set({ folderId })
    .where(eq(driveConnections.userId, userId));
  return folderId;
}
