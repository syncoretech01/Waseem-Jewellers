'use client';

import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useQualityStore } from '@/state/qualityStore';
import { useOpenProduct } from '@/motion/hooks/useFlipNavigate';
import { useProductVisibility } from '@/motion/hooks/useProductVisibility';
import { BangleStudy } from '@/semantic/moments/BangleStudy';
import type { MomentHandle } from '@/semantic/moments/useMoment';
import { bangleFor } from '@/data/moments';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';
import { tagOf } from './showcase';

const DESKTOP = '(min-width: 768px)';

/**
 * CH02b — the bangle: one set, turned in the hand.
 *
 * A chapter of its own after the craft, pinned on a desktop. Two photographs the shop took
 * of one set of bangles — on its side, and raised — and a camera that reads the set the way
 * a hand turns it: the profile, the surface close, the rhythm of the motif along the face,
 * the turn to the raised angle and the inside, and the complete set. The words at the right
 * are one node whose content changes with the hold; the set is the door beneath. It follows
 * the craft object on purpose: that was a study; this is a piece Waseem sells.
 */
export function Ch02Bangle({ piece }: { piece?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'bangle', theme: 'ivory', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const desktop = useMediaQuery(DESKTOP);
  const figure = useRef<MomentHandle>(null);
  const [lit, setLit] = useState<string | null>(null);
  const moment = piece ? bangleFor(piece.s) : undefined;
  const open = useOpenProduct();
  const seen = useProductVisibility<HTMLDivElement>(piece?.s ?? '');

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
            end: '+=170%',
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

  if (!piece || !moment) return null;
  // the camera magnifies the photograph up to 2.4×, so the variant asked for is sized for that, not for the frame
  const sizes = '(min-width: 768px) 110vw, 200vw';
  const steps = moment.holds;
  const current = steps.find((s) => s.key === lit) ?? steps[0]!;
  const index = Math.max(0, steps.findIndex((h) => h.key === current.key));

  const frame = (driven: boolean) => (
    <div className="w-full" ref={seen}>
      <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
        <BangleStudy ref={driven ? figure : undefined} moment={moment} slug={piece.s} sizes={sizes} driven={driven} onLit={setLit} captions={driven ? 'none' : 'inside'} className="absolute inset-0" />
      </div>
      {/* the door beneath: the piece by name, opening its own page — the flight starts from the photograph above */}
      <a
        href={`/jewellery/${piece.s}`}
        className="group/piece mt-4 block"
        data-cursor="view"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          open(piece.s, e.currentTarget.parentElement?.querySelector('img') ?? null);
        }}
      >
        <div className="flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-display text-[1.25rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 20' }}>
              {piece.t}
            </p>
            {tagOf(piece) && <p className="micro text-ink/55">{tagOf(piece)}</p>}
          </div>
          <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.bangle.view}</span>
        </div>
      </a>
    </div>
  );

  return (
    <section ref={ref} id="ch02-bangle" data-theme="ivory" className="relative bg-ivory text-ink md:h-svh md:overflow-hidden" aria-labelledby="bangle-title">
      <div className="wj-row relative z-10 flex items-start justify-between px-gutter pt-8 md:absolute md:inset-x-0 md:top-0 md:pt-[calc(var(--nav-h)+1.25rem)]">
        <p className="micro text-ink/60">{COPY.bangle.eyebrow}</p>
        <p className="micro hidden text-ink/45 md:block">{piece.t}</p>
      </div>

      <div className="hidden h-full wj-row grid-cols-12 items-center gap-x-[var(--gap)] px-gutter pt-[calc(var(--nav-h)+3.5rem)] pb-[6svh] md:grid">
        <div className="col-span-7">
          <div className="mx-auto w-[min(52vw,calc(100svh-15rem))]">{desktop ? frame(true) : null}</div>
        </div>
        <div className="col-span-4 col-start-9 flex flex-col gap-7">
          <h2 id="bangle-title" className="display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] text-ink [text-wrap:balance]">
            {COPY.bangle.title}
          </h2>
          <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ink/70">{COPY.bangle.line}</p>
          <div className="flex min-h-[9.5rem] flex-col gap-3 border-t border-ink/10 pt-6" aria-live="polite">
            <p className="flex items-baseline gap-4">
              <span className="font-display text-[0.8125rem] text-gold-deep" style={{ fontVariationSettings: '"opsz" 12' }}>
                {String(Math.max(0, index) + 1).padStart(2, '0')}
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
          <h2 className="display text-[2.25rem] leading-[1.04] text-ink">{COPY.bangle.title}</h2>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ink/70">{COPY.bangle.line}</p>
        </div>
        {!desktop && frame(false)}
      </div>
    </section>
  );
}
