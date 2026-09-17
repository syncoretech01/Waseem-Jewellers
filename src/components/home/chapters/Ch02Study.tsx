'use client';

import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useQualityStore } from '@/state/qualityStore';
import { PieceLink } from '@/components/commerce/PieceLink';
import { pieceRefOf } from '@/data/clientIndex';
import { RingStudy } from '@/semantic/moments/RingStudy';
import type { MomentHandle } from '@/semantic/moments/useMoment';
import { studyFor } from '@/data/moments';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';
import { tagOf } from './showcase';

const DESKTOP = '(min-width: 768px)';

/**
 * CH02b — the study: a drawing becomes the ring, and the ring turns.
 *
 * Its own chapter after the craft, pinned on a desktop, so the sequence is read as an event:
 * a pencil drawing traced from the ring's own photograph develops into the photograph, and
 * the ring then turns to the second angle Waseem shot. The words at the left are one node
 * whose content changes with the beat — never two on screen at once. The copy is careful
 * about what is what: the craft object above is a study in emerald; this is a ring Waseem
 * sells, with its own stone and its own published facts.
 */
export function Ch02Study({ piece }: { piece?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'study', theme: 'ivory', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const desktop = useMediaQuery(DESKTOP);
  const figure = useRef<MomentHandle>(null);
  const [beat, setBeat] = useState<'drawn' | 'made' | 'turned' | null>('drawn');
  const study = piece ? studyFor(piece.s) : undefined;

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || !study) return;
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
            end: '+=150%',
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
    { scope: ref, dependencies: [reduced, Boolean(study)] },
  );

  if (!piece || !study) return null;
  const sizes = '(min-width: 768px) 44vw, 92vw';
  const steps = COPY.study.beats;
  const current = steps.find((s) => s.key === beat) ?? steps[0]!;

  const frame = (driven: boolean) => (
    <PieceLink product={pieceRefOf(piece)} sizes={sizes} aspect="1 / 1" cursor="view" className="block w-full" figure={<RingStudy ref={driven ? figure : undefined} study={study} slug={piece.s} sizes={sizes} driven={driven} onBeat={setBeat} captions={driven ? 'none' : 'inside'} />}>
      <div className="mt-4 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-display text-[1.25rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 20' }}>
            {piece.t}
          </p>
          <p className="micro text-ink/55">{tagOf(piece)}</p>
        </div>
        <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.study.view}</span>
      </div>
    </PieceLink>
  );

  return (
    <section ref={ref} id="ch02-study" data-theme="ivory" className="relative bg-ivory text-ink md:h-svh md:overflow-hidden" aria-labelledby="study-title">
      <div className="wj-row relative z-10 flex items-start justify-between px-gutter pt-8 md:absolute md:inset-x-0 md:top-0 md:pt-[calc(var(--nav-h)+1.25rem)]">
        <p className="micro text-ink/60">{COPY.study.eyebrow}</p>
        <p className="micro hidden text-ink/45 md:block">{piece.t}</p>
      </div>

      <div className="hidden h-full wj-row grid-cols-12 items-center gap-x-[var(--gap)] px-gutter pt-[calc(var(--nav-h)+3.5rem)] pb-[6svh] md:grid">
        <div className="col-span-6">
          <div className="mx-auto w-[min(44vw,calc(100svh-16rem))]">{desktop ? frame(true) : null}</div>
        </div>
        <div className="col-span-5 col-start-8 flex flex-col gap-7">
          <h2 id="study-title" className="display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] text-ink [text-wrap:balance]">
            {COPY.study.title}
          </h2>
          <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ink/70">{COPY.study.line}</p>
          <div className="flex min-h-[9.5rem] flex-col gap-3 border-t border-ink/10 pt-6" aria-live="polite">
            <p className="flex items-baseline gap-4">
              <span className="font-display text-[0.8125rem] text-gold-deep" style={{ fontVariationSettings: '"opsz" 12' }}>
                {String(steps.indexOf(current) + 1).padStart(2, '0')}
              </span>
              <span key={current.key} className="stage-word display text-[clamp(1.75rem,3vw,3rem)] leading-none text-ink">
                {current.label}
              </span>
            </p>
            <p key={current.key + '-note'} className="stage-note max-w-[26em] font-display italic text-[1rem] leading-snug text-ink/70" style={{ fontVariationSettings: '"opsz" 14' }}>
              {current.note}
            </p>
          </div>
        </div>
      </div>

      <div className="wj-row flex flex-col gap-8 px-gutter pb-16 pt-8 md:hidden">
        <div className="flex flex-col gap-4">
          <h2 className="display text-[2.25rem] leading-[1.04] text-ink">{COPY.study.title}</h2>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ink/70">{COPY.study.line}</p>
        </div>
        {!desktop && frame(false)}
      </div>
    </section>
  );
}
