import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/marketing/hero";
import { PlatformLogos } from "@/components/marketing/platform-logos";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { PricingSection } from "@/components/marketing/pricing-section";
import { CTASection } from "@/components/marketing/cta-section";
import { signupHref } from "@/lib/account-types";

export default function CreatorsPage() {
  const signupUrl = signupHref("creator");
  return (
    <>
      <Navbar />
      <main>
        <Hero
          badge="Content Creators' Dream Tool"
          title="Distribute Your Content Everywhere"
          subtitle="Reach a larger audience, gain more followers, and grow your accounts through seamless omnipresence and automated content sharing."
          signupHref={signupUrl}
        />
        <section className="py-16 border-y border-gray-100">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
              Distribute to All Major Platforms
            </p>
            <PlatformLogos />
          </div>
        </section>
        <FeaturesGrid />
        <PricingSection />
        <CTASection signupHref={signupUrl} />
      </main>
      <Footer />
    </>
  );
}
