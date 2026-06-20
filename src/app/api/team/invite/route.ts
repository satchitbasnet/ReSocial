import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { inviteTeamMember } from "@/lib/team/members";
import { planHasTeamCollaboration } from "@/lib/plans";
import { getAppUrl } from "@/lib/config";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!planHasTeamCollaboration(session.plan)) {
    return NextResponse.json(
      { error: "Team collaboration requires Agency plan", upgradeRequired: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { member, inviteToken } = await inviteTeamMember(
    session.userId,
    parsed.data.email,
    parsed.data.role
  );

  const inviteUrl = `${getAppUrl()}/signup?team=${inviteToken}`;

  return NextResponse.json({
    member: {
      id: member.id,
      email: member.email,
      role: member.role,
      status: member.status,
    },
    inviteUrl,
  });
}
