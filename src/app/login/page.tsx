"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-md border border-ink/15 bg-paper text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/30";

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-ink text-paper items-center justify-center p-12 relative overflow-hidden">
        <span className="pointer-events-none absolute top-6 left-6 hud-label text-[10px] text-paper/40 flex items-center gap-1.5">
          <span className="tally-dot" style={{ width: 6, height: 6 }} />
          Session
        </span>
        <div className="max-w-md relative">
          <Logo size="lg" variant="dark" href={null} className="mb-8" />
          <p className="hud-label text-xs text-tally mb-3">Welcome Back</p>
          <h2 className="font-display text-3xl font-semibold mb-4 leading-tight">
            Pick up where you left off
          </h2>
          <p className="text-paper/65 text-lg leading-relaxed">
            Post once, reach everywhere. Manage distribution from one dashboard —
            TikTok, YouTube, Instagram, Facebook, and X.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md border border-ink/10 bg-paper rounded-md p-8">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          <Logo className="hidden lg:flex mb-8" />

          <h1 className="font-display text-2xl font-semibold text-ink mb-2">
            Log In
          </h1>
          <p className="text-ink/60 mb-8">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-tally font-medium hover:underline"
            >
              Start Free Trial
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-tally/10 text-tally text-sm p-3 rounded-md border border-tally/25">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing In..." : "Log In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
