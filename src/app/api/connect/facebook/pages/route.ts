import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fetchFacebookPages } from "@/lib/platforms/facebook";
import { upsertFacebookPageConnection, PENDING_FACEBOOK_TOKEN_COOKIE } from "@/lib/platforms/facebook-connect";
import { z } from "zod";

const COOKIE_TTL = 60 * 10;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_FACEBOOK_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Facebook authorization expired. Connect again." },
      { status: 400 }
    );
  }

  try {
    const pages = await fetchFacebookPages(token);
    return NextResponse.json({
      pages: pages.map((p) => ({
        pageId: p.pageId,
        displayName: p.displayName,
        followerCount: p.followerCount,
      })),
    });
  } catch (err) {
    console.error("Facebook pages list error:", err);
    return NextResponse.json(
      { error: "Failed to load Facebook Pages" },
      { status: 500 }
    );
  }
}

const connectSchema = z.object({
  pageIds: z.array(z.string()).min(1),
  label: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = connectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_FACEBOOK_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Facebook authorization expired. Connect again." },
      { status: 400 }
    );
  }

  try {
    const pages = await fetchFacebookPages(token);
    const selected = pages.filter((p) =>
      parsed.data.pageIds.includes(p.pageId)
    );

    if (selected.length === 0) {
      return NextResponse.json(
        { error: "No matching Pages found for selection" },
        { status: 400 }
      );
    }

    const db = getDb();
    const connected: string[] = [];

    for (const page of selected) {
      const id = await upsertFacebookPageConnection(
        db,
        session.userId,
        page,
        parsed.data.label
      );
      connected.push(id);
    }

    cookieStore.delete(PENDING_FACEBOOK_TOKEN_COOKIE);

    return NextResponse.json({ success: true, connectedCount: connected.length });
  } catch (err) {
    console.error("Facebook pages connect error:", err);
    return NextResponse.json(
      { error: "Failed to connect Facebook Pages" },
      { status: 500 }
    );
  }
}
