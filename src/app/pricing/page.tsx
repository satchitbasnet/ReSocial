import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FAQSection } from "@/components/marketing/faq-section";
import { Testimonials } from "@/components/marketing/testimonials";
import { CTASection } from "@/components/marketing/cta-section";

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <div className="text-center py-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple pricing to grow your social platforms
          </h1>
          <p className="text-gray-600 text-lg">
            Publish 10 videos for FREE — No credit card required
          </p>
        </div>
        <PricingSection />
        <Testimonials />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
