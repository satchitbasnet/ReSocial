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
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <p className="text-brand-600 font-semibold text-sm uppercase tracking-wider mb-3">
            Features
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Tools That Make Your Life Easier
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Discover all the fantastic tools that will transform how you
            distribute content across social media.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <div
                key={feature.title}
                className="glass-card glass-card-interactive p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 mb-5">
                  <Icon size={24} />
                </div>
                <h3 className="font-display text-lg font-medium text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
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
