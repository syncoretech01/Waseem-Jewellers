'use client';

import { useRef } from 'react';
import { Eyebrow } from '@/components/ui/primitives';
import { MicGlyph } from '@/components/ui/MicGlyph';
import { requestConcierge } from '@/concierge/bridge';
import { preloadOrbCanvas } from '@/concierge/orb/Orb';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';

/**
 * CH10 — the concierge, as a service the shop offers.
 *
 * The hero carries the invitation in one line; a visitor who has scrolled the whole shop is
 * offered it again, with the words it understands: three lines a Lahore customer actually
 * says, each of which sends itself. The ring is the same ring as the hero's; the voice
 * behind it is the same voice.
 */
export function Ch10Invitation() {
  const { ref } = useChapter({ id: 'invitation', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);

  return (
    <section ref={ref} id="ch10-invitation" data-theme="ivory" className="relative bg-ivory px-gutter py-[10svh] text-ink md:py-[13svh]" aria-labelledby="invitation-title">
      <div ref={scope} className="grid grid-cols-1 gap-x-[4vw] gap-y-[6svh] md:grid-cols-12 md:items-center">
        <div className="flex flex-col gap-5 md:col-span-6">
          <Eyebrow className="text-ink/60">{COPY.invitation.eyebrow}</Eyebrow>
          <h2 id="invitation-title" data-split className="display max-w-[10em] text-[clamp(2rem,3.8vw,4rem)] leading-[1.04] text-ink opacity-0">
            {COPY.invitation.title}
          </h2>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ink/70" data-rise>
            {COPY.invitation.line}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-4" data-rise>
            <button
              type="button"
              onClick={() => requestConcierge({ mode: 'voice', autoListen: true })}
              onPointerEnter={preloadOrbCanvas}
              className="group/ring inline-flex items-center gap-4 text-ink"
              data-cursor="listen"
            >
              <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
                  <circle cx="20" cy="20" r="19.25" fill="none" stroke="rgba(110,85,39,0.35)" strokeWidth="1" />
                  <circle cx="20" cy="20" r="19.25" fill="none" stroke="#a8894f" strokeWidth="1" strokeLinecap="round" pathLength="100" strokeDasharray="14 86" className="wj-ring-light" />
                </svg>
                <MicGlyph />
              </span>
              <span className="micro">{COPY.invitation.speak}</span>
            </button>
            <button type="button" onClick={() => requestConcierge({ mode: 'chat' })} className="micro text-ink/60 underline-offset-4 transition-colors hover:text-ink hover:underline" data-cursor="ask">
              {COPY.invitation.write}
            </button>
          </div>
        </div>

        {/* what it understands — each line sends itself */}
        <ul className="flex flex-col divide-y divide-ink/10 border-y border-ink/10 md:col-span-5 md:col-start-8" aria-label="Things you can ask">
          {COPY.invitation.examples.map((line) => (
            <li key={line} data-rise>
              <button
                type="button"
                onClick={() => requestConcierge({ mode: 'chat', submit: line })}
                className="group/ex flex w-full items-baseline justify-between gap-6 py-5 text-left"
                data-cursor="ask"
              >
                <span dir="auto" className="font-display italic text-[clamp(1.125rem,1.5vw,1.375rem)] leading-snug text-ink/80 transition-colors group-hover/ex:text-ink" style={{ fontVariationSettings: '"opsz" 20' }}>
                  {line}
                </span>
                <span aria-hidden className="font-display text-[1rem] text-ink/40 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/ex:translate-x-1">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
