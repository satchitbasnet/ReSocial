import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/marketing/hero";
import { PlatformLogos } from "@/components/marketing/platform-logos";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { PricingSection } from "@/components/marketing/pricing-section";
import { CTASection } from "@/components/marketing/cta-section";
import { signupHref } from "@/lib/account-types";

export default function BusinessPage() {
  const signupUrl = signupHref("small_business");
  return (
    <>
      <Navbar />
      <main>
        <Hero
          badge="For Small Businesses"
          title="Promote Your Product on All Platforms"
          subtitle="Greater reach, brand visibility, and sales growth through seamless omnipresence and automated content sharing."
          signupHref={signupUrl}
        />
        <section className="py-16 border-y border-gray-100">
          <div className="mx-auto max-w-7xl px-6 text-center">
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
