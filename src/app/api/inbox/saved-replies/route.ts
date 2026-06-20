import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { savedReplies } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const replies = await db
    .select()
    .from(savedReplies)
    .where(eq(savedReplies.userId, session.userId))
    .orderBy(desc(savedReplies.createdAt));

  return NextResponse.json({ replies });
}

const createSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const [reply] = await db
    .insert(savedReplies)
    .values({
      userId: session.userId,
      title: parsed.data.title,
      content: parsed.data.content,
    })
    .returning();

  return NextResponse.json({ reply });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(savedReplies)
    .where(and(eq(savedReplies.id, id), eq(savedReplies.userId, session.userId)));

  return NextResponse.json({ success: true });
}
