import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  buildObjectKey,
  createPresignedUploadUrl,
  isAllowedMimeType,
  isR2Configured,
  MAX_UPLOAD_BYTES,
  mimeToExtension,
} from "@/lib/r2";

const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Media storage is not configured. Set R2 environment variables." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = uploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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
      uploadUrl,
      mediaUrl: publicUrl,
      key,
      mediaType,
      contentType,
    });
  } catch (error) {
    console.error("Presigned upload error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
