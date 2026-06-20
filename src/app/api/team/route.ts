import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTeamForOwner } from "@/lib/team/members";
import { planHasTeamCollaboration } from "@/lib/plans";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasTeamCollaboration(session.plan)) {
    return NextResponse.json({
      members: [],
      allowed: false,
      plan: session.plan,
    });
  }

  const members = await getTeamForOwner(session.userId);
  return NextResponse.json({
    members: members.map((m) => ({
      ...m,
      invitedAt: m.invitedAt.toISOString(),
      joinedAt: m.joinedAt?.toISOString() ?? null,
    })),
    allowed: true,
    plan: session.plan,
  });
}
