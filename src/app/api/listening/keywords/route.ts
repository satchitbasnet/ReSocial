import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { trackedKeywords } from "@/lib/db/schema";
import { analyzeSentiment } from "@/lib/listening/sentiment";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const keywords = await db
    .select()
    .from(trackedKeywords)
    .where(eq(trackedKeywords.userId, session.userId))
    .orderBy(desc(trackedKeywords.createdAt));

  return NextResponse.json({ keywords });
}

const createSchema = z.object({
  keyword: z.string().min(1).max(100),
  platform: z.string().optional(),
  sampleText: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const keyword = parsed.data.keyword.trim().toLowerCase();
  const sentiment = parsed.data.sampleText
    ? analyzeSentiment(parsed.data.sampleText)
    : "neutral";

  const db = getDb();
  const [row] = await db
    .insert(trackedKeywords)
    .values({
      userId: session.userId,
      keyword,
      platform: parsed.data.platform as
        | "tiktok"
        | "youtube"
        | "instagram"
        | "facebook"
        | undefined,
      sentiment,
      mentionCount: parsed.data.sampleText ? 1 : 0,
    })
    .returning();

  return NextResponse.json({ keyword: row });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(trackedKeywords)
    .where(
      and(eq(trackedKeywords.id, id), eq(trackedKeywords.userId, session.userId))
    );

  return NextResponse.json({ success: true });
}
