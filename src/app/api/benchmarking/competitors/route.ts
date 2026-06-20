import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { competitorAccounts } from "@/lib/db/schema";
import { planHasBenchmarking } from "@/lib/plans";

const createSchema = z.object({
  platform: z.enum(["tiktok", "youtube", "instagram", "facebook", "linkedin"]),
  handle: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasBenchmarking(session.plan)) {
    return NextResponse.json(
      { error: "Benchmarking requires Pro or Agency plan", upgradeRequired: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const handle = parsed.data.handle.replace(/^@/, "").trim();
  const db = getDb();

  const [existing] = await db
    .select({ id: competitorAccounts.id })
    .from(competitorAccounts)
    .where(
      and(
        eq(competitorAccounts.userId, session.userId),
        eq(competitorAccounts.platform, parsed.data.platform),
        eq(competitorAccounts.handle, handle)
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Already tracking this competitor" }, { status: 409 });
  }

  const [competitor] = await db
    .insert(competitorAccounts)
    .values({
      userId: session.userId,
      platform: parsed.data.platform,
      handle,
      displayName: handle,
    })
    .returning();

  return NextResponse.json({ competitor });
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
    .delete(competitorAccounts)
    .where(
      and(eq(competitorAccounts.id, id), eq(competitorAccounts.userId, session.userId))
    );

  return NextResponse.json({ success: true });
}
