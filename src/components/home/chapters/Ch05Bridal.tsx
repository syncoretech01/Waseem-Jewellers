'use client';

import { useRef, useState } from 'react';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useSiteStore } from '@/state/siteStore';
import { Video } from '@/components/media/Video';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { pieceRefOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';
import { tagOf } from './showcase';

/** The portrait window's proportions, shared with the collection page's opening frame. */
export const BRIDAL_FRAME = { widthVw: 28, ratio: 1.25 };

/**
 * CH05 — Bridal.
 *
 * The bridal department is the one place a photograph of a bride is the right photograph:
 * a suite is made to be worn together, and only on a person does a tikka, a choker, a haar
 * and a pair of earrings read as one piece. So the chapter opens on the suite itself, looked
 * at as a jeweller would — each of the four named where it sits in one frame — with a second
 * figure beside it on the choker Waseem lists, the film as an inset rather than a screen, and
 * the count, the doors and the appointment beneath. No pin: it is read at the pace of a page.
 */
export function Ch05Bridal({ suite, choker }: { suite?: PieceRow; choker?: PieceRow }) {
  const { ref } = useChapter({ id: 'bridal', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const [lit, setLit] = useState<string | null>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  const suiteDescriptor = suite ? semanticFor(suite.s) : undefined;
  const chokerDescriptor = choker ? semanticFor(choker.s) : undefined;
  const suiteSizes = '(min-width: 768px) 50vw, 92vw';
  const chokerSizes = '(min-width: 768px) 30vw, 92vw';

  return (
    <section ref={ref} id="ch05-bridal" data-theme="ivory" className="relative bg-ivory px-gutter py-[9svh] text-ink md:py-[12svh]" aria-labelledby="bridal-title">
      <div ref={scope}>
        <div className="grid grid-cols-1 gap-x-[4vw] gap-y-6 md:grid-cols-12 md:items-end">
          <div className="flex flex-col gap-4 md:col-span-7">
            <Eyebrow className="text-ink/60">{COPY.bridal.eyebrow}</Eyebrow>
            <h2 id="bridal-title" data-split className="display max-w-[11em] text-[clamp(2.25rem,4.4vw,4.75rem)] leading-[1.02] text-ink opacity-0 [text-wrap:balance]">
              {COPY.bridal.title}
            </h2>
          </div>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ink/70 md:col-span-4 md:col-start-9 md:pb-2" data-rise>
            {COPY.bridal.line}
          </p>
        </div>

        <div className="mt-[8svh] grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:mt-[10svh] md:grid-cols-12 md:items-start">
          {/* the suite, named in place */}
          {suite && suiteDescriptor && (
            <div className="md:col-span-7" data-rise>
              <PieceLink
                product={pieceRefOf(suite)}
                sizes={suiteSizes}
                aspect="1 / 1"
                cursor="view"
                figure={
                  <SemanticFigure
                    descriptor={suiteDescriptor}
                    sizes={suiteSizes}
                    flipSource={suite.s}
                    onLit={setLit}
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
                    <p className="micro text-ink/55">{tagOf(suite)}</p>
                  </div>
                  <span className="micro w-fit shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.bridal.close.view}</span>
                </div>
              </PieceLink>
            </div>
          )}

          <div className="flex flex-col gap-8 md:col-span-4 md:col-start-9 md:gap-10">
            {/* the index of the suite's four, lit in step with the figure */}
            {suiteDescriptor && (
              <div className="hidden flex-col gap-4 md:flex" data-rise>
                <p className="micro text-ink/55">{COPY.bridal.close.eyebrow}</p>
                <ol className="flex flex-col gap-2.5 border-t border-ink/10 pt-5">
                  {suiteDescriptor.regions.map((r, i) => (
                    <li key={r.key} data-lit={lit === r.key ? '1' : '0'} className="flex items-baseline gap-4 opacity-45 transition-opacity duration-500 data-[lit=1]:opacity-100">
                      <span className="font-display text-[0.75rem] text-ink/50" style={{ fontVariationSettings: '"opsz" 12' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="micro text-ink">{r.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* the choker, looked at closely — a second listed piece, a second door */}
            {choker && chokerDescriptor && (
              <div data-rise>
                <PieceLink
                  product={pieceRefOf(choker)}
                  sizes={chokerSizes}
                  aspect="1 / 1"
                  cursor="view"
                  figure={
                    <SemanticFigure
                      descriptor={chokerDescriptor}
                      sizes={chokerSizes}
                      flipSource={choker.s}
                      fallback={
                        <div className="absolute inset-0 bg-pearl">
                          <Img image={pieceRefOf(choker).media.hero} sizes={chokerSizes} plain data={{ 'flip-source': choker.s }} />
                        </div>
                      }
                    />
                  }
                >
                  <div className="mt-4 flex items-baseline justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-display text-[1.0625rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 16' }}>
                        {choker.t}
                      </p>
                      <p className="micro text-ink/55">{tagOf(choker) || COPY.bridal.credit}</p>
                    </div>
                    <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.hero.view}</span>
                  </div>
                </PieceLink>
              </div>
            )}
          </div>
        </div>

        {/* the film, as an inset — and the doors */}
        <div className="mt-[10svh] grid grid-cols-1 gap-x-[4vw] gap-y-[6svh] border-t border-ink/10 pt-[8svh] md:mt-[12svh] md:grid-cols-12 md:items-center md:pt-[9svh]">
          <div className="md:col-span-6" data-rise>
            {/* the film is letterboxed inside its own frame; the inset crops to the picture */}
            <div className="relative overflow-hidden bg-ink" style={{ aspectRatio: '2.35 / 1' }}>
              <Video id="bridal-cinema" ariaLabel="Naqsh-e-Gul — the bridal film" className="absolute inset-0" portrait={false} lightFile />
              <div className="grain pointer-events-none absolute inset-0" />
            </div>
            <p className="micro mt-4 text-ink/55">{COPY.bridal.credit}</p>
          </div>
          <div className="flex flex-col gap-6 md:col-span-5 md:col-start-8" data-rise>
            <p className="display text-[clamp(2rem,4vw,4.25rem)] leading-[0.98] text-ink">
              {COPY.bridal.closing.map((line, i) => (
                <span key={line} className={i === 2 ? 'block italic text-gold-deep' : 'block'}>
                  {line}
                </span>
              ))}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-10 gap-y-4">
              <Button variant="bracket" href="/bridal" cursor="explore">
                {COPY.bridal.ctaDiscover}
              </Button>
              <Button variant="hairline" onClick={() => openConsultation({ topic: 'bridal', source: 'cta' })}>
                {COPY.bridal.ctaConsult}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
