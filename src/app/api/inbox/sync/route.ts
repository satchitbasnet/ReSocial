import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncInboxForUser } from "@/lib/inbox/sync";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const synced = await syncInboxForUser(session.userId);
    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error("Inbox sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
