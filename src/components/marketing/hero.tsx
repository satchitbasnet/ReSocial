import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

interface HeroProps {
  badge?: string;
  title: string;
  subtitle: string;
  cta?: string;
}

export function Hero({
  badge = "Post Once, Reach Everywhere",
  title,
  subtitle,
  cta = "Start Your 14-Day Free Trial",
}: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="absolute inset-0 gradient-bg opacity-[0.03]" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Zap size={14} />
          {badge}
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6 max-w-4xl mx-auto">
          {title}
        </h1>

        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" href="/signup">
            {cta}
            <ArrowRight size={18} className="ml-2" />
          </Button>
          <p className="text-sm text-gray-500">No Credit Card Required</p>
        </div>
      </div>
    </section>
  );
}
