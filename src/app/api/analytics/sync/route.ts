import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAnalyticsDashboard } from "@/lib/analytics/queries";
import { fullSyncForUser } from "@/lib/analytics/sync";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await fullSyncForUser(session.userId);
    const data = await getAnalyticsDashboard(session.userId, "30d");
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Analytics sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync analytics" },
      { status: 500 }
    );
  }
}
