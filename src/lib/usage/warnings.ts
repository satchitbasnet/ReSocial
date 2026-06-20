import { eq, and, lte, gt, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageMeters, users } from "@/lib/db/schema";
import { getUsageStatus } from "@/lib/usage/tracker";
import { sendEmail } from "@/lib/email/resend";
import { getAppUrl } from "@/lib/config";

const WARN_APPROACHING = 1;
const WARN_EXCEEDED = 2;

function contactUrl(): string {
  return (
    process.env.USAGE_CONTACT_URL ??
    `${getAppUrl()}/dashboard/settings?contact=usage`
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function sendApproachingCapEmail(
  email: string,
  name: string,
  used: number,
  cap: number,
  periodEnd: Date
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "You're approaching your monthly processing limit",
    html: `
      <div style="font-family:sans-serif;max-width:560px;color:#111">
        <p>Hi ${name.split(" ")[0]},</p>
        <p>You've used <strong>${used} of ${cap}</strong> video processing operations this billing period (auto-resize and watermark removal).</p>
        <p>Your posts will keep publishing normally — nothing is blocked. If you reach the limit, we'll temporarily skip automatic processing until your cycle resets on <strong>${formatDate(periodEnd)}</strong>.</p>
        <p>Most creators never hit this threshold. If you're consistently processing high volumes and want dedicated capacity, we'd love to chat — just reply to this email or <a href="${contactUrl()}">reach out here</a>.</p>
        <p style="color:#666;font-size:13px">— The ReSocial team</p>
      </div>
    `,
  });
}

async function sendExceededCapEmail(
  email: string,
  name: string,
  used: number,
  cap: number,
  periodEnd: Date
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Let's talk about your processing volume",
    html: `
      <div style="font-family:sans-serif;max-width:560px;color:#111">
        <p>Hi ${name.split(" ")[0]},</p>
        <p>You've been publishing at a higher volume than typical this month (<strong>${used} processing ops</strong> vs. a ${cap} fair-use reference for your plan).</p>
        <p><strong>Good news:</strong> your posts are still going out — we've temporarily paused auto-resize and watermark removal until <strong>${formatDate(periodEnd)}</strong>, when your processing allowance refreshes. Raw uploads are unaffected.</p>
        <p>If this is your normal workflow, we'd love to find a setup that fits — whether that's a custom Agency arrangement or adjusted limits. <a href="${contactUrl()}">Book a quick chat</a> or reply to this email and we'll take care of you.</p>
        <p style="color:#666;font-size:13px">— The ReSocial team</p>
      </div>
    `,
  });
}

export async function checkAndSendCapWarning(userId: string): Promise<void> {
  const db = getDb();
  const status = await getUsageStatus(userId);

  const [user] = await db
    .select({
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return;

  const meters = await db
    .select()
    .from(usageMeters)
    .where(
      and(
        eq(usageMeters.userId, userId),
        lte(usageMeters.periodStart, new Date()),
        gt(usageMeters.periodEnd, new Date())
      )
    )
    .orderBy(desc(usageMeters.periodStart))
    .limit(1);

  const current = meters[0];
  if (!current) return;

  let warningsSent = current.capWarningsSent;
  let updated = false;

  if (status.percentUsed >= 80 && !(warningsSent & WARN_APPROACHING)) {
    await sendApproachingCapEmail(
      user.email,
      user.name,
      status.used,
      status.cap,
      status.periodEnd
    );
    warningsSent |= WARN_APPROACHING;
    updated = true;
  }

  if (status.used > status.cap && !(warningsSent & WARN_EXCEEDED)) {
    await sendExceededCapEmail(
      user.email,
      user.name,
      status.used,
      status.cap,
      status.periodEnd
    );
    warningsSent |= WARN_EXCEEDED;
    updated = true;
  }

  if (updated) {
    await db
      .update(usageMeters)
      .set({ capWarningsSent: warningsSent, updatedAt: new Date() })
      .where(eq(usageMeters.id, current.id));
  }
}
