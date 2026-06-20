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
          subtitle="Connect with all major social media platforms. Upload once and automatically post videos, stories, and audio across TikTok, YouTube, Instagram, Facebook, LinkedIn, X, and more."
        />

        <section className="py-16 border-y border-gray-100 bg-white">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
              Trusted Integration Partners
            </p>
            <PlatformLogos />
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Make Waves on Social
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        Save Up to 20 Hours per Week
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        Automatic Cross-Platform Posting Eliminates Manual Uploads
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        Up to 50% More Engagement
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        Achieve 30% Follower Growth With Omnipresence
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="gradient-bg rounded-3xl p-8 text-white">
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                    <p className="text-sm opacity-80">Upload Once</p>
                    <p className="font-semibold">Your video → ReSocial</p>
                  </div>
                  <div className="flex justify-center">
                    <div className="h-8 w-px bg-white/30" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {["TikTok", "YouTube", "Instagram"].map((p) => (
                      <div key={p} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur">
                        <p className="text-xs font-medium">{p}</p>
                        <p className="text-green-300 text-xs mt-1">✓ Published</p>
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
