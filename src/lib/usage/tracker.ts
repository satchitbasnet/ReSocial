import { eq, and, lte, gt, desc, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageMeters, users } from "@/lib/db/schema";
import { getProcessingOpsCap, type UserPlan } from "@/lib/plans";
import { getStripe, getSubscriptionBillingPeriod } from "@/lib/stripe";
import { checkAndSendCapWarning } from "@/lib/usage/warnings";

export interface UsageStatus {
  used: number;
  cap: number;
  percentUsed: number;
  periodEnd: Date;
  postsPublished: number;
}

function calendarMonthPeriod(reference = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)
  );
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1)
  );
  return { start, end };
}

/** Resolve billing window — Stripe subscription period when available, else calendar month. */
export async function resolveBillingPeriod(userId: string): Promise<{
  start: Date;
  end: Date;
}> {
  const db = getDb();
  const [user] = await db
    .select({
      stripeSubscriptionId: users.stripeSubscriptionId,
      billingPeriodStart: users.billingPeriodStart,
      billingPeriodEnd: users.billingPeriodEnd,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return calendarMonthPeriod();
  }

  const now = new Date();

  if (
    user.billingPeriodStart &&
    user.billingPeriodEnd &&
    user.billingPeriodEnd > now
  ) {
    return {
      start: user.billingPeriodStart,
      end: user.billingPeriodEnd,
    };
  }

  if (user.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );
      const period = getSubscriptionBillingPeriod(sub);
      if (!period) {
        return calendarMonthPeriod();
      }

      await db
        .update(users)
        .set({
          billingPeriodStart: period.start,
          billingPeriodEnd: period.end,
        })
        .where(eq(users.id, userId));

      return period;
    } catch (err) {
      console.error("[Usage] Stripe period sync failed:", err);
    }
  }

  return calendarMonthPeriod();
}

async function getOrCreateCurrentMeter(userId: string) {
  const db = getDb();
  const now = new Date();

  const [active] = await db
    .select()
    .from(usageMeters)
    .where(
      and(
        eq(usageMeters.userId, userId),
        lte(usageMeters.periodStart, now),
        gt(usageMeters.periodEnd, now)
      )
    )
    .orderBy(desc(usageMeters.periodStart))
    .limit(1);

  if (active) {
    return active;
  }

  const period = await resolveBillingPeriod(userId);

  const [existing] = await db
    .select()
    .from(usageMeters)
    .where(
      and(
        eq(usageMeters.userId, userId),
        eq(usageMeters.periodStart, period.start)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(usageMeters)
    .values({
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      processingOpsUsed: 0,
      postsPublished: 0,
      capWarningsSent: 0,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [race] = await db
    .select()
    .from(usageMeters)
    .where(
      and(
        eq(usageMeters.userId, userId),
        eq(usageMeters.periodStart, period.start)
      )
    )
    .limit(1);

  return race!;
}

export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  const db = getDb();
  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const plan = (user?.plan ?? "trial") as UserPlan;
  const cap = getProcessingOpsCap(plan);
  const meter = await getOrCreateCurrentMeter(userId);
  const used = meter.processingOpsUsed;

  return {
    used,
    cap,
    percentUsed: cap > 0 ? Math.round((used / cap) * 100) : 0,
    periodEnd: meter.periodEnd,
    postsPublished: meter.postsPublished,
  };
}

export async function isOverFairUseCap(userId: string): Promise<boolean> {
  const status = await getUsageStatus(userId);
  return status.used > status.cap;
}

export async function incrementUsage(
  userId: string,
  type: "processing" | "post"
): Promise<void> {
  const db = getDb();
  const meter = await getOrCreateCurrentMeter(userId);
  const now = new Date();

  if (type === "processing") {
    await db
      .update(usageMeters)
      .set({
        processingOpsUsed: meter.processingOpsUsed + 1,
        updatedAt: now,
      })
      .where(eq(usageMeters.id, meter.id));

    await checkAndSendCapWarning(userId);
    return;
  }

  await db
    .update(usageMeters)
    .set({
      postsPublished: meter.postsPublished + 1,
      updatedAt: now,
    })
    .where(eq(usageMeters.id, meter.id));
}

/** Sync billing periods from Stripe and roll forward expired meters (cron). */
export async function rollExpiredUsagePeriods(): Promise<{
  synced: number;
  rolled: number;
}> {
  const db = getDb();
  const now = new Date();
  let synced = 0;
  let rolled = 0;

  const subscribers = await db
    .select({
      id: users.id,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(isNotNull(users.stripeSubscriptionId));

  const withSubs = subscribers;

  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = getStripe();
    for (const user of withSubs) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId!
        );
        const period = getSubscriptionBillingPeriod(sub);
        if (period) {
          await db
            .update(users)
            .set({
              billingPeriodStart: period.start,
              billingPeriodEnd: period.end,
            })
            .where(eq(users.id, user.id));
          synced++;
        }
      } catch (err) {
        console.error(`[Usage] Stripe sync failed for ${user.id}:`, err);
      }
    }
  }

  const expiredMeters = await db
    .select({ userId: usageMeters.userId })
    .from(usageMeters)
    .where(lte(usageMeters.periodEnd, now));

  const uniqueUserIds = [...new Set(expiredMeters.map((m) => m.userId))];

  for (const userId of uniqueUserIds) {
    const [active] = await db
      .select({ id: usageMeters.id })
      .from(usageMeters)
      .where(
        and(
          eq(usageMeters.userId, userId),
          lte(usageMeters.periodStart, now),
          gt(usageMeters.periodEnd, now)
        )
      )
      .limit(1);

    if (!active) {
      await getOrCreateCurrentMeter(userId);
      rolled++;
    }
  }

  return { synced, rolled };
}
