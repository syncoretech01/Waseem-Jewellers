'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { PieceLink } from '@/components/commerce/PieceLink';
import { Img } from '@/components/media/Img';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { pieceRefOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { PieceRow, ShowcaseDepartment } from '@/lib/facets';
import { KindsList, PieceCluster } from './showcase';
import { tagOf } from './Ch02Window';

/**
 * CH03 — Gold.
 *
 * The largest department, shown as a department: the count, the karat, the kinds with their
 * numbers, and the pieces themselves on pearl. Then gold looked at closely — the goldwork
 * figure on a set Waseem publishes, its worked surfaces named where they sit — and the door
 * to the set. Everything here is a door: a piece, a kind, or the department.
 */
export function Ch03Gold({ department, figure }: { department?: ShowcaseDepartment; figure?: PieceRow }) {
  const { ref } = useChapter({ id: 'gold', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<string | null>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  const descriptor = figure ? semanticFor(figure.s) : undefined;
  const figureSizes = '(min-width: 768px) 50vw, 92vw';
  if (!department) return null;

  return (
    <section ref={ref} id="ch03-gold" data-theme="ivory" className="relative bg-ivory px-gutter py-[9svh] text-ink md:py-[12svh]" aria-labelledby="gold-title">
      <div ref={scope}>
        <div className="grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:grid-cols-12 md:items-start">
          {/* the words, the kinds, the door */}
          <div className="flex flex-col gap-7 md:col-span-4 md:sticky md:top-[calc(var(--nav-h)+4svh)] md:gap-9">
            <div className="flex flex-col gap-4">
              <Eyebrow className="text-ink/60">{COPY.departments.gold.eyebrow}</Eyebrow>
              <h2 id="gold-title" data-split className="display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] text-ink opacity-0">
                {COPY.departments.gold.title(department.count)}
              </h2>
              <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ink/70" data-rise>
                {COPY.departments.gold.line}
              </p>
            </div>
            <KindsList department={department} heading={COPY.departments.kinds} />
            <div data-rise>
              <Button variant="bracket" href="/gold" cursor="explore">
                {COPY.departments.gold.cta}
              </Button>
            </div>
          </div>

          {/* the pieces */}
          <div className="md:col-span-8">
            <PieceCluster rows={department.rows} />
          </div>
        </div>

        {/* gold, closely: the worked surface named where it sits, on a set that can be opened */}
        {figure && descriptor && (
          <div className="mt-[10svh] grid grid-cols-1 gap-x-[4vw] gap-y-[6svh] border-t border-ink/10 pt-[8svh] md:mt-[11svh] md:grid-cols-12 md:items-center md:pt-[9svh]">
            <div className="md:col-span-7" data-rise>
              <PieceLink
                product={pieceRefOf(figure)}
                sizes={figureSizes}
                aspect="1 / 1"
                cursor="view"
                figure={
                  <SemanticFigure
                    descriptor={descriptor}
                    sizes={figureSizes}
                    flipSource={figure.s}
                    onLit={setLit}
                    fallback={
                      <div className="absolute inset-0 bg-pearl">
                        <Img image={pieceRefOf(figure).media.hero} sizes={figureSizes} plain data={{ 'flip-source': figure.s }} />
                      </div>
                    }
                  />
                }
              >
                <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <div className="flex flex-col gap-1">
                    <p className="font-display text-[1.375rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 22' }}>
                      {figure.t}
                    </p>
                    <p className="micro text-ink/55">{tagOf(figure)}</p>
                  </div>
                  <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.departments.gold.figure.view}</span>
                </div>
              </PieceLink>
            </div>
            <div className="flex flex-col gap-5 md:col-span-4 md:col-start-9" data-rise>
              <p className="micro text-ink/55">{COPY.departments.gold.figure.eyebrow}</p>
              <ol className="flex flex-col gap-3 border-t border-ink/10 pt-5">
                {descriptor.regions.map((r, i) => (
                  <li key={r.key} data-lit={lit === r.key ? '1' : '0'} className="flex flex-col gap-1 opacity-45 transition-opacity duration-500 data-[lit=1]:opacity-100">
                    <span className="flex items-baseline gap-4">
                      <span className="font-display text-[0.75rem] text-ink/50" style={{ fontVariationSettings: '"opsz" 12' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="micro text-ink">{r.label}</span>
                    </span>
                    {r.note && (
                      <span className="hidden pl-8 font-display italic text-[0.9375rem] leading-snug text-ink/70 md:block" style={{ fontVariationSettings: '"opsz" 14' }}>
                        {r.note}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
