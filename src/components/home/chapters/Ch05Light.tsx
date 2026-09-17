'use client';

import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useQualityStore } from '@/state/qualityStore';
import { PieceLink } from '@/components/commerce/PieceLink';
import { pieceRefOf } from '@/data/clientIndex';
import { SuiteLight } from '@/semantic/moments/SuiteLight';
import type { MomentHandle } from '@/semantic/moments/useMoment';
import { lightsFor } from '@/data/moments';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';
import { tagOf } from './showcase';

const DESKTOP = '(min-width: 768px)';

/**
 * CH05 — one suite, in one light.
 *
 * A chapter of its own, pinned, so the light is read as an event and not as a treatment on a
 * card: the room goes dark, one light finds the chandelier earring, travels to the necklace,
 * settles on the pendant, and the whole suite is lit again as the studio shot it. The words
 * at the left say what the light has found — one line at a time, in one node, so no two can
 * ever be on screen together — and the suite is the door beneath.
 */
export function Ch05Light({ suite }: { suite?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'light', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const desktop = useMediaQuery(DESKTOP);
  const figure = useRef<MomentHandle>(null);
  const [lit, setLit] = useState<string | null>(null);
  const moment = suite ? lightsFor(suite.s) : undefined;

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || !moment) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: DESKTOP, mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        if (mobile || reduce || reduced) {
          ready();
          return;
        }
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: '+=160%',
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (st) => figure.current?.apply(st.progress),
          },
        });
        tl.set({}, {}, 1);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced, Boolean(moment)] },
  );

  if (!suite || !moment) return null;
  const sizes = '(min-width: 768px) 46vw, 92vw';
  const steps = [{ key: null, label: COPY.light.opening, note: COPY.light.openingNote }, ...moment.lights.map((l) => ({ key: l.key as string | null, label: l.label, note: l.note })), { key: 'closing', label: COPY.light.closing, note: moment.closing }];
  const current = steps.find((s) => s.key === lit) ?? steps[0]!;

  const frame = (driven: boolean) => (
    <PieceLink product={pieceRefOf(suite)} sizes={sizes} aspect="1 / 1" cursor="view" className="block w-full" figure={<SuiteLight ref={driven ? figure : undefined} moment={moment} slug={suite.s} sizes={sizes} driven={driven} onLit={setLit} captions={driven ? 'none' : 'inside'} />}>
      <div className="mt-4 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-display text-[1.25rem] leading-tight text-ivory" style={{ fontVariationSettings: '"opsz" 20' }}>
            {suite.t}
          </p>
          <p className="micro text-ivory/55">{tagOf(suite)}</p>
        </div>
        <span className="micro shrink-0 text-ivory/70 underline-offset-4 transition-colors group-hover/piece:text-ivory group-hover/piece:underline">{COPY.light.view}</span>
      </div>
    </PieceLink>
  );

  return (
    <section ref={ref} id="ch05-light" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-labelledby="light-title">
      <div className="wj-row relative z-10 flex items-start justify-between px-gutter pt-8 md:absolute md:inset-x-0 md:top-0 md:pt-[calc(var(--nav-h)+1.25rem)]">
        <p className="micro text-champagne">{COPY.light.eyebrow}</p>
        <p className="micro hidden text-ivory/50 md:block">{suite.t}</p>
      </div>

      {/* desktop: the words at the left, the suite at the right, one pin */}
      <div className="hidden h-full wj-row grid-cols-12 items-center gap-x-[var(--gap)] px-gutter pt-[calc(var(--nav-h)+3.5rem)] pb-[6svh] md:grid">
        <div className="col-span-5 flex flex-col gap-7">
          <h2 id="light-title" className="display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] text-ivory [text-wrap:balance]">
            {COPY.light.title}
          </h2>
          <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ivory/70">{COPY.light.line}</p>
          {/* one node: what the light has found, and one line about it */}
          <div className="flex min-h-[9.5rem] flex-col gap-3 border-t border-ivory/10 pt-6" aria-live="polite">
            <p className="flex items-baseline gap-4">
              <span className="font-display text-[0.8125rem] text-champagne" style={{ fontVariationSettings: '"opsz" 12' }}>
                {String(Math.max(0, steps.indexOf(current)) + 1).padStart(2, '0')}
              </span>
              <span key={current.label} className="display text-[clamp(1.75rem,3vw,3rem)] leading-none text-ivory light-word">
                {current.label}
              </span>
            </p>
            <p key={current.note} className="max-w-[26em] font-display italic text-[1rem] leading-snug text-ivory/70 light-note" style={{ fontVariationSettings: '"opsz" 14' }}>
              {current.note}
            </p>
          </div>
        </div>
        <div className="col-span-6 col-start-7">
          <div className="mx-auto w-[min(46vw,calc(100svh-16rem))]">{desktop ? frame(true) : null}</div>
        </div>
      </div>

      {/* a phone: stacked, the frame reads as it travels, with its captions inside */}
      <div className="wj-row flex flex-col gap-8 px-gutter pb-16 pt-8 md:hidden">
        <div className="flex flex-col gap-4">
          <h2 className="display text-[2.25rem] leading-[1.04] text-ivory">{COPY.light.title}</h2>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ivory/70">{COPY.light.line}</p>
        </div>
        {!desktop && frame(false)}
      </div>
    </section>
  );
}
