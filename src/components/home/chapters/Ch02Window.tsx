'use client';

import { useRef } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { pieceRefOf } from '@/data/clientIndex';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { CATEGORY_LABEL } from '@/data/labels';
import { COPY } from '@/data/copy';
import type { Category } from '@/data/types';
import type { PieceRow, ShowcaseCategory } from '@/lib/facets';
import { cn } from '@/lib/cn';

/** A tag the way a jeweller writes one: purity, weight, reference — nothing invented. */
export function tagOf(r: PieceRow): string {
  const grams = r.w !== undefined ? `${Number(r.w.toFixed(2))} g` : undefined;
  return [r.k, grams, r.ct !== undefined ? `${r.ct} ct` : undefined, r.rf].filter(Boolean).join(' · ');
}

/** The piece's kind, for the line above its name. */
export const kindOf = (r: PieceRow) => (r.c ? CATEGORY_LABEL[r.c as Category] : 'Jewellery');

/**
 * Ten positions in a twelve-column window, read left to right and down: two large plates,
 * the rest smaller and set off one another so the eye travels rather than scans. The
 * asymmetry and the whitespace are what make this a window and not a grid.
 */
const SLOTS = [
  { col: 'md:col-start-1 md:col-span-5', aspect: '1 / 1', offset: '', size: 'lg' },
  { col: 'md:col-start-7 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[8svh]', size: 'sm' },
  { col: 'md:col-start-10 md:col-span-3', aspect: '4 / 5', offset: 'md:mt-[3svh]', size: 'sm' },
  { col: 'md:col-start-2 md:col-span-3', aspect: '1 / 1', offset: 'md:-mt-[4svh]', size: 'sm' },
  { col: 'md:col-start-5 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[6svh]', size: 'md' },
  { col: 'md:col-start-10 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[9svh]', size: 'sm' },
  { col: 'md:col-start-1 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[8svh]', size: 'md' },
  { col: 'md:col-start-6 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[2svh]', size: 'sm' },
  { col: 'md:col-start-9 md:col-span-4', aspect: '4 / 5', offset: 'md:-mt-[6svh]', size: 'md' },
  { col: 'md:col-start-4 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[4svh]', size: 'sm' },
];

const SIZES: Record<string, string> = {
  lg: '(min-width: 768px) 40vw, 92vw',
  md: '(min-width: 768px) 32vw, 46vw',
  sm: '(min-width: 768px) 24vw, 46vw',
};

/**
 * CH02 — the window.
 *
 * The first thing after the film is what a jeweller puts in the glass: pieces, photographed
 * as pieces, one of every kind, each with its purity, weight and reference beside it. Nothing
 * here is worn, staged or rendered — these are the photographs the shop sells from, on the
 * pearl plate every packshot sits on. Beneath them the kinds themselves, with their counts,
 * are the doors into the collection.
 */
export function Ch02Window({ pieces, kinds, total }: { pieces: PieceRow[]; kinds: ShowcaseCategory[]; total: number }) {
  const { ref } = useChapter({ id: 'vitrine', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  if (pieces.length === 0) return null;

  return (
    <section ref={ref} id="ch02-window" data-theme="ivory" className="relative bg-ivory px-gutter pb-[9svh] pt-[10svh] text-ink md:pb-[11svh] md:pt-[12svh]" aria-labelledby="window-title">
      <div ref={scope}>
        <div className="grid grid-cols-1 gap-x-[4vw] gap-y-6 md:grid-cols-12 md:items-end">
          <div className="flex flex-col gap-4 md:col-span-7">
            <Eyebrow className="text-ink/60">{COPY.window.eyebrow}</Eyebrow>
            <h2 id="window-title" data-split className="display max-w-[13em] text-[clamp(2.25rem,4.4vw,4.75rem)] leading-[1.02] text-ink opacity-0">
              {COPY.window.title}
            </h2>
          </div>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ink/70 md:col-span-4 md:col-start-9 md:pb-2" data-rise>
            {COPY.window.line(total)}
          </p>
        </div>

        {/* the glass */}
        <ul className="mt-[7svh] grid grid-cols-2 gap-x-[4vw] gap-y-10 md:mt-[8svh] md:grid-cols-12 md:gap-x-[2.2vw] md:gap-y-[4svh]" aria-label={COPY.window.eyebrow}>
          {pieces.slice(0, SLOTS.length).map((row, i) => {
            const slot = SLOTS[i]!;
            return (
              <li key={row.s} className={cn('col-span-1', slot.col, slot.offset, i === 0 && 'col-span-2')} data-rise>
                <PieceLink product={pieceRefOf(row)} sizes={SIZES[slot.size]!} aspect={slot.aspect} cursor="view">
                  <div className="mt-4 flex flex-col gap-1">
                    <p className="micro text-ink/50">{kindOf(row)}</p>
                    <p className={cn('font-display leading-tight text-ink', slot.size === 'lg' ? 'text-[1.375rem]' : 'text-[1.0625rem]')} style={{ fontVariationSettings: slot.size === 'lg' ? '"opsz" 22' : '"opsz" 16' }}>
                      {row.t}
                    </p>
                    <p className="micro flex flex-wrap items-baseline justify-between gap-x-4 text-ink/55">
                      <span>{tagOf(row)}</span>
                      <span className="text-ink/45 underline-offset-4 transition-colors group-hover/piece:text-ink group-hover/piece:underline">{COPY.window.view}</span>
                    </p>
                  </div>
                </PieceLink>
              </li>
            );
          })}
        </ul>

        {/* the kinds: every category with a page, counted across the whole collection */}
        {kinds.length > 0 && (
          <nav className="mt-[10svh] border-t border-ink/10 pt-8 md:mt-[12svh] md:pt-10" aria-label={COPY.window.kinds} data-rise>
            <p className="micro text-ink/50">{COPY.window.kinds}</p>
            <ul className="mt-5 flex flex-wrap gap-x-9 gap-y-4 md:gap-x-12">
              {kinds.map((k) => (
                <li key={k.category}>
                  <TransitionLink href={k.href} className="group/kind flex items-baseline gap-3" data-cursor="explore">
                    <span className="display text-[clamp(1.375rem,2vw,2rem)] leading-none text-ink transition-colors group-hover/kind:text-gold-deep">{k.label}</span>
                    <span className="font-display text-[0.8125rem] text-ink/45" style={{ fontVariationSettings: '"opsz" 12' }}>
                      {k.total}
                    </span>
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
