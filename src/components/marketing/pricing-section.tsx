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
        return;
      }
      alert(data.error || "Checkout failed. Check Stripe configuration.");
    } catch {
      alert("Checkout failed. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section className="py-24" id="pricing">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-xl">
          <p className="hud-label text-xs text-tally mb-3">Rate Card</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-4">
            Simple Pricing to Grow Your Social Platforms
          </h2>
          <p className="text-ink/60 text-lg leading-relaxed mb-2">
            Publish 10 Videos for FREE — No Credit Card Required
          </p>

          {showToggle && (
            <div className="inline-flex items-center gap-1 mt-6 border border-ink/15 p-1 rounded-sm">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={cn(
                  "hud-label px-4 py-2 text-[11px] transition-colors rounded-sm",
                  !yearly
                    ? "bg-ink text-paper"
                    : "text-ink/50 hover:text-ink"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={cn(
                  "hud-label px-4 py-2 text-[11px] transition-colors rounded-sm",
                  yearly
                    ? "bg-ink text-paper"
                    : "text-ink/50 hover:text-ink"
                )}
              >
                Yearly <span className="text-tally">(Save 17%)</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
          {planKeys.map((key, i) => {
            const plan = PLANS[key];
            const price = yearly ? plan.yearlyPrice : plan.price;
            const daily = yearly ? plan.yearlyDailyPrice : plan.dailyPrice;
            const isPopular = key === "pro";

            return (
              <div
                key={key}
                className={cn(
                  "relative frame-card p-8 pt-10",
                  isPopular && "ring-1 ring-inset ring-tally"
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="hud-label text-[10px] text-ink/40">
                    Tier {String(i + 1).padStart(2, "0")}
                  </span>
                  {isPopular && (
                    <span className="hud-label text-[10px] text-tally">
                      Most Popular
                    </span>
                  )}
                </div>

                <h3 className="font-display text-xl font-semibold text-ink mb-1">
                  {plan.name}
                </h3>
                <div className="mb-1">
                  <span className="font-display text-4xl font-semibold text-ink">
                    ${daily.toFixed(2)}
                  </span>
                  <span className="text-ink/50 text-sm">/day</span>
                </div>
                <p className="text-sm text-ink/50 mb-6">
                  ${price} billed {yearly ? "yearly" : "monthly"}
                </p>
                <p className="text-ink/60 text-sm mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2 text-sm text-ink/80">
                    <Check size={16} className="text-tally mt-0.5 shrink-0" />
                    Connect Up to {plan.accountsPerPlatform} Accounts per Platform
                  </li>
                  <li className="flex items-start gap-2 text-sm text-ink/80">
                    <Check size={16} className="text-tally mt-0.5 shrink-0" />
                    {plan.videosPerMonth === Infinity
                      ? "Unlimited Published Videos"
                      : `${plan.videosPerMonth.toLocaleString()} videos/month`}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-ink/80">
                    <Check size={16} className="text-tally mt-0.5 shrink-0" />
                    Auto-Resize & Watermark Removal
                  </li>
                  <li className="flex items-start gap-2 text-sm text-ink/80">
                    <Check size={16} className="text-tally mt-0.5 shrink-0" />
                    All Platform Integrations
                  </li>
                </ul>

                <Button
                  variant={isPopular ? "accent" : "outline"}
                  className="w-full"
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
