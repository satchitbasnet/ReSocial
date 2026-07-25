"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroProps {
  badge?: string;
  title: string;
  subtitle: string;
  cta?: string;
  signupHref?: string;
}

const ASPECTS = [
  { id: "9:16", label: "STORY", className: "aspect-[9/16] max-h-[420px]" },
  { id: "1:1", label: "FEED", className: "aspect-square max-h-[360px]" },
  { id: "16:9", label: "WIDE", className: "aspect-video max-h-[320px]" },
] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Timecode({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const f = Math.floor((Date.now() / 40) % 24);
  return (
    <span className="font-mono text-[11px] tracking-wider text-paper/80 tabular-nums">
      {pad(h)}:{pad(m)}:{pad(s)}:{pad(f)}
    </span>
  );
}

export function Hero({
  badge = "Post Once, Reach Everywhere",
  title,
  subtitle,
  cta = "Start Your 14-Day Free Trial",
  signupHref = "/signup",
}: HeroProps) {
  const [aspectIdx, setAspectIdx] = useState(0);
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    const aspectTimer = window.setInterval(() => {
      setAspectIdx((i) => (i + 1) % ASPECTS.length);
    }, 3200);
    const tickTimer = window.setInterval(() => {
      setTicks((t) => t + 1);
    }, 1000);
    return () => {
      window.clearInterval(aspectTimer);
      window.clearInterval(tickTimer);
    };
  }, []);

  const aspect = ASPECTS[aspectIdx];

  return (
    <section className="relative overflow-hidden paper-surface pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 tally-rule" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="max-w-xl">
          <p
            className="hud-label mb-5 animate-fade-up"
            style={{ animationDelay: "40ms" }}
          >
            {badge}
          </p>

          <h1
            className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink md:text-6xl lg:text-[4.25rem] animate-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            <span className="block text-tally">ReSocial</span>
            <span className="mt-2 block text-[0.72em] font-bold text-ink md:mt-3">
              {title}
            </span>
          </h1>

          <p
            className="mt-6 max-w-md text-base leading-relaxed text-ink-muted md:text-lg animate-fade-up"
            style={{ animationDelay: "220ms" }}
          >
            {subtitle}
          </p>

          <div
            className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center animate-fade-up"
            style={{ animationDelay: "320ms" }}
          >
            <Button
              size="lg"
              href={signupHref}
              className="!rounded-none !bg-tally hover:!bg-tally/90 !text-paper shadow-none"
            >
              {cta}
              <ArrowRight size={18} className="ml-2" />
            </Button>
            <p className="hud-label">No credit card · 14-day trial</p>
          </div>
        </div>

        <div
          className="relative mx-auto w-full max-w-md animate-fade-up"
          style={{ animationDelay: "180ms" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="hud-label text-tally">Live · Aspect cycle</span>
            <Timecode seconds={ticks} />
          </div>

          <div className="frame-card overflow-hidden bg-ink p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex gap-1.5">
                {ASPECTS.map((a, i) => (
                  <span
                    key={a.id}
                    className={cn(
                      "font-mono text-[10px] tracking-widest px-2 py-0.5 border transition-colors duration-300",
                      i === aspectIdx
                        ? "border-tally text-tally"
                        : "border-white/15 text-white/40"
                    )}
                  >
                    {a.label}
                  </span>
                ))}
              </div>
              <span className="font-mono text-[10px] text-white/50 tracking-widest">
                {aspect.id}
              </span>
            </div>

            <div className="relative flex min-h-[340px] items-center justify-center bg-[#0a0a0a]">
              <div
                key={aspect.id}
                className={cn(
                  "relative w-full max-w-[280px] overflow-hidden border border-white/20 bg-gradient-to-br from-[#1c1c1c] to-[#0d0d0d] transition-all duration-700 ease-out",
                  aspect.className
                )}
              >
                <div className="absolute inset-0 opacity-40">
                  <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(200,16,46,0.15)_50%)] bg-[length:100%_4px]" />
                </div>
                <div className="absolute inset-4 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <span className="font-mono text-[10px] text-tally tracking-widest">
                      REC ●
                    </span>
                    <span className="font-mono text-[10px] text-white/60 tracking-widest">
                      AUTO-CROP
                    </span>
                  </div>
                  <div>
                    <p className="font-display text-2xl font-bold text-paper leading-none">
                      One upload
                    </p>
                    <p className="mt-2 font-mono text-[10px] tracking-widest text-white/55 uppercase">
                      Fitted for {aspect.label.toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 m-2 border border-tally/30" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
