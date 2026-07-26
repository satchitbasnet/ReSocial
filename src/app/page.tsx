import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/marketing/hero";
import { PlatformLogos } from "@/components/marketing/platform-logos";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQSection } from "@/components/marketing/faq-section";
import { CTASection } from "@/components/marketing/cta-section";
import { Clock, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />

        <section className="py-16 border-y border-ink/10">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <p className="hud-label text-xs text-ink/45 mb-8">
              Trusted Integration Partners
            </p>
            <PlatformLogos />
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="hud-label text-xs text-tally mb-3">Throughput</p>
                <h2 className="font-display text-3xl font-bold text-ink mb-6">
                  Make Waves on Social
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-ink/15 bg-paper text-tally">
                      <Clock size={22} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-ink">
                        Save Up to 20 Hours per Week
                      </p>
                      <p className="text-ink/60 text-sm mt-1">
                        Automatic Cross-Platform Posting Eliminates Manual Uploads
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-ink/15 bg-paper text-tally">
                      <TrendingUp size={22} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-ink">
                        Up to 50% More Engagement
                      </p>
                      <p className="text-ink/60 text-sm mt-1">
                        Achieve 30% Follower Growth With Omnipresence
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-ink text-paper border border-ink rounded-md p-8 relative overflow-hidden">
                <span className="pointer-events-none absolute top-4 left-4 hud-label text-[10px] text-paper/40 flex items-center gap-1.5">
                  <span className="tally-dot" style={{ width: 6, height: 6 }} />
                  Distribution
                </span>
                <div className="space-y-4 pt-4">
                  <div className="border border-paper/15 bg-paper/[0.06] rounded-md p-4">
                    <p className="hud-label text-[10px] text-paper/50 mb-1">
                      Upload Once
                    </p>
                    <p className="font-semibold text-paper">
                      Your video → ReSocial
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <div className="h-8 w-px bg-paper/25" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {["TikTok", "YouTube", "Instagram", "Facebook"].map((p) => (
                      <div
                        key={p}
                        className="border border-paper/15 bg-paper/[0.06] rounded-md p-3 text-center"
                      >
                        <p className="text-xs font-medium text-paper">{p}</p>
                        <p className="text-focus text-xs mt-1">✓ Published</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FeaturesGrid />
        <Testimonials />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
