import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection({ signupHref = "/signup" }: { signupHref?: string }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="gradient-bg rounded-3xl p-12 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready for Maximum Exposure?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Publish 10 Videos for FREE When You Start Your 14-Day Trial.
              No Obligation. No Credit Card Required.
            </p>
            <Button
              href={signupHref}
              size="lg"
              className="bg-white text-brand-700 hover:bg-gray-100 shadow-xl"
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
