import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection({ signupHref = "/signup" }: { signupHref?: string }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative border border-ink/15 bg-ink text-paper p-12 md:p-16 overflow-hidden">
          <span className="pointer-events-none absolute top-4 left-4 hud-label text-[10px] text-paper/40 flex items-center gap-1.5">
            <span className="tally-dot" style={{ width: 6, height: 6 }} />
            Outro
          </span>
          <span className="pointer-events-none absolute bottom-4 right-4 hud-label text-[10px] text-paper/30">
            Take 01
          </span>

          <div className="relative max-w-xl">
            <p className="hud-label text-xs text-tally mb-4">Call Sheet</p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4 leading-tight">
              Ready for Maximum Exposure?
            </h2>
            <p className="text-paper/65 text-lg mb-8 leading-relaxed">
              Publish 10 Videos for FREE When You Start Your 14-Day Trial.
              No Obligation. No Credit Card Required.
            </p>
            <Button href={signupHref} size="lg" variant="accent">
              Start Your 14-Day Free Trial
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
