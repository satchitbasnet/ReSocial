import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { connectedAccounts, users } from "@/lib/db/schema";

export type UserPlan = "trial" | "starter" | "pro" | "agency";

export interface PlanLimitError {
  error: string;
  upgradeRequired: true;
  limit: "videos" | "platforms";
}

const PLATFORM_LIMITS: Record<UserPlan, number> = {
  trial: 3,
  starter: 5,
  pro: Infinity,
  agency: Infinity,
};

const VIDEO_LIMITS: Record<UserPlan, number> = {
  trial: 10,
  starter: Infinity,
  pro: Infinity,
  agency: Infinity,
};

export async function checkCanConnectPlatform(
  userId: string,
  plan: UserPlan
): Promise<PlanLimitError | null> {
  const maxPlatforms = PLATFORM_LIMITS[plan];
  if (!Number.isFinite(maxPlatforms)) return null;

  const db = getDb();
  const accounts = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.isActive, true)
      )
    );

  if (accounts.length >= maxPlatforms) {
    return {
      error: `Plan limit reached: ${plan} allows up to ${maxPlatforms} connected platforms.`,
      upgradeRequired: true,
      limit: "platforms",
    };
  }

  return null;
}

export async function checkCanPublish(
  userId: string,
  plan: UserPlan
): Promise<PlanLimitError | null> {
  const maxVideos = VIDEO_LIMITS[plan];
  if (!Number.isFinite(maxVideos)) return null;

  const db = getDb();
  const [user] = await db
    .select({ videosPublished: users.videosPublished })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user && user.videosPublished >= maxVideos) {
    return {
      error: `Trial limit reached (${maxVideos} videos). Upgrade to publish more.`,
      upgradeRequired: true,
      limit: "videos",
    };
  }

  return null;
}

export function planHasFullAnalytics(plan: string): boolean {
  return ["pro", "agency"].includes(plan);
}

export function planHasBestTimeInsight(plan: string): boolean {
  return ["pro", "agency"].includes(plan);
}

export function planHasFollowerTracking(plan: string): boolean {
  return ["pro", "agency"].includes(plan);
}

export function planHasTeamCollaboration(plan: string): boolean {
  return plan === "agency";
}

export function planHasBenchmarking(plan: string): boolean {
  return ["pro", "agency"].includes(plan);
}

const HASHTAG_LIMITS: Record<UserPlan, number> = {
  trial: 5,
  starter: 10,
  pro: 25,
  agency: 50,
};

/** Soft fair-use caps for ffmpeg processing ops per billing period. */
export const PROCESSING_OPS_CAPS: Record<UserPlan, number> = {
  trial: 30,
  starter: 150,
  pro: 500,
  agency: 2000,
};

export function getProcessingOpsCap(plan: UserPlan): number {
  return PROCESSING_OPS_CAPS[plan];
}

export function getHashtagLimit(plan: UserPlan): number {
  return HASHTAG_LIMITS[plan];
}
