"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  title?: string;
  subtitle?: string;
  cta?: string;
  signupHref?: string;
  /** Kept for older page call sites; unused in the viewfinder layout. */
  badge?: string;
}

const FRAMES = [
  { ratio: "16 / 9", tag: "16:9", platform: "YouTube" },
  { ratio: "9 / 16", tag: "9:16", platform: "TikTok" },
  { ratio: "1 / 1", tag: "1:1", platform: "Feed" },
  { ratio: "4 / 5", tag: "4:5", platform: "Reels" },
];

function useTimecode() {
  const [tc, setTc] = useState("00:00:00:00");
  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      frame = (frame + 3) % (30 * 60);
      const totalSeconds = Math.floor(frame / 30);
      const ff = frame % 30;
      const ss = totalSeconds % 60;
      const mm = Math.floor(totalSeconds / 60);
      const pad = (n: number) => String(n).padStart(2, "0");
      setTc(`00:${pad(mm)}:${pad(ss)}:${pad(ff)}`);
    }, 100);
    return () => clearInterval(id);
  }, []);
  return tc;
}

export function Hero({
  title = "One Clip. Every Frame Your Platforms Actually Want.",
  subtitle = "Shoot it once. ReSocial reframes, captions, and distributes it to TikTok, YouTube, Instagram, and Facebook — correctly cropped for each one, automatically.",
  cta = "Start Rolling — Free for 14 Days",
  signupHref = "/signup",
}: HeroProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const timecode = useTimecode();

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIndex((i) => (i + 1) % FRAMES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const active = FRAMES[frameIndex];

  return (
    <section className="relative overflow-hidden pt-28 pb-24 md:pt-36 md:pb-32">
      <div className="relative mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="hud-label flex items-center gap-2 text-xs text-ink/70 mb-6">
            <span className="tally-dot" />
            REC · Multi-Format Export
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-ink leading-[1.05] mb-6 max-w-xl">
            {title}
          </h1>

          <p className="text-lg text-ink/65 max-w-md mb-10 leading-relaxed">
            {subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button
              size="lg"
              href={signupHref}
              className="!bg-tally hover:!bg-tally/90 !text-paper !rounded-sm !shadow-none"
            >
              {cta}
              <ArrowRight size={18} className="ml-2" />
            </Button>
            <p className="hud-label text-xs text-ink/50">No Card · Cancel Anytime</p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="viewfinder p-5">
            <span className="vf-tl" />
            <span className="vf-tr" />
            <span className="vf-bl" />
            <span className="vf-br" />

            <div
              className="mx-auto bg-charcoal rounded-sm transition-[aspect-ratio] duration-700 ease-in-out overflow-hidden relative"
              style={{ aspectRatio: active.ratio, maxHeight: 380 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-ink to-charcoal opacity-90" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-paper/20 text-6xl font-bold">
                  {active.tag}
                </span>
              </div>
              <div className="absolute top-3 left-3 hud-label text-[10px] text-paper/70 flex items-center gap-1.5">
                <span className="tally-dot" style={{ width: 6, height: 6 }} />
                {active.platform}
              </div>
              <div className="absolute bottom-3 right-3 hud-label text-[10px] text-paper/50">
                {timecode}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-5">
            {FRAMES.map((f, i) => (
              <button
                key={f.tag}
                type="button"
                onClick={() => setFrameIndex(i)}
                className={`hud-label text-[10px] px-2.5 py-1 rounded-sm border transition-colors ${
                  i === frameIndex
                    ? "border-tally text-tally"
                    : "border-ink/15 text-ink/40"
                }`}
              >
                {f.tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
