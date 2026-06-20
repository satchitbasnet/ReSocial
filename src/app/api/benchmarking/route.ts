import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBenchmarkingData, syncCompetitorsForUser } from "@/lib/benchmarking/sync";
import { planHasBenchmarking } from "@/lib/plans";

export async function GET() {
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

  const data = await getBenchmarkingData(session.userId);
  return NextResponse.json(data);
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasBenchmarking(session.plan)) {
    return NextResponse.json({ error: "Pro or Agency plan required" }, { status: 403 });
  }

  const synced = await syncCompetitorsForUser(session.userId);
  const data = await getBenchmarkingData(session.userId);
  return NextResponse.json({ synced, ...data });
}
