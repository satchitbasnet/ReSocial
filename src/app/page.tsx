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
        <Hero
          title="The #1 Automated Content Repurposing Platform"
          subtitle="Connect with all major social media platforms. Upload once and automatically post videos, stories, and audio across TikTok, YouTube, Instagram, Facebook, X, and more."
        />

        <section className="py-16 border-y border-ink/10 paper-surface">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <p className="hud-label mb-8">Trusted Integration Partners</p>
            <PlatformLogos />
          </div>
        </section>

        <section className="paper-surface py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="hud-label mb-3 text-tally">Outcomes</p>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink mb-6">
                  Make Waves on Social
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-ink/15 text-tally">
                      <Clock size={24} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-display font-bold text-ink">
                        Save Up to 20 Hours per Week
                      </p>
                      <p className="text-ink-muted text-sm mt-1">
                        Automatic Cross-Platform Posting Eliminates Manual Uploads
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-ink/15 text-tally">
                      <TrendingUp size={24} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-display font-bold text-ink">
                        Up to 50% More Engagement
                      </p>
                      <p className="text-ink-muted text-sm mt-1">
                        Achieve 30% Follower Growth With Omnipresence
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border border-ink bg-ink p-8 text-paper">
                <div className="space-y-4">
                  <div className="border border-white/15 p-4">
                    <p className="hud-label text-tally mb-1">Upload Once</p>
                    <p className="font-display font-semibold">Your video → ReSocial</p>
                  </div>
                  <div className="flex justify-center">
                    <div className="h-8 w-px bg-white/25" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {["TikTok", "YouTube", "Instagram"].map((p) => (
                      <div key={p} className="border border-white/15 p-3 text-center">
                        <p className="text-xs font-medium">{p}</p>
                        <p className="text-tally text-xs mt-1 font-mono tracking-wider">
                          PUBLISHED
                        </p>
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
