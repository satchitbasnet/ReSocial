import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import type { PlatformId } from "@/lib/constants";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const accounts = await db
      .select({
        id: connectedAccounts.id,
        platform: connectedAccounts.platform,
        accountName: connectedAccounts.accountName,
        isActive: connectedAccounts.isActive,
        connectedAt: connectedAccounts.connectedAt,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, session.userId));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Get accounts error:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

const connectSchema = z.object({
  platform: z.string(),
  accountName: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { platform, accountName } = parsed.data;
    const db = getDb();

    const [account] = await db
      .insert(connectedAccounts)
      .values({
        userId: session.userId,
        platform: platform as PlatformId,
        accountName,
        accountId: `demo_${platform}_${Date.now()}`,
        accessToken: "demo_token",
        isActive: true,
      })
      .returning();

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Connect account error:", error);
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("id");
  if (!accountId) {
    return NextResponse.json({ error: "Account ID required" }, { status: 400 });
  }

  try {
    const db = getDb();
    await db
      .delete(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.id, accountId),
          eq(connectedAccounts.userId, session.userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to disconnect account" }, { status: 500 });
  }
}
