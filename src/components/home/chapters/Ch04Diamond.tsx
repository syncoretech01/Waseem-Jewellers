'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { PieceLink } from '@/components/commerce/PieceLink';
import { pieceRefOf } from '@/data/clientIndex';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { PieceRow, ShowcaseDepartment } from '@/lib/facets';
import { KindsList, PieceCluster } from './showcase';
import { tagOf } from './Ch02Window';

/**
 * CH04 — Diamond.
 *
 * The same shop, the other tray: on ink, so the pearl plates read as cards laid on velvet.
 * The pieces lead and the words follow; the kinds are counted and the department is the
 * door. One campaign piece stands at the end as the suite the studio shot — a listed piece
 * with its published grading, not a mood.
 */
export function Ch04Diamond({ department, suite }: { department?: ShowcaseDepartment; suite?: PieceRow }) {
  const { ref } = useChapter({ id: 'diamond', theme: 'dark' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  if (!department) return null;

  return (
    <section ref={ref} id="ch04-diamond" className="relative bg-ink px-gutter py-[9svh] text-ivory md:py-[12svh]" aria-labelledby="diamond-title">
      <div ref={scope}>
        <div className="grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:grid-cols-12 md:items-start">
          {/* the pieces first, on this side */}
          <div className="md:col-span-8 md:order-1">
            <PieceCluster rows={department.rows} tone="ivory" reverse />
          </div>

          {/* the words, the kinds, the door */}
          <div className="flex flex-col gap-7 md:col-span-4 md:order-2 md:sticky md:top-[calc(var(--nav-h)+4svh)] md:gap-9 md:pl-[2vw]">
            <div className="flex flex-col gap-4">
              <Eyebrow className="text-champagne">{COPY.departments.diamond.eyebrow}</Eyebrow>
              <h2 id="diamond-title" data-split className="display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] text-ivory opacity-0">
                {COPY.departments.diamond.title(department.count)}
              </h2>
              <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ivory/70" data-rise>
                {COPY.departments.diamond.line}
              </p>
            </div>
            <KindsList department={department} tone="ivory" heading={COPY.departments.kinds} />
            <div data-rise>
              <Button variant="bracket" href="/diamond" cursor="explore">
                {COPY.departments.diamond.cta}
              </Button>
            </div>
          </div>
        </div>

        {/* the suite the studio shot, with what Waseem publishes about it */}
        {suite && (
          <div className="mt-[10svh] grid grid-cols-1 gap-x-[4vw] gap-y-[5svh] border-t border-ivory/10 pt-[8svh] md:mt-[11svh] md:grid-cols-12 md:items-end md:pt-[9svh]">
            <div className="md:col-span-5 md:col-start-2" data-rise>
              <PieceLink product={pieceRefOf(suite)} sizes="(min-width: 768px) 36vw, 92vw" aspect="4 / 5" cursor="view">
                <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <div className="flex flex-col gap-1">
                    <p className="font-display text-[1.375rem] leading-tight text-ivory" style={{ fontVariationSettings: '"opsz" 22' }}>
                      {suite.t}
                    </p>
                    <p className="micro text-ivory/55">{tagOf(suite)}</p>
                  </div>
                  <span className="micro shrink-0 text-ivory/70 underline-offset-4 transition-colors group-hover/piece:text-ivory group-hover/piece:underline">{COPY.window.view}</span>
                </div>
              </PieceLink>
            </div>
            <div className="flex flex-col gap-4 md:col-span-4 md:col-start-8 md:pb-[10svh]" data-rise>
              <p className="micro text-champagne">{COPY.departments.diamond.suite.eyebrow}</p>
              <p className="display text-[clamp(1.75rem,3vw,3.25rem)] leading-tight text-ivory">{COPY.departments.diamond.suite.title}</p>
              <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ivory/70">{COPY.departments.diamond.suite.line}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
