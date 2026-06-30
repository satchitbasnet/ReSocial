import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { getUserTeamRole, type TeamRole } from "@/lib/team/members";

export interface PublishContext {
  workspaceUserId: string;
  requiresApproval: boolean;
  actorUserId: string;
  actorRole: TeamRole | "owner";
}

/** Resolve whose workspace a publish belongs to and whether approval is required. */
export async function resolvePublishContext(
  userId: string,
  email: string
): Promise<PublishContext> {
  const membership = await getUserTeamRole(userId, email);

  if (membership?.role === "editor") {
    return {
      workspaceUserId: membership.ownerId,
      requiresApproval: true,
      actorUserId: userId,
      actorRole: "editor",
    };
  }

  if (membership?.role === "viewer") {
    throw new Error("Viewers cannot publish content");
  }

  if (membership?.role === "admin") {
    return {
      workspaceUserId: membership.ownerId,
      requiresApproval: false,
      actorUserId: userId,
      actorRole: "admin",
    };
  }

  return {
    workspaceUserId: userId,
    requiresApproval: false,
    actorUserId: userId,
    actorRole: "owner",
  };
}

export async function canReviewApprovals(
  userId: string,
  workspaceUserId: string
): Promise<boolean> {
  if (userId === workspaceUserId) return true;

  const db = getDb();
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.ownerId, workspaceUserId),
        eq(teamMembers.memberId, userId),
        eq(teamMembers.status, "active")
      )
    )
    .limit(1);

  return row?.role === "admin";
}

export async function listWorkspaceTeamMembers(workspaceUserId: string) {
  const db = getDb();
  return db
    .select({
      id: teamMembers.memberId,
      email: teamMembers.email,
      role: teamMembers.role,
      status: teamMembers.status,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.ownerId, workspaceUserId),
        eq(teamMembers.status, "active")
      )
    );
}
