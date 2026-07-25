import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection({ signupHref = "/signup" }: { signupHref?: string }) {
  return (
    <section className="paper-surface py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative overflow-hidden border border-ink bg-ink p-12 text-center text-paper md:p-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-tally" />
          <div className="pointer-events-none absolute inset-0 opacity-20 bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,rgba(255,255,255,0.06)_24px)]" />
          <div className="relative">
            <p className="hud-label mb-4 text-tally">Next take</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl mb-4">
              Ready for Maximum Exposure?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-paper/70">
              Publish 10 Videos for FREE When You Start Your 14-Day Trial.
              No Obligation. No Credit Card Required.
            </p>
            <Button
              href={signupHref}
              size="lg"
              className="!rounded-none !bg-tally !text-paper hover:!bg-tally/90 !shadow-none"
            >
              Start Your 14-Day Free Trial
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
