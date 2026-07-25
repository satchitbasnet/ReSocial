import { FEATURES } from "@/lib/constants";
import {
  Radio,
  Workflow,
  Maximize2,
  Calendar,
  Eraser,
  Layout,
} from "lucide-react";

const iconMap = {
  broadcast: Radio,
  workflow: Workflow,
  resize: Maximize2,
  calendar: Calendar,
  eraser: Eraser,
  template: Layout,
};

export function FeaturesGrid() {
  return (
    <section className="paper-surface py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-2xl">
          <p className="hud-label mb-3 text-tally">Features</p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            Powerful Tools That Make Your Life Easier
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted md:text-lg">
            Discover all the fantastic tools that will transform how you
            distribute content across social media.
          </p>
          <div className="mt-6 tally-rule max-w-[120px]" />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = iconMap[feature.icon];
            return (
              <div
                key={feature.title}
                className="frame-card frame-card-interactive p-7"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center border border-ink/15 text-tally">
                    <Icon size={22} strokeWidth={1.75} />
                  </div>
                  <span className="hud-label tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-ink mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-muted">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
