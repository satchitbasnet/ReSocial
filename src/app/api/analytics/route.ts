import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  getAnalyticsDashboard,
} from "@/lib/analytics/queries";
import { fullSyncForUser } from "@/lib/analytics/sync";
import {
  planHasBestTimeInsight,
  planHasFollowerTracking,
} from "@/lib/plans";

const querySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  try {
    const data = await getAnalyticsDashboard(
      session.userId,
      parsed.data.range
    );

    const showBestTime = planHasBestTimeInsight(session.plan);
    const showFollowers = planHasFollowerTracking(session.plan);

    return NextResponse.json({
      ...data,
      bestTimeToPost: showBestTime ? data.bestTimeToPost : [],
      summary: {
        ...data.summary,
        newFollowers: showFollowers ? data.summary.newFollowers : 0,
      },
      features: {
        bestTimeToPost: showBestTime,
        followerTracking: showFollowers,
        plan: session.plan,
      },
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}

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
