"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const planKeys = ["starter", "pro", "agency"] as const;

export function PricingSection({ showToggle = true }: { showToggle?: boolean }) {
  const [yearly, setYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheckout(plan: (typeof planKeys)[number]) {
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          interval: yearly ? "annual" : "monthly",
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/signup");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section className="paper-surface py-24" id="pricing">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <p className="hud-label mb-3 text-tally">Pricing</p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl mb-4">
            Simple Pricing to Grow Your Social Platforms
          </h2>
          <p className="text-ink-muted text-lg mb-2">
            Publish 10 Videos for FREE — No Credit Card Required
          </p>

          {showToggle && (
            <div className="mt-6 inline-flex items-center gap-1 border border-ink/15 bg-paper p-1">
              <button
                onClick={() => setYearly(false)}
                className={cn(
                  "px-5 py-2 text-sm font-medium transition-colors",
                  !yearly
                    ? "bg-ink text-paper"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                className={cn(
                  "px-5 py-2 text-sm font-medium transition-colors",
                  yearly
                    ? "bg-ink text-paper"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                Yearly{" "}
                <span className={yearly ? "text-paper/70" : "text-tally"}>
                  (Save 17%)
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {planKeys.map((key) => {
            const plan = PLANS[key];
            const price = yearly ? plan.yearlyPrice : plan.price;
            const daily = yearly ? plan.yearlyDailyPrice : plan.dailyPrice;
            const isPopular = key === "pro";

            return (
              <div
                key={key}
                className={cn(
                  "relative frame-card frame-card-interactive p-8",
                  isPopular && "border-tally/50 ring-1 ring-tally/30"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-tally px-4 py-1 font-mono text-[10px] font-semibold tracking-widest text-paper uppercase">
                    Most Popular
                  </div>
                )}

                <h3 className="font-display text-xl font-bold text-ink mb-1">
                  {plan.name}
                </h3>
                <div className="mb-1">
                  <span className="font-display text-4xl font-extrabold text-ink">
                    ${daily.toFixed(2)}
                  </span>
                  <span className="text-ink-muted text-sm">/day</span>
                </div>
                <p className="text-sm text-ink-muted mb-6">
                  ${price} billed {yearly ? "yearly" : "monthly"}
                </p>
                <p className="text-ink-muted text-sm mb-6">{plan.description}</p>

                <ul className="mb-8 space-y-3">
                  <li className="flex items-start gap-2 text-sm text-ink">
                    <Check size={16} className="mt-0.5 shrink-0 text-tally" />
                    Connect Up to {plan.accountsPerPlatform} Accounts per Platform
                  </li>
                  <li className="flex items-start gap-2 text-sm text-ink">
                    <Check size={16} className="mt-0.5 shrink-0 text-tally" />
                    {plan.videosPerMonth === Infinity
                      ? "Unlimited Published Videos"
                      : `${plan.videosPerMonth.toLocaleString()} videos/month`}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-ink">
                    <Check size={16} className="mt-0.5 shrink-0 text-tally" />
                    Auto-Resize & Watermark Removal
                  </li>
                  <li className="flex items-start gap-2 text-sm text-ink">
                    <Check size={16} className="mt-0.5 shrink-0 text-tally" />
                    All Platform Integrations
                  </li>
                </ul>

                <Button
                  variant={isPopular ? "primary" : "outline"}
                  className={cn(
                    "w-full !rounded-none",
                    isPopular &&
                      "!bg-tally hover:!bg-tally/90 !text-paper !shadow-none bg-none"
                  )}
                  onClick={() => handleCheckout(key)}
                  disabled={loadingPlan === key}
                >
                  {loadingPlan === key && (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  )}
                  {loadingPlan === key ? "Redirecting..." : "Get Started"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
