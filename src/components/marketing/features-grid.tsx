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
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-xl">
          <p className="hud-label text-xs text-tally mb-3">Shot List</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-4">
            Everything Between Upload and Published
          </h2>
          <p className="text-ink/60 text-lg leading-relaxed">
            Six things happen to your clip before it ever reaches a feed.
            None of them require you to open an editor twice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
          {FEATURES.map((feature, i) => {
            const Icon = iconMap[feature.icon];
            return (
              <div key={feature.title} className="frame-card p-8 pt-9">
                <div className="flex items-center justify-between mb-6">
                  <span className="hud-label text-[10px] text-ink/40">
                    Frame {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon size={18} strokeWidth={1.75} className="text-tally" />
                </div>
                <h3 className="font-display text-lg font-medium text-ink mb-2">
                  {feature.title}
                </h3>
                <p className="text-ink/60 text-sm leading-relaxed">
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
