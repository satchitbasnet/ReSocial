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
    <section className="py-24" id="pricing">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple Pricing to Grow Your Social Platforms
          </h2>
          <p className="text-gray-600 text-lg mb-2">
            Publish 10 Videos for FREE — No Credit Card Required
          </p>

          {showToggle && (
            <div className="inline-flex items-center gap-3 mt-6 bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setYearly(false)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all",
                  !yearly ? "bg-white shadow text-gray-900" : "text-gray-500"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all",
                  yearly ? "bg-white shadow text-gray-900" : "text-gray-500"
                )}
              >
                Yearly <span className="text-brand-600">(Save 17%)</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {planKeys.map((key) => {
            const plan = PLANS[key];
            const price = yearly ? plan.yearlyPrice : plan.price;
            const daily = yearly ? plan.yearlyDailyPrice : plan.dailyPrice;
            const isPopular = key === "pro";

            return (
              <div
                key={key}
                className={cn(
                  "relative rounded-2xl p-8 border transition-all duration-300",
                  isPopular
                    ? "border-brand-500 shadow-xl shadow-brand-500/10 scale-105 bg-white"
                    : "border-gray-200 bg-white hover:shadow-lg"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
                  {plan.name}
                </h3>
                <div className="mb-1">
                  <span className="font-display text-4xl font-bold text-gray-900">
                    ${daily.toFixed(2)}
                  </span>
                  <span className="text-gray-500 text-sm">/day</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  ${price} billed {yearly ? "yearly" : "monthly"}
                </p>
                <p className="text-gray-600 text-sm mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-brand-600 mt-0.5 shrink-0" />
                    Connect Up to {plan.accountsPerPlatform} Accounts per Platform
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-brand-600 mt-0.5 shrink-0" />
                    {plan.videosPerMonth === Infinity
                      ? "Unlimited Published Videos"
                      : `${plan.videosPerMonth.toLocaleString()} videos/month`}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-brand-600 mt-0.5 shrink-0" />
                    Auto-Resize & Watermark Removal
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-brand-600 mt-0.5 shrink-0" />
                    All Platform Integrations
                  </li>
                </ul>

                <Button
                  variant={isPopular ? "primary" : "outline"}
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
