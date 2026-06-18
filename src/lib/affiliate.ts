import { randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { affiliates, referrals } from "@/lib/db/schema";
import { PLANS } from "@/lib/constants";
import { getAppUrl } from "@/lib/config";

export const AFFILIATE_COMMISSION_RATE = 0.3;
export const AFFILIATE_COMMISSION_MONTHS = 3;

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function createAffiliateForUser(
  userId: string
): Promise<{ referralCode: string }> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.userId, userId))
    .limit(1);

  if (existing) {
    return { referralCode: existing.referralCode };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = generateReferralCode();
    try {
      await db.insert(affiliates).values({ userId, referralCode });
      return { referralCode };
    } catch {
      // Unique collision on referralCode — retry
    }
  }

  throw new Error("Failed to generate unique referral code");
}

export async function recordReferralOnSignup(
  referralCode: string,
  referredUserId: string
): Promise<void> {
  const code = referralCode.trim().toUpperCase();
  if (!code) return;

  const db = getDb();

  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.referralCode, code))
    .limit(1);

  if (!affiliate || affiliate.userId === referredUserId) {
    return;
  }

  const [existingReferral] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.referredUserId, referredUserId))
    .limit(1);

  if (existingReferral) return;

  await db.insert(referrals).values({
    affiliateId: affiliate.id,
    referredUserId,
    status: "pending",
  });

  await db
    .update(affiliates)
    .set({ totalReferrals: affiliate.totalReferrals + 1 })
    .where(eq(affiliates.id, affiliate.id));
}

/**
 * Credit 30% commission for up to the first 3 subscription payments.
 */
export async function creditAffiliateCommission(
  referredUserId: string,
  amountPaidCents: number
): Promise<void> {
  if (amountPaidCents <= 0) return;

  const db = getDb();

  const [referral] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referredUserId, referredUserId))
    .limit(1);

  if (!referral || referral.monthsCredited >= AFFILIATE_COMMISSION_MONTHS) {
    return;
  }

  const commissionCents = Math.round(amountPaidCents * AFFILIATE_COMMISSION_RATE);

  await db
    .update(referrals)
    .set({
      status: "converted",
      commission: referral.commission + commissionCents,
      monthsCredited: referral.monthsCredited + 1,
    })
    .where(eq(referrals.id, referral.id));

  await db
    .update(affiliates)
    .set({
      totalEarnings: sql`${affiliates.totalEarnings} + ${commissionCents}`,
    })
    .where(eq(affiliates.id, referral.affiliateId));
}

export function buildReferralLink(referralCode: string): string {
  return `${getAppUrl()}/signup?ref=${encodeURIComponent(referralCode)}`;
}

/** Estimated earnings from pending referrals (30% × 3 months × starter monthly). */
export function estimatePendingEarnings(pendingCount: number): number {
  const monthlyStarterCents = PLANS.starter.price * 100;
  const perReferral =
    monthlyStarterCents * AFFILIATE_COMMISSION_MONTHS * AFFILIATE_COMMISSION_RATE;
  return Math.round(pendingCount * perReferral);
}

export interface AffiliateDashboardData {
  enrolled: boolean;
  referralCode?: string;
  referralLink?: string;
  totalReferrals: number;
  convertedReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
  totalEarnings: number;
  estimatedEarnings: number;
}

export async function getAffiliateDashboard(
  userId: string
): Promise<AffiliateDashboardData> {
  const db = getDb();

  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.userId, userId))
    .limit(1);

  if (!affiliate) {
    return {
      enrolled: false,
      totalReferrals: 0,
      convertedReferrals: 0,
      pendingReferrals: 0,
      conversionRate: 0,
      totalEarnings: 0,
      estimatedEarnings: 0,
    };
  }

  const referralRows = await db
    .select({ status: referrals.status })
    .from(referrals)
    .where(eq(referrals.affiliateId, affiliate.id));

  const convertedReferrals = referralRows.filter(
    (r) => r.status === "converted"
  ).length;
  const pendingReferrals = referralRows.filter(
    (r) => r.status === "pending"
  ).length;
  const totalReferrals = affiliate.totalReferrals;
  const conversionRate =
    totalReferrals > 0
      ? Math.round((convertedReferrals / totalReferrals) * 1000) / 10
      : 0;

  const totalEarningsCents = affiliate.totalEarnings;
  const estimatedPendingCents = estimatePendingEarnings(pendingReferrals);

  return {
    enrolled: true,
    referralCode: affiliate.referralCode,
    referralLink: buildReferralLink(affiliate.referralCode),
    totalReferrals,
    convertedReferrals,
    pendingReferrals,
    conversionRate,
    totalEarnings: totalEarningsCents / 100,
    estimatedEarnings: (totalEarningsCents + estimatedPendingCents) / 100,
  };
}
