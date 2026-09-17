'use client';

import { useRef, useState } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { Img } from '@/components/media/Img';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { pieceRefOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { PieceRow, ShowcaseDepartment } from '@/lib/facets';
import { DepartmentRow, tagOf } from './showcase';

/**
 * CH03 — Gold.
 *
 * The largest department, shown as a department: the karat, the kinds, and the pieces
 * themselves on the tray every department shares. Then gold looked at closely — the goldwork
 * figure on a set Waseem publishes, its worked surfaces named where they sit — and the door
 * to the set. Everything here is a door: a piece, a kind, or the department.
 */
export function Ch03Gold({ department, figure }: { department?: ShowcaseDepartment; figure?: PieceRow }) {
  const { ref } = useChapter({ id: 'gold', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<string | null>(null);
  useSplitReveal(scope, {
    selector: '[data-split]',
    type: 'lines',
    stagger: 0.07,
  });
  useRise(scope);
  const descriptor = figure ? semanticFor(figure.s) : undefined;
  const figureSizes = '(min-width: 768px) 50vw, 92vw';
  if (!department) return null;

  return (
    <section ref={ref} id="ch03-gold" data-theme="ivory" className="relative bg-ivory px-gutter py-[var(--chapter-y)] text-ink" aria-labelledby="gold-title">
      <div ref={scope} className="wj-content">
        <DepartmentRow department={department} copy={COPY.departments.gold} href="/gold" titleId="gold-title" kindsHeading={COPY.departments.kinds} />

        {/* gold, closely: the worked surface named where it sits, on a set that can be opened — a square hero, the figure's own frame */}
        {figure && descriptor && (
          <div className="wj-grid mt-[var(--chapter-y)] border-t border-ink/10 pt-[var(--block-y)] md:items-center">
            <div className="md:col-span-7" data-rise>
              <PieceLink
                product={pieceRefOf(figure)}
                sizes={figureSizes}
                scale="hero"
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
                <span className="wj-caption md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <span className="flex flex-col gap-1">
                    <span className="wj-caption-name">{figure.t}</span>
                    <span className="wj-caption-tag">{tagOf(figure)}</span>
                  </span>
                  <span className="micro shrink-0 text-ink/70 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.departments.gold.figure.view}</span>
                </span>
              </PieceLink>
            </div>
            <div className="order-first flex flex-col gap-5 md:order-none md:col-span-4 md:col-start-9" data-rise>
              <p className="micro text-ink/55">{COPY.departments.gold.figure.eyebrow}</p>
              <ol className="hidden flex-col gap-3 border-t border-ink/10 pt-5 md:flex">
                {descriptor.regions.map((r, i) => (
                  <li key={r.key} data-lit={lit === r.key ? '1' : '0'} className="flex flex-col gap-1 opacity-65 transition-opacity duration-500 data-[lit=1]:opacity-100">
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
