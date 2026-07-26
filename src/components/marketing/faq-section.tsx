"use client";

import { useState } from "react";
import { FAQ } from "@/lib/constants";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12">
          <p className="hud-label text-xs text-tally mb-3">Q Sheet</p>
          <h2 className="font-display text-3xl font-semibold text-ink">
            Questions? We&apos;ve Got Answers.
          </h2>
        </div>

        <div className="border border-ink/10 divide-y divide-ink/10">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-paper">
              <button
                type="button"
                className="w-full flex items-center justify-between p-5 text-left hover:bg-ink/[0.02] transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-display font-medium text-ink pr-4">
                  <span className="hud-label text-[10px] text-ink/35 mr-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.q}
                </span>
                <ChevronDown
                  size={18}
                  className={cn(
                    "text-ink/40 transition-transform shrink-0",
                    open === i && "rotate-180 text-tally"
                  )}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 pl-[3.25rem] text-ink/60 text-sm leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
