'use client';

import { useRef } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { pieceRefOf } from '@/components/department/PieceGrid';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { CATEGORY_LABEL } from '@/data/labels';
import type { Category } from '@/data/types';
import type { PieceRow } from '@/lib/facets';
import { cn } from '@/lib/cn';

/**
 * CH02 — the vitrine, and the answer to the one structural fault of the Stage 1 homepage.
 *
 * A visitor could scroll fourteen screens before meeting a piece they could open. Everything
 * before that was true and beautiful and about the jewellery, but none of it *was* the
 * jewellery. So three real pieces stand here, one screen in: named, priced or not, with what
 * Waseem publishes about them, each one a door.
 *
 * It costs no pin and no scroll budget — 130svh, read at the pace of a shop window.
 */
export function Ch02Vitrine({ pieces, total }: { pieces: PieceRow[]; total: number }) {
  const { ref } = useChapter({ id: 'vitrine', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  if (pieces.length === 0) return null;

  return (
    <section ref={ref} id="ch02" data-theme="ivory" className="relative bg-ivory px-gutter py-[12svh] text-ink md:py-[14svh]" aria-labelledby="vitrine-title">
      <div ref={scope} className="flex flex-col gap-[7svh]">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <Eyebrow className="text-ink/60">IN THE VITRINE</Eyebrow>
            <h2 id="vitrine-title" data-split className="display max-w-[14em] text-[clamp(1.75rem,3vw,3.25rem)] leading-tight text-ink opacity-0">
              {total} pieces are in the collection. Begin with three.
            </h2>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-x-[3vw] gap-y-[8svh] md:grid-cols-3">
          {pieces.slice(0, 3).map((row, i) => (
            // the centre piece is given more room, so three pieces are a composition
            <li key={row.s} data-rise className={cn(i === 1 && 'md:-mt-[6svh]')}>
              <PieceLink product={pieceRefOf(row)} sizes="(min-width: 768px) 30vw, 92vw" aspect={i === 1 ? '4 / 5' : '1 / 1'} cursor="view">
                <div className="mt-5 flex flex-col gap-1">
                  <p className="micro text-ink/55">{row.c ? CATEGORY_LABEL[row.c as Category] : 'Jewellery'}</p>
                  <p className="font-display text-[1.25rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 20' }}>
                    {row.t}
                  </p>
                  <p className="micro text-ink/55">
                    {[row.k, row.w !== undefined ? `${row.w.toFixed(3)}` : undefined].filter(Boolean).join(' · ')}
                    {row.w !== undefined && <span className="normal-case"> g</span>}
                  </p>
                </div>
              </PieceLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
