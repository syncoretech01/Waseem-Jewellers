'use client';

import { PieceLink, type CardScale, type PieceCaption } from '@/components/commerce/PieceLink';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
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

/** The house caption for a row: kind where the name needs it, the name, the published tag. */
export function captionOf(r: PieceRow): PieceCaption {
  return {
    kind: kindOf(r) || undefined,
    name: r.t,
    tag: tagOf(r) || undefined,
  };
}

/**
 * The tray's five positions, in reading order. One HERO across both rows, two EDITORIAL
 * beside it, two STANDARD beneath those — the composition is in src/styles/cards.css and is
 * the same in gold, diamond, men and kids, so the departments read as one shop with
 * different trays rather than four designs.
 */
const SLOTS: { slot: string; scale: CardScale; sizes: string }[] = [
  { slot: 'hero', scale: 'hero', sizes: '(min-width: 768px) 30vw, 92vw' },
  {
    slot: 'editorial-1',
    scale: 'editorial',
    sizes: '(min-width: 768px) 15vw, 46vw',
  },
  {
    slot: 'editorial-2',
    scale: 'editorial',
    sizes: '(min-width: 768px) 15vw, 46vw',
  },
  {
    slot: 'standard-1',
    scale: 'standard',
    sizes: '(min-width: 768px) 15vw, 46vw',
  },
  {
    slot: 'standard-2',
    scale: 'standard',
    sizes: '(min-width: 768px) 15vw, 46vw',
  },
];

/** The pieces a department chapter puts forward, on the tray every department shares. */
export function PieceCluster({ rows, reverse = false, label = 'Pieces' }: { rows: PieceRow[]; reverse?: boolean; label?: string }) {
  const shown = rows.slice(0, SLOTS.length);
  if (shown.length === 0) return null;
  return (
    <ul className="wj-cluster" data-reverse={reverse ? '' : undefined} aria-label={label}>
      {shown.map((row, i) => {
        const { slot, scale, sizes } = SLOTS[i]!;
        return (
          <li key={row.s} data-slot={slot} data-rise>
            {/* the hero stands across both rows: a column whose plate takes the height the other four leave it */}
            <PieceLink product={pieceRefOf(row)} sizes={sizes} scale={scale} caption={captionOf(row)} cursor="view" className={scale === 'hero' ? 'md:flex md:h-full md:flex-col' : undefined} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A department, as every department chapter shows one: the words in four columns — eyebrow,
 * title, line, the kinds, the door — and the tray in the other eight. The words stand still
 * beside the tray on a tall enough screen. `reverse` puts the tray first, so gold and diamond,
 * men and kids alternate sides the way the chapters alternate ink and ivory. On a phone the
 * title leads, the pieces follow, the kinds and the door close.
 */
export function DepartmentRow({
  department,
  copy,
  href,
  tone = 'ink',
  reverse = false,
  titleId,
  level = 'h2',
  kindsHeading,
}: {
  department: ShowcaseDepartment;
  copy: { eyebrow: string; title: string; line: string; cta: string };
  href: string;
  tone?: 'ink' | 'ivory';
  reverse?: boolean;
  titleId: string;
  level?: 'h2' | 'h3';
  kindsHeading: string;
}) {
  const Title = level;
  const fg = tone === 'ink' ? 'text-ink' : 'text-ivory';
  const muted = tone === 'ink' ? 'text-ink/70' : 'text-ivory/70';
  const eyebrow = tone === 'ink' ? 'text-ink/60' : 'text-champagne';
  return (
    <div className="wj-grid md:items-start">
      {/* the words, the kinds, the door */}
      <div className={cn('contents md:top-[calc(var(--nav-h)+4svh)] md:col-span-4 md:flex md:flex-col md:gap-9 md:row-start-1 md:[@media(min-height:800px)]:sticky', reverse ? 'md:col-start-9' : 'md:col-start-1')}>
        <div className="order-1 flex flex-col gap-4 md:order-none">
          <Eyebrow className={eyebrow}>{copy.eyebrow}</Eyebrow>
          <Title id={titleId} data-split className={cn('display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] opacity-0 [text-wrap:balance]', fg)}>
            {copy.title}
          </Title>
          <p className={cn('max-w-[28em] text-[0.9375rem] leading-relaxed', muted)} data-rise>
            {copy.line}
          </p>
        </div>
        <div className="order-3 md:order-none">
          <KindsList department={department} tone={tone} heading={kindsHeading} />
        </div>
        <div className="order-4 md:order-none" data-rise>
          <Button variant="bracket" href={href} cursor="explore">
            {copy.cta}
          </Button>
        </div>
      </div>

      {/* the pieces */}
      <div className={cn('order-2 md:order-none md:col-span-8 md:row-start-1', reverse ? 'md:col-start-1' : 'md:col-start-5')}>
        <PieceCluster rows={department.rows} reverse={reverse} label={`${department.label} — pieces`} />
      </div>
    </div>
  );
}

/** The kinds a department is made of — each a door into that kind. */
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
