import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAffiliateDashboard } from "@/lib/affiliate";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getAffiliateDashboard(session.userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Affiliate dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load affiliate dashboard" },
      { status: 500 }
    );
  }
}
