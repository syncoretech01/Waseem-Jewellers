'use client';

import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Button } from '@/components/ui/Button';
import { PieceLink } from '@/components/commerce/PieceLink';
import { PartedPiece, partedBeatAt } from '@/semantic/moments/PartedPiece';
import type { MomentHandle } from '@/semantic/moments/useMoment';
import { pieceRefOf } from '@/data/clientIndex';
import { tagOf } from './showcase';
import { partedFor } from '@/data/moments';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';

const DESKTOP = '(min-width: 768px)';

/**
 * CH09 — bespoke: made for one person.
 *
 * The chapter argues for bespoke with one pair of earrings Waseem made, read as a jeweller
 * reads it: the photograph is cut at the joints — crown, bell, tassel — drawn apart so each
 * part sits on its own, held while the parts are read, and closed again into the pair. The
 * words at the left are ONE node whose content changes with the beat, so no two stage words
 * can ever share the screen (the previous version kept five absolutely-positioned words and
 * crossfaded them, which on a 768px-high laptop and on a fast reversal let two show at once).
 * The frame is sized to what the viewport leaves beneath the eyebrow, so nothing collides.
 *
 * On desktop the chapter pins and drives the moment from its own scrub; on a phone the moment
 * reads as it travels through the viewport, its names beside the parts and its closing line
 * inside the frame.
 */
export function Ch09Bespoke({ pair }: { pair?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'bespoke', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const desktop = useMediaQuery(DESKTOP);
  const figure = useRef<MomentHandle>(null);
  const [beat, setBeat] = useState<{ kind: 'whole' | 'part' | 'closing'; index: number }>({ kind: 'whole', index: -1 });
  const parted = pair ? partedFor(pair.s) : undefined;
  const bands = parted?.bands ?? [];

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || !parted) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: DESKTOP, mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        if (mobile || reduce || reduced) {
          ready();
          return;
        }
        const n = bands.length;
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (st) => {
              figure.current?.apply(st.progress);
              // the stage word follows the same fractions the moment reads its parts at
              const b = partedBeatAt(st.progress, n);
              setBeat((prev) => (prev.kind === b.kind && prev.index === b.index ? prev : b));
            },
          },
        });
        // the timeline spans exactly the pin, so the fractions are scroll fractions
        tl.set({}, {}, 1);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced, bands.length] },
  );

  if (!pair || !parted) return null;
  const sizes = '(min-width: 768px) 44vw, 92vw';
  const door = pieceRefOf(pair);
  const stage =
    beat.kind === 'part'
      ? { label: bands[beat.index]!.label, note: bands[beat.index]!.note, numeral: String(beat.index + 2).padStart(2, '0') }
      : beat.kind === 'closing'
        ? { ...COPY.bespoke.closing, numeral: String(bands.length + 2).padStart(2, '0') }
        : { ...COPY.bespoke.opening, numeral: '01' };
  const stageKey = beat.kind === 'part' ? bands[beat.index]!.key : beat.kind;

  const frame = (driven: boolean) => (
    <PieceLink product={door} sizes={sizes} aspect="1 / 1" cursor="view" className="block w-full" figure={<PartedPiece ref={driven ? figure : undefined} moment={parted} slug={pair.s} sizes={sizes} driven={driven} captions={driven ? 'none' : 'inside'} />}>
      <div className="mt-4 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-display text-[1.25rem] leading-tight text-ivory" style={{ fontVariationSettings: '"opsz" 20' }}>
            {pair.t}
          </p>
          <p className="micro text-ivory/55">{tagOf(pair)}</p>
        </div>
        <span className="micro shrink-0 text-ivory/70 underline-offset-4 transition-colors group-hover/piece:text-ivory group-hover/piece:underline">{COPY.bespoke.view}</span>
      </div>
    </PieceLink>
  );

  const tenets = (
    <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="What bespoke means">
      {COPY.bespoke.tenets.map((t) => (
        <li key={t} className="micro text-ivory/55">
          {t}
        </li>
      ))}
    </ul>
  );

  return (
    <section ref={ref} id="ch09" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-label={COPY.bespoke.title}>
      {/* the eyebrow sits beneath the nav band; the stage starts beneath the eyebrow band, never under it */}
      <div className="wj-row relative z-10 flex items-start justify-between px-gutter pt-8 md:absolute md:inset-x-0 md:top-0 md:pt-[calc(var(--nav-h)+1.25rem)]">
        <p className="micro text-champagne">{COPY.bespoke.eyebrow}</p>
        <p className="micro hidden text-ivory/50 md:block">{pair.t}</p>
      </div>

      {/* desktop: the words at the left, the pair at the right, one pin */}
      <div className="bespoke-stage hidden h-full wj-row grid-cols-12 items-center gap-x-[var(--gap)] px-gutter pt-[calc(var(--nav-h)+3.5rem)] pb-[6svh] md:grid">
        <div className="col-span-5 flex flex-col gap-6">
          <h2 className="display max-w-[9em] text-[clamp(2rem,3.4vw,3.5rem)] leading-[1.04] text-ivory [text-wrap:balance]">{COPY.bespoke.title}</h2>
          <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ivory/70">{COPY.bespoke.line}</p>
          {tenets}
          {/* one node: the stage word and its line — a change replaces them, never overlaps them */}
          <div className="bespoke-words flex min-h-[8.5rem] flex-col gap-3 border-t border-ivory/10 pt-6" aria-live="polite">
            <p className="flex items-baseline gap-4">
              <span className="font-display text-[0.8125rem] text-champagne" style={{ fontVariationSettings: '"opsz" 12' }}>
                {stage.numeral}
              </span>
              <span key={stageKey} className="bespoke-word stage-word display text-[clamp(1.75rem,3vw,3rem)] leading-none text-ivory">
                {stage.label}
              </span>
            </p>
            <p key={stageKey + '-note'} className="stage-note max-w-[26em] font-display italic text-[1rem] leading-snug text-ivory/70" style={{ fontVariationSettings: '"opsz" 14' }}>
              {stage.note}
            </p>
          </div>
          <div className="bespoke-cta">
            <Button variant="bracket" onClick={() => openConsultation({ topic: 'bespoke', source: 'cta' })} cursor="open">
              {COPY.bespoke.cta}
            </Button>
          </div>
        </div>
        <div className="col-span-6 col-start-7">
          <div className="mx-auto w-[min(44vw,calc(100svh-16rem))]">{desktop ? frame(true) : null}</div>
        </div>
      </div>

      {/* mobile: stacked; the moment reads as it travels through the viewport */}
      <div className="bespoke-stack wj-row flex flex-col gap-8 px-gutter pb-20 pt-8 md:hidden">
        <div className="flex flex-col gap-4">
          <h2 className="display text-[2.25rem] leading-[1.04] text-ivory">{COPY.bespoke.title}</h2>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ivory/70">{COPY.bespoke.line}</p>
          {tenets}
        </div>
        {!desktop && frame(false)}
        <div className="pt-2">
          <Button variant="bracket" onClick={() => openConsultation({ topic: 'bespoke', source: 'cta' })}>
            {COPY.bespoke.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
