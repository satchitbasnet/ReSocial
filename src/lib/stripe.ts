import Stripe from "stripe";
import type { UserPlan } from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY must be set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export type BillingInterval = "monthly" | "annual";

const PRICE_ENV_KEYS: Record<UserPlan, Record<BillingInterval, string>> = {
  trial: { monthly: "", annual: "" },
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    annual: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    annual: "STRIPE_PRICE_PRO_ANNUAL",
  },
  agency: {
    monthly: "STRIPE_PRICE_AGENCY_MONTHLY",
    annual: "STRIPE_PRICE_AGENCY_ANNUAL",
  },
};

export function getPriceId(
  plan: Exclude<UserPlan, "trial">,
  interval: BillingInterval
): string {
  const envKey = PRICE_ENV_KEYS[plan][interval];
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(`${envKey} must be set`);
  }
  return priceId;
}

export function planFromPriceId(priceId: string): UserPlan | null {
  const map: Array<[UserPlan, BillingInterval]> = [
    ["starter", "monthly"],
    ["starter", "annual"],
    ["pro", "monthly"],
    ["pro", "annual"],
    ["agency", "monthly"],
    ["agency", "annual"],
  ];

  for (const [plan, interval] of map) {
    const envKey = PRICE_ENV_KEYS[plan][interval];
    if (process.env[envKey] === priceId) return plan;
  }
  return null;
}
