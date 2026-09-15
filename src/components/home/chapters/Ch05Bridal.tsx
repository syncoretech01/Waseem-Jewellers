'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Video } from '@/components/media/Video';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { pieceRefOf, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';

/** The portrait window and the closing frame share these proportions with the wall's first tile. */
export const BRIDAL_FRAME = { widthVw: 28, ratio: 1.25 };

function portraitInset(vw: number, vh: number, widthVw: number) {
  const w = (vw * widthVw) / 100;
  const h = w * BRIDAL_FRAME.ratio;
  const x = (vw - w) / 2;
  const y = (vh - h) / 2;
  return `inset(${Math.max(0, y)}px ${x}px ${Math.max(0, y)}px ${x}px)`;
}

/**
 * CH05 — bridal cinema, and then the suite.
 *
 * A portrait window on the Naqsh-e-Gul film opens into full cinema, the room darkens around
 * the words, and at the close the frame contracts to a portrait as ivory rises. The film's
 * credit names the listed piece from its collection, so the cinema has a door.
 *
 * Then, on the ivory the film left behind, a bridal suite is looked at as a jeweller would:
 * tikka, earrings, choker and haar named where they sit in one photograph — and the figure
 * is the door to the suite. It is its own registered section, so the chrome follows the paper.
 */
export function Ch05Bridal({ suite, credit }: { suite?: PieceRow; credit?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'bridal', theme: 'dark', pinned: true });
  const { ref: closeRef } = useChapter({ id: 'bridal-close', theme: 'ivory' });
  const closeScope = useRef<HTMLDivElement>(null);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const descriptor = suite ? semanticFor(suite.s) : undefined;
  useRise(closeScope);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const stage = root.querySelector<HTMLElement>('.bridal-stage');
        const film = root.querySelector<HTMLElement>('.bridal-film');
        const frame = root.querySelector<HTMLElement>('.bridal-frame');
        const ambient = root.querySelector<HTMLElement>('.bridal-ambient');
        const paper = root.querySelector<HTMLElement>('.bridal-paper');
        const words = root.querySelectorAll<HTMLElement>('.bridal-word');
        const tail = root.querySelectorAll<HTMLElement>('.bridal-tail');
        const opening = root.querySelector<HTMLElement>('.bridal-opening');
        if (!stage || !film || !frame || !ambient || !paper) return;

        if (still) {
          // composed still: the film full-bleed behind the words; no pre-roll caption, no frame
          gsap.set(film, { clipPath: 'inset(0px)' });
          gsap.set([words, tail], { autoAlpha: 1 });
          gsap.set([opening, frame], { autoAlpha: 0 });
          gsap.set(ambient, { opacity: 0.45 });
          ready();
          return;
        }
        if (mobile) {
          gsap.set(film, { clipPath: 'inset(0px)' });
          gsap.fromTo(words, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12, ease: 'wj.out', scrollTrigger: { trigger: stage, start: 'top 40%', once: true } });
          gsap.fromTo(tail, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'wj.out', scrollTrigger: { trigger: stage, start: 'top 30%', once: true } });
          gsap.set(opening, { autoAlpha: 1 });
          ready();
          return;
        }

        const openInset = () => portraitInset(window.innerWidth, window.innerHeight, 34);
        const closeInset = () => portraitInset(window.innerWidth, window.innerHeight, BRIDAL_FRAME.widthVw);
        const tl = gsap.timeline({
          scrollTrigger: {
            // the stage pins, not the section: the suite beneath it scrolls in when the pin releases
            trigger: stage,
            start: 'top top',
            end: '+=155%',
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        tl.fromTo(film, { clipPath: openInset }, { clipPath: 'inset(0px 0px 0px 0px)', ease: 'power1.inOut', duration: 0.35 }, 0)
          .fromTo(frame, { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.2 }, 0.35)
          .fromTo(opening, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', duration: 0.15 }, 0.2)
          .fromTo(ambient, { opacity: 0 }, { opacity: 0.6, ease: 'none', duration: 0.25 }, 0.55)
          .fromTo(words, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.16, stagger: 0.04 }, 0.62)
          .fromTo(tail, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.1, stagger: 0.03 }, 0.74)
          // the close: words fade, the frame contracts to the portrait, ivory rises, film → still
          .to([words, tail], { autoAlpha: 0, y: -12, ease: 'none', duration: 0.08 }, 0.83)
          .to(ambient, { opacity: 0, ease: 'none', duration: 0.1 }, 0.83)
          .to(film, { clipPath: closeInset, ease: 'power1.inOut', duration: 0.17 }, 0.83)
          .fromTo(paper, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', ease: 'none', duration: 0.15 }, 0.85);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  const suiteSizes = '(min-width: 768px) 56vw, 92vw';

  return (
    <>
      <section ref={ref} id="ch05" className="relative bg-ink text-ivory" aria-labelledby="bridal-title">
        <div className="bridal-stage relative h-[160svh] overflow-hidden md:h-svh">
          <div className="bridal-paper pointer-events-none absolute inset-0 bg-ivory" style={{ clipPath: 'inset(100% 0 0 0)' }} />
          <div className="bridal-film absolute inset-0 overflow-hidden" style={{ clipPath: 'inset(0px)' }}>
            <Video id="bridal-cinema" ariaLabel="Naqsh-e-Gul — the bridal film" />
            <div className="grain pointer-events-none absolute inset-0" />
            <div className="bridal-frame pointer-events-none absolute inset-0 hidden md:block">
              <div className="absolute left-1/2 top-1/2 h-[calc(34vw*1.25-48px)] w-[calc(34vw-48px)] -translate-x-1/2 -translate-y-1/2 border border-gold-hi/70" />
            </div>
          </div>
          <div className="bridal-ambient pointer-events-none absolute inset-0 bg-ink opacity-0" />

          {/* opening caption beneath the portrait window */}
          <div className="bridal-opening pointer-events-none absolute inset-x-0 bottom-[8svh] hidden flex-col items-center gap-3 md:flex">
            <p className="micro text-champagne">{COPY.bridal.eyebrow}</p>
            <p className="font-display italic text-[1.125rem] text-ivory/80" style={{ fontVariationSettings: '"opsz" 18' }}>
              {COPY.bridal.opening}
            </p>
          </div>

          {/* the words */}
          <div className="absolute inset-0 flex flex-col justify-end px-gutter pb-[10svh] md:justify-center md:pb-0">
            <h2 id="bridal-title" className="display text-[clamp(3rem,8.5vw,9.5rem)] leading-[0.95] text-ivory">
              {COPY.bridal.closing.map((line, i) => (
                <span key={line} className={i === 2 ? 'bridal-word block italic text-champagne' : 'bridal-word block'}>
                  {line}
                </span>
              ))}
            </h2>
            {/* the film's credit: the collection, and the listed piece from it */}
            <p className="bridal-tail mt-8 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="micro text-champagne">{COPY.bridal.credit}</span>
              {credit && (
                <TransitionLink href={`/jewellery/${credit.s}`} className="group/credit font-display italic text-[1.0625rem] text-ivory/85 transition-colors hover:text-ivory" data-cursor="view">
                  {credit.t}
                  <span className="micro ml-3 not-italic text-ivory/55 transition-colors group-hover/credit:text-ivory">{COPY.hero.view}</span>
                </TransitionLink>
              )}
            </p>
            <div className="bridal-tail mt-6 flex flex-wrap items-center gap-x-10 gap-y-4">
              <Button variant="bracket" href="/collections/bridal" cursor="explore">
                {COPY.bridal.ctaDiscover}
              </Button>
              <Button variant="hairline" onClick={() => openConsultation({ topic: 'bridal', source: 'cta' })}>
                {COPY.bridal.ctaConsult}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* the suite, on the ivory the film left behind */}
      {suite && descriptor && (
        <section ref={closeRef} id="ch05-suite" data-theme="ivory" className="relative bg-ivory px-gutter py-[12svh] text-ink md:py-[13svh]" aria-label={COPY.bridal.close.title}>
          <div ref={closeScope} className="grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:grid-cols-12 md:items-start">
            <div className="md:col-span-7" data-rise>
              <PieceLink
                product={pieceRefOf(suite)}
                sizes={suiteSizes}
                aspect="1 / 1"
                cursor="view"
                figure={
                  <SemanticFigure
                    descriptor={descriptor}
                    sizes={suiteSizes}
                    flipSource={suite.s}
                    fallback={
                      <div className="absolute inset-0 bg-pearl">
                        <Img image={pieceRefOf(suite).media.hero} sizes={suiteSizes} plain data={{ 'flip-source': suite.s }} />
                      </div>
                    }
                  />
                }
              >
                <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <div className="flex flex-col gap-1">
                    <p className="font-display text-[1.375rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 22' }}>
                      {suite.t}
                    </p>
                    <p className="micro text-ink/55">{specLineOf(suite) || priceLabelOf(suite)}</p>
                  </div>
                  <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.bridal.close.view}</span>
                </div>
              </PieceLink>
            </div>
            <div className="flex flex-col gap-5 md:col-span-5 md:pt-[2svh]" data-rise>
              <p className="micro text-ink/60">{COPY.bridal.close.eyebrow}</p>
              <p className="display max-w-[10em] text-[clamp(1.75rem,2.8vw,3rem)] leading-tight text-ink">{COPY.bridal.close.title}</p>
              <p className="max-w-[30em] text-[0.875rem] leading-relaxed text-ink/70">{COPY.bridal.close.line}</p>
              <ol className="mt-2 flex flex-col gap-2 border-t border-ink/10 pt-5">
                {descriptor.regions.map((r, i) => (
                  <li key={r.key} className="flex items-baseline gap-4">
                    <span className="font-display text-[0.75rem] text-ink/50" style={{ fontVariationSettings: '"opsz" 12' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="micro text-ink/80">{r.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
