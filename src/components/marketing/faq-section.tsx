"use client";

import { useState } from "react";
import { FAQ } from "@/lib/constants";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-24 bg-gray-50">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Questions? We&apos;ve Got Answers.
        </h2>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-medium text-gray-900">{item.q}</span>
                <ChevronDown
                  size={20}
                  className={cn(
                    "text-gray-400 transition-transform shrink-0 ml-4",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed">
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
