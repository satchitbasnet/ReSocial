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
