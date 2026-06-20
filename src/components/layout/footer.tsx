import Link from "next/link";
import { PLATFORMS } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <div className="mb-4">
              <Logo variant="light" />
            </div>
            <p className="text-sm leading-relaxed">
              Post Once, Reach Everywhere. The automated content repurposing
              platform for creators, businesses, and agencies.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/creators" className="hover:text-white transition-colors">Content Creators</Link></li>
              <li><Link href="/business" className="hover:text-white transition-colors">Small Business</Link></li>
              <li><Link href="/agency" className="hover:text-white transition-colors">Agency</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Platforms</h4>
            <ul className="space-y-2 text-sm">
              {PLATFORMS.slice(0, 6).map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="hover:text-white transition-colors">Log In</Link></li>
              <li><Link href="/signup" className="hover:text-white transition-colors">Start Free Trial</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <p>© {new Date().getFullYear()} ReSocial. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
