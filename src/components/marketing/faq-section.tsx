"use client";

import { useState } from "react";
import { FAQ } from "@/lib/constants";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="paper-surface py-24">
      <div className="mx-auto max-w-3xl px-6">
        <p className="hud-label mb-3 text-center text-tally">FAQ</p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink text-center mb-12">
          Questions? We&apos;ve Got Answers.
        </h2>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div key={i} className="frame-card overflow-hidden">
              <button
                className="flex w-full items-center justify-between p-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-medium text-ink">{item.q}</span>
                <ChevronDown
                  size={20}
                  className={cn(
                    "ml-4 shrink-0 text-ink-muted transition-transform",
                    open === i && "rotate-180 text-tally"
                  )}
                />
              </button>
              {open === i && (
                <div className="border-t border-ink/10 px-5 pb-5 pt-3 text-sm leading-relaxed text-ink-muted">
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
