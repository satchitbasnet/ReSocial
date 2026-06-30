import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  buildObjectKey,
  createPresignedUploadUrl,
  getMediaStorageProvider,
  isAllowedMimeType,
  isBlobConfigured,
  isMediaStorageConfigured,
  MAX_UPLOAD_BYTES,
  mimeToExtension,
} from "@/lib/r2";

const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
});

const ALLOWED_CONTENT_TYPES = Object.keys({
  "video/mp4": true,
  "video/quicktime": true,
  "video/webm": true,
  "image/jpeg": true,
  "image/png": true,
  "image/gif": true,
});

function isBlobHandleUploadBody(
  body: unknown
): body is HandleUploadBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "type" in body &&
    typeof (body as { type: unknown }).type === "string" &&
    (body as { type: string }).type.startsWith("blob.")
  );
}

export async function GET() {
  const provider = getMediaStorageProvider();
  if (!provider) {
    return NextResponse.json(
      {
        configured: false,
        provider: null,
        error:
          "Media storage is not configured. Add Cloudflare R2 variables or connect Vercel Blob.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ configured: true, provider });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMediaStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "Media storage is not configured. Add Cloudflare R2 variables or connect Vercel Blob in your Vercel project.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    if (isBlobHandleUploadBody(body)) {
      if (!isBlobConfigured()) {
        return NextResponse.json(
          { error: "Vercel Blob is not configured." },
          { status: 503 }
        );
      }

      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => {
          const active = await getSession();
          if (!active) {
            throw new Error("Unauthorized");
          }
          return {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            tokenPayload: JSON.stringify({ userId: active.userId }),
          };
        },
        onUploadCompleted: async () => {
          // Upload completion is acknowledged client-side via blob URL.
        },
      });

      return NextResponse.json(jsonResponse);
    }

    const parsed = uploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const provider = getMediaStorageProvider();
    if (provider !== "r2") {
      return NextResponse.json(
        {
          error:
            "Use client upload for Vercel Blob storage.",
          provider: "vercel-blob",
        },
        { status: 400 }
      );
    }

    const { contentType, contentLength } = parsed.data;

    if (!isAllowedMimeType(contentType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use MP4, MOV, WebM, JPEG, PNG, or GIF.",
        },
        { status: 400 }
      );
    }

    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB." },
        { status: 400 }
      );
    }

    const ext = mimeToExtension(contentType);
    const key = buildObjectKey(session.userId, ext);
    const { uploadUrl, publicUrl } = await createPresignedUploadUrl(
      key,
      contentType,
      contentLength
    );

    const mediaType = contentType.startsWith("video/") ? "video" : "image";

    return NextResponse.json({
      provider: "r2",
      uploadUrl,
      mediaUrl: publicUrl,
      key,
      mediaType,
      contentType,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
