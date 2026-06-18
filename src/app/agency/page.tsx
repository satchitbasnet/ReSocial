import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/marketing/hero";
import { PlatformLogos } from "@/components/marketing/platform-logos";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { PricingSection } from "@/components/marketing/pricing-section";
import { CTASection } from "@/components/marketing/cta-section";
import { Users, Building2, Briefcase } from "lucide-react";

const useCases = [
  {
    icon: Building2,
    title: "Social Media Agencies",
    description:
      "Handle multiple clients with ease. Manage content, automate posting, and track performance across 25+ accounts per platform.",
  },
  {
    icon: Users,
    title: "Influencer Agencies",
    description:
      "Streamline content distribution and boost creator reach. Automate publishing and maintain brand consistency across influencers.",
  },
  {
    icon: Briefcase,
    title: "Social Media Managers",
    description:
      "Stay organized, save time, and scale your workflow. Perfect for juggling multiple accounts, campaigns, and platforms.",
  },
];

export default function AgencyPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero
          badge="For Agencies"
          title="Automate repurposing for every brand you manage"
          subtitle="Post content on one platform and let ReSocial automatically tailor and distribute it across all social media channels."
        />

        <section className="py-20 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Use Cases
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {useCases.map((uc) => (
                <div
                  key={uc.title}
                  className="bg-white rounded-2xl p-8 border border-gray-100"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 mb-5">
                    <uc.icon size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {uc.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {uc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 border-y border-gray-100">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <PlatformLogos />
          </div>
        </section>

        <FeaturesGrid />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
