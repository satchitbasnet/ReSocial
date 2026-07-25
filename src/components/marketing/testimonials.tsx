import { TESTIMONIALS } from "@/lib/constants";
import { Quote } from "lucide-react";

export function Testimonials() {
  return (
    <section className="paper-surface py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 text-center">
          <p className="hud-label mb-3 text-tally">Testimonials</p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            Loved by Creators Worldwide
          </h2>
          <div className="mx-auto mt-6 tally-rule max-w-[120px]" />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="frame-card p-8">
              <Quote size={28} className="mb-4 text-tally/40" strokeWidth={1.5} />
              <p className="mb-6 leading-relaxed text-ink italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="font-display font-bold text-ink">{t.name}</p>
                <p className="text-sm text-ink-muted">{t.role}</p>
                <p className="mt-1 font-mono text-[11px] tracking-wider text-tally uppercase">
                  {t.headline}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
