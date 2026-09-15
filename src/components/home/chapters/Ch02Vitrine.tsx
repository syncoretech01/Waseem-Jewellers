'use client';

import { useRef } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { Img } from '@/components/media/Img';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { pieceRefOf, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { CATEGORY_LABEL } from '@/data/labels';
import { COPY } from '@/data/copy';
import type { Category } from '@/data/types';
import type { PieceRow } from '@/lib/facets';
import { cn } from '@/lib/cn';

/**
 * CH02 — the close look, and the answer to the one structural fault of the Stage 1 homepage.
 *
 * A visitor could scroll fourteen screens before meeting a piece they could open. So the
 * first thing after the film is a real piece looked at closely: one photograph, its parts
 * named in place as the square travels through the viewport, and the whole figure a door to
 * the piece. Two more pieces stand beside it, each a door of its own.
 *
 * It costs no pin and no scroll budget — read at the pace of a shop window.
 */
export function Ch02Vitrine({ pieces, total }: { pieces: PieceRow[]; total: number }) {
  const { ref } = useChapter({ id: 'vitrine', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  if (pieces.length === 0) return null;

  // the piece with something to say leads; the figure needs regions, not just a photograph
  const heroIndex = Math.max(
    0,
    pieces.findIndex((r) => (semanticFor(r.s)?.regions.length ?? 0) >= 2),
  );
  const hero = pieces[heroIndex]!;
  const others = pieces.filter((_, i) => i !== heroIndex).slice(0, 2);
  const descriptor = semanticFor(hero.s);
  const heroSizes = '(min-width: 768px) 56vw, 92vw';

  return (
    <section ref={ref} id="ch02-vitrine" data-theme="ivory" className="relative bg-ivory px-gutter py-[12svh] text-ink md:py-[13svh]" aria-labelledby="vitrine-title">
      <div ref={scope} className="grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:grid-cols-12 md:items-start">
        {/* the figure, and the door it is */}
        <div className="md:col-span-7" data-rise>
          <PieceLink
            product={pieceRefOf(hero)}
            sizes={heroSizes}
            aspect="1 / 1"
            cursor="view"
            figure={
              descriptor ? (
                <SemanticFigure
                  descriptor={descriptor}
                  sizes={heroSizes}
                  eager
                  flipSource={hero.s}
                  fallback={
                    <div className="absolute inset-0 bg-pearl">
                      <Img image={pieceRefOf(hero).media.hero} sizes={heroSizes} plain data={{ 'flip-source': hero.s }} />
                    </div>
                  }
                />
              ) : undefined
            }
          >
            <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
              <div className="flex flex-col gap-1">
                <p className="micro text-ink/55">{hero.c ? CATEGORY_LABEL[hero.c as Category] : 'Jewellery'}</p>
                <p className="font-display text-[1.375rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 22' }}>
                  {hero.t}
                </p>
                <p className="micro text-ink/55">{specLineOf(hero) || priceLabelOf(hero)}</p>
              </div>
              <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.closeLook.view}</span>
            </div>
          </PieceLink>
        </div>

        {/* the words, and two more doors */}
        <div className="flex flex-col gap-7 md:col-span-5 md:gap-9 md:pt-[2svh]">
          <div className="flex flex-col gap-4">
            <Eyebrow className="text-ink/60">{COPY.closeLook.eyebrow}</Eyebrow>
            <h2 id="vitrine-title" data-split className="display max-w-[12em] text-[clamp(1.75rem,2.8vw,3rem)] leading-tight text-ink opacity-0">
              {COPY.closeLook.title(total)}
            </h2>
            <p className="max-w-[30em] text-[0.875rem] leading-relaxed text-ink/70" data-rise>
              {COPY.closeLook.line}
            </p>
          </div>

          {others.length > 0 && (
            <div className="flex flex-col gap-5" data-rise>
              <p className="micro text-ink/55">{COPY.closeLook.more}</p>
              <ul className={cn('grid gap-x-[2vw] gap-y-8', others.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {others.map((row) => (
                  <li key={row.s}>
                    <PieceLink product={pieceRefOf(row)} sizes="(min-width: 768px) 18vw, 44vw" aspect="4 / 5" cursor="view">
                      <div className="mt-4 flex flex-col gap-1">
                        <p className="font-display text-[1.0625rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 16' }}>
                          {row.t}
                        </p>
                        <p className="micro text-ink/55">{specLineOf(row) || (row.c ? CATEGORY_LABEL[row.c as Category] : 'Jewellery')}</p>
                      </div>
                    </PieceLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
