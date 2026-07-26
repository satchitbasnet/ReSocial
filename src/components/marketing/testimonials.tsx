import { TESTIMONIALS } from "@/lib/constants";
import { Quote } from "lucide-react";

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-xl">
          <p className="hud-label text-xs text-tally mb-3">Playback</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink">
            Loved by Creators Worldwide
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} className="frame-card p-8 pt-10">
              <div className="flex items-center justify-between mb-6">
                <span className="hud-label text-[10px] text-ink/40">
                    Take {String(i + 1).padStart(2, "0")}
                </span>
                <Quote size={18} strokeWidth={1.75} className="text-tally" />
              </div>
              <p className="text-ink/70 mb-6 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="font-display font-medium text-ink">{t.name}</p>
                <p className="hud-label text-[10px] text-ink/45 mt-1">{t.role}</p>
                <p className="text-sm text-tally font-medium mt-2">{t.headline}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
