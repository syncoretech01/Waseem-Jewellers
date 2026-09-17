'use client';

import { PieceLink } from '@/components/commerce/PieceLink';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { pieceRefOf } from '@/data/clientIndex';
import type { PieceRow, ShowcaseDepartment } from '@/lib/facets';
import { CATEGORY_LABEL } from '@/data/labels';
import type { Category } from '@/data/types';
import { cn } from '@/lib/cn';

/** A tag the way a jeweller writes one: purity, weight, reference — nothing invented. */
export function tagOf(r: PieceRow): string {
  // a number and its unit never part company at a line end
  const grams = r.w !== undefined ? `${Number(r.w.toFixed(2))}\u00a0g` : undefined;
  return [r.k, grams, r.ct !== undefined ? `${r.ct}\u00a0ct` : undefined, r.rf].filter(Boolean).join(' · ');
}

/** The piece's kind, for the line above its name — empty where the name already says it (a "Baby Bangle" filed as a bracelet is not captioned "Bracelet"). */
export function kindOf(r: PieceRow): string {
  const kind = r.c ? CATEGORY_LABEL[r.c as Category] : 'Jewellery';
  const name = r.t.toLowerCase();
  const named = [...Object.values(CATEGORY_LABEL), 'bangle', 'bracelet', 'suite', 'set'].some((k) => name.includes(k.toLowerCase()));
  return named ? '' : kind;
}

/**
 * The pieces a department chapter puts forward: one large plate and four beside it, set off
 * one another. The same five positions serve gold, diamond, men and kids, so the departments
 * read as one shop with different trays rather than four designs.
 */
export function PieceCluster({ rows, tone = 'ink', reverse = false }: { rows: PieceRow[]; tone?: 'ink' | 'ivory'; reverse?: boolean }) {
  const [lead, ...rest] = rows;
  if (!lead) return null;
  const fg = tone === 'ink' ? 'text-ink' : 'text-ivory';
  const muted = tone === 'ink' ? 'text-ink/50' : 'text-ivory/50';
  const hover = tone === 'ink' ? 'group-hover/piece:text-ink' : 'group-hover/piece:text-ivory';
  const label = (row: PieceRow, size: 'lg' | 'sm') => (
    <div className="mt-3 flex flex-col gap-1 md:mt-4">
      {kindOf(row) && <p className={cn('micro', muted)}>{kindOf(row)}</p>}
      <p className={cn('font-display leading-tight', fg, size === 'lg' ? 'text-[1.25rem] md:text-[1.375rem]' : 'text-[1rem]')} style={{ fontVariationSettings: size === 'lg' ? '"opsz" 22' : '"opsz" 14' }}>
        {row.t}
      </p>
      <p className={cn('micro', muted, hover, 'transition-colors')}>{tagOf(row)}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-x-[4vw] gap-y-8 md:grid-cols-12 md:gap-x-[2vw] md:gap-y-[5svh]">
      <div className={cn('col-span-2 md:col-span-6 md:row-start-1', reverse ? 'md:col-start-7' : 'md:col-start-1')} data-rise>
        <PieceLink product={pieceRefOf(lead)} sizes="(min-width: 768px) 30vw, 92vw" aspect="4 / 5" cursor="view">
          {label(lead, 'lg')}
        </PieceLink>
      </div>
      <ul className={cn('col-span-2 grid grid-cols-2 gap-x-[4vw] gap-y-8 md:col-span-6 md:row-start-1 md:gap-x-[2vw] md:gap-y-[4svh]', reverse ? 'md:col-start-1' : 'md:col-start-7')} aria-label="More pieces">
        {rest.slice(0, 4).map((row, i) => (
          <li key={row.s} className={cn(i % 2 === 1 && 'md:mt-[8svh]')} data-rise>
            <PieceLink product={pieceRefOf(row)} sizes="(min-width: 768px) 16vw, 44vw" aspect="1 / 1" cursor="view">
              {label(row, 'sm')}
            </PieceLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The kinds a department is made of, counted — each a door into that kind. */
export function KindsList({ department, tone = 'ink', heading }: { department: ShowcaseDepartment; tone?: 'ink' | 'ivory'; heading: string }) {
  if (department.categories.length === 0) return null;
  const fg = tone === 'ink' ? 'text-ink' : 'text-ivory';
  const muted = tone === 'ink' ? 'text-ink/45' : 'text-ivory/45';
  const line = tone === 'ink' ? 'border-ink/10' : 'border-ivory/10';
  const rule = tone === 'ink' ? 'bg-ink/40' : 'bg-ivory/40';
  return (
    <nav aria-label={`${department.label} — ${heading}`} className="flex flex-col" data-rise>
      <p className={cn('micro mb-2', muted)}>{heading}</p>
      <ul className={cn('flex flex-col divide-y', line)}>
        {department.categories.map((k) => (
          <li key={k.category}>
            <TransitionLink href={k.href} className={cn('group/kind flex items-baseline justify-between gap-6 py-3 transition-colors', fg)} data-cursor="explore">
              <span className="relative font-display text-[1.0625rem] leading-tight" style={{ fontVariationSettings: '"opsz" 16' }}>
                {k.label}
                <span aria-hidden className={cn('absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/kind:scale-x-100', rule)} />
              </span>
              <span aria-hidden className={cn('font-display text-[1rem] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/kind:translate-x-1', muted)}>
                →
              </span>
            </TransitionLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
