'use client';

import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SemanticFigure, type SemanticFigureHandle } from '@/semantic/SemanticFigure';
import { beatsFor } from '@/semantic/resolve';
import { pieceRefOf, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';

const DESKTOP = '(min-width: 768px)';

/**
 * CH09 — bespoke: made for one person.
 *
 * The chapter used to argue for bespoke with five cards — a drawn outline, a stone, a
 * photograph masked into the outline — which read as a diagram rather than as jewellery. It
 * now argues with one pair of earrings Waseem made, looked at as a jeweller looks: the two
 * crowns, the two bells, the two drops, and then the pair together. The words at the left
 * are lit in step with the figure's holds, and the consultation is the door beneath them.
 *
 * On desktop the chapter pins and drives the figure from its own scrub; on a phone the figure
 * reads as it travels through the viewport, exactly as it does on a product page.
 */
export function Ch09Bespoke({ pair }: { pair?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'bespoke', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const desktop = useMediaQuery(DESKTOP);
  const figure = useRef<SemanticFigureHandle>(null);
  const [lit, setLit] = useState<string | null>(null);
  const descriptor = pair ? semanticFor(pair.s) : undefined;
  const regions = descriptor?.regions ?? [];
  const words = [COPY.bespoke.opening, ...regions.map((r) => r.label), COPY.bespoke.closing];

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: DESKTOP, mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const stageWords = root.querySelectorAll<HTMLElement>('.bespoke-stage .bespoke-word');
        const wordsWrap = root.querySelector<HTMLElement>('.bespoke-words');
        const cta = root.querySelector<HTMLElement>('.bespoke-stage .bespoke-cta');

        if (mobile || still) {
          // the still form of the figure carries its own captions; the lit words would say them twice
          if (wordsWrap) gsap.set(wordsWrap, { autoAlpha: still ? 0 : 1 });
          gsap.set(cta, { autoAlpha: 1, clearProps: 'transform' });
          ready();
          return;
        }

        const beats = beatsFor(regions);
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: `+=${Math.min(190, 100 + 25 * regions.length)}%`,
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (st) => figure.current?.apply(st.progress),
          },
        });
        // the words follow the figure's beats: one for the opening, one per hold, one for the pull-back
        beats.forEach((b, i) => {
          const w = stageWords[i];
          if (!w) return;
          tl.fromTo(w, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, ease: 'none', duration: Math.min(0.05, (b.until - b.at) * 0.4) }, b.at);
          if (i < beats.length - 1) tl.to(w, { autoAlpha: 0, y: -10, ease: 'none', duration: 0.035 }, b.until - 0.035);
        });
        if (cta) tl.fromTo(cta, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.06 }, 0.86);
        // the timeline spans exactly the pin, so the beats' fractions are scroll fractions
        tl.set({}, {}, 1);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced, regions.length] },
  );

  const sizes = '(min-width: 768px) 44vw, 92vw';
  const door = pair ? pieceRefOf(pair) : null;

  const figureFor = (driven: boolean) =>
    pair && descriptor && door ? (
      <PieceLink product={door} sizes={sizes} aspect="1 / 1" cursor="view" className="block w-full">
        <div className="absolute inset-0">
          <SemanticFigure
            ref={driven ? figure : undefined}
            descriptor={descriptor}
            sizes={sizes}
            driven={driven}
            flipSource={pair.s}
            onLit={driven ? setLit : undefined}
            fallback={
              <div className="absolute inset-0 bg-pearl">
                <Img image={door.media.hero} sizes={sizes} plain data={{ 'flip-source': pair.s }} />
              </div>
            }
          />
        </div>
        <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-display text-[1.25rem] leading-tight text-ivory" style={{ fontVariationSettings: '"opsz" 20' }}>
              {pair.t}
            </p>
            <p className="micro text-ivory/55">{specLineOf(pair) || priceLabelOf(pair)}</p>
          </div>
          <span className="micro shrink-0 text-ivory/70 underline-offset-4 transition-colors group-hover/piece:text-ivory group-hover/piece:underline">{COPY.bespoke.view}</span>
        </div>
      </PieceLink>
    ) : null;

  return (
    <section ref={ref} id="ch09" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-labelledby="bespoke-title">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[40svh] md:block" style={{ background: 'linear-gradient(180deg, transparent 0%, #100d0b 70%, #0B0A09 100%)' }} />

      {/* the eyebrow sits beneath the nav band, never inside it */}
      <div className="relative z-10 flex items-start justify-between px-gutter pt-[calc(var(--nav-h)+1.25rem)] md:absolute md:inset-x-0 md:top-0">
        <p className="micro text-champagne">{COPY.bespoke.eyebrow}</p>
        {pair && <p className="micro hidden text-ivory/50 md:block">{pair.t}</p>}
      </div>

      {/* desktop: the words at the left, the pair at the right, one pin */}
      <div className="bespoke-stage relative hidden h-full grid-cols-12 items-center gap-x-[4vw] px-gutter md:grid">
        <div className="col-span-5 flex flex-col gap-8">
          <h2 id="bespoke-title" className="display max-w-[8em] text-[clamp(2.25rem,4.4vw,4.75rem)] leading-[1.02] text-ivory">
            {COPY.bespoke.title}
          </h2>
          <p className="max-w-[28em] text-[0.875rem] leading-relaxed text-ivory/70">{COPY.bespoke.line}</p>
          <div className="bespoke-words relative h-[5.5rem]">
            {words.map((w, i) => (
              <p key={w} className="bespoke-word absolute left-0 top-0 flex items-baseline gap-5 whitespace-nowrap opacity-0" data-lit={lit === regions[i - 1]?.key ? '1' : '0'}>
                <span className="font-display text-[0.8125rem] text-champagne" style={{ fontVariationSettings: '"opsz" 12' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="display text-[clamp(2rem,4vw,4.25rem)] leading-none text-ivory">{w}</span>
              </p>
            ))}
          </div>
          <div className="bespoke-cta opacity-0">
            <Button variant="bracket" onClick={() => openConsultation({ topic: 'bespoke', source: 'cta' })} cursor="open">
              {COPY.bespoke.cta}
            </Button>
          </div>
        </div>
        <div className="col-span-6 col-start-7">
          <div className="mx-auto w-[min(44vw,66svh)]">{desktop ? figureFor(true) : null}</div>
        </div>
      </div>

      {/* mobile: stacked; the figure reads as it travels through the viewport */}
      <div className="bespoke-stack flex flex-col gap-10 px-gutter pb-20 pt-10 md:hidden">
        <div className="flex flex-col gap-5">
          <p className="display text-[2.4rem] leading-[1.02] text-ivory">{COPY.bespoke.title}</p>
          <p className="max-w-[30em] text-[0.875rem] leading-relaxed text-ivory/70">{COPY.bespoke.line}</p>
        </div>
        {figureFor(false)}
        <div className="pt-2">
          <Button variant="bracket" onClick={() => openConsultation({ topic: 'bespoke', source: 'cta' })}>
            {COPY.bespoke.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
