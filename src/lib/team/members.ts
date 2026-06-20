import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { teamMembers, users } from "@/lib/db/schema";
import type { UserPlan } from "@/lib/plans";

export type TeamRole = "admin" | "editor" | "viewer";

export async function getTeamForOwner(ownerId: string) {
  const db = getDb();
  return db
    .select({
      id: teamMembers.id,
      email: teamMembers.email,
      role: teamMembers.role,
      status: teamMembers.status,
      memberId: teamMembers.memberId,
      invitedAt: teamMembers.invitedAt,
      joinedAt: teamMembers.joinedAt,
      memberName: users.name,
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.memberId, users.id))
    .where(eq(teamMembers.ownerId, ownerId))
    .orderBy(teamMembers.invitedAt);
}

export async function getUserTeamRole(
  userId: string,
  email: string
): Promise<{ ownerId: string; role: TeamRole } | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.status, "active"),
        eq(teamMembers.memberId, userId)
      )
    )
    .limit(1);

  if (row) return { ownerId: row.ownerId, role: row.role as TeamRole };

  const [byEmail] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.email, email.toLowerCase()), eq(teamMembers.status, "pending")))
    .limit(1);

  if (byEmail) {
    await db
      .update(teamMembers)
      .set({ memberId: userId, status: "active", joinedAt: new Date() })
      .where(eq(teamMembers.id, byEmail.id));
    return { ownerId: byEmail.ownerId, role: byEmail.role as TeamRole };
  }

  return null;
}

export async function inviteTeamMember(
  ownerId: string,
  email: string,
  role: TeamRole
) {
  const db = getDb();
  const token = randomBytes(24).toString("hex");

  const [member] = await db
    .insert(teamMembers)
    .values({
      ownerId,
      email: email.toLowerCase(),
      role,
      status: "pending",
      inviteToken: token,
    })
    .returning();

  return { member, inviteToken: token };
}

export async function isAgencyOwner(userId: string, plan: UserPlan) {
  if (plan !== "agency") return false;
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(user);
}
