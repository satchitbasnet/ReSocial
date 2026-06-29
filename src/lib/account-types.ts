import { PLANS, type PlanId } from "./constants";

export const ACCOUNT_TYPES = [
  {
    id: "creator" as const,
    label: "Content Creator",
    description: "Solo creators publishing across social platforms.",
    recommendedPlan: "starter" as const satisfies PlanId,
  },
  {
    id: "small_business" as const,
    label: "Small Business",
    description: "Local shops and brands managing their own presence.",
    recommendedPlan: "pro" as const satisfies PlanId,
  },
  {
    id: "agency" as const,
    label: "Agency",
    description: "Teams managing multiple client accounts.",
    recommendedPlan: "agency" as const satisfies PlanId,
  },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["id"];

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function accountTypeRecommendedPlan(type: AccountType): PlanId {
  return ACCOUNT_TYPES.find((t) => t.id === type)?.recommendedPlan ?? "starter";
}

export function accountTypePricingHint(type: AccountType): string {
  const plan = PLANS[accountTypeRecommendedPlan(type)];
  return `${plan.name} from $${plan.price}/mo after your free trial.`;
}

/** Build signup URL with optional pre-selected account type (and referral). */
export function signupHref(
  type?: AccountType,
  options?: { ref?: string }
): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (options?.ref) params.set("ref", options.ref);
  const qs = params.toString();
  return qs ? `/signup?${qs}` : "/signup";
}

/** Parse `?type=` from marketing links (`creator`, `small-business`, `agency`, etc.). */
export function parseAccountTypeParam(value: string | null): AccountType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "smallbusiness") return "small_business";
  return ACCOUNT_TYPES.find((t) => t.id === normalized)?.id ?? null;
}
