'use client';

import { useRef } from 'react';
import { PieceLink, type PieceRef } from '@/components/commerce/PieceLink';
import { useRise } from '@/motion/hooks/useReveals';
import { CATEGORY_LABEL } from '@/data/labels';
import type { Category, ImageRef, ProductImage } from '@/data/types';
import type { PieceRow } from '@/lib/facets';
import { cn } from '@/lib/cn';

/**
 * The index of a department.
 *
 * It is not a product grid with the cards taken off. Every twelfth piece is given the full
 * width instead of a column, so the page keeps the asymmetry the wall established and never
 * settles into a tile field — and because the promoted piece is the piece at that position
 * rather than an extra one, no piece is shown twice and the count stays true.
 *
 * A cell says what Waseem publishes about the piece: its kind, its purity and its weight.
 * It does not say PRICE ON REQUEST twenty-four times; that sentence belongs on the page of a
 * piece a visitor has chosen to look at, not under every photograph in the collection.
 */

/** Local when the slim row carries an asset id, remote when it carries a source and its size. */
const refOf = (r: PieceRow): ImageRef =>
  r.hw !== undefined && r.hh !== undefined ? { kind: 'remote', src: r.h, width: r.hw, height: r.hh } : { kind: 'local', id: r.h };

const heroOf = (r: PieceRow): ProductImage => ({
  ref: refOf(r),
  role: r.r,
  order: 0,
  alt: `${r.t}${r.c ? ` — ${CATEGORY_LABEL[r.c as Category].toLowerCase()}` : ''}, Waseem Jewellers`,
  altDerived: true,
});

export const pieceRefOf = (r: PieceRow): PieceRef => ({ slug: r.s, media: { hero: heroOf(r) } });

const rupees = (p: number) => (p > 0 ? `Rs. ${new Intl.NumberFormat('en-US').format(p)}` : undefined);

/**
 * Only what is published, in the order a jeweller would say it — and the item code last,
 * because the shop names four hundred pieces "Gold Pendant" and the reference is the only
 * thing that tells one from the next.
 *
 * The line is set in the micro face, which upper-cases; the units are held out of that, so
 * grams stay `g` and carats stay `ct` rather than becoming initials.
 */
function Facts({ row }: { row: PieceRow }) {
  const unit = (value: string, u: string) => (
    <>
      {value}
      <span className="normal-case"> {u}</span>
    </>
  );
  const parts = [
    row.k,
    row.w !== undefined ? unit(row.w.toFixed(3), 'g') : undefined,
    row.ct !== undefined ? unit(String(row.ct), 'ct') : undefined,
    rupees(row.p),
    row.rf,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="micro text-fg-2">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {part}
        </span>
      ))}
    </p>
  );
}

function Caption({ row, index }: { row: PieceRow; index: number }) {
  return (
    <div className="mt-4 flex flex-col gap-1">
      <p className="micro text-fg-muted">
        {String(index + 1).padStart(2, '0')}
        {row.c ? ` · ${CATEGORY_LABEL[row.c as Category]}` : ''}
      </p>
      <p className="font-display text-[1.125rem] leading-tight" style={{ fontVariationSettings: '"opsz" 18' }}>
        {row.t}
      </p>
      <Facts row={row} />
    </div>
  );
}

/**
 * The promoted piece: shown larger, in its own square — never cropped to a letterbox — with
 * its published facts set beside it in the display face. It is the piece that would have
 * occupied this position anyway, given room to be looked at.
 */
function WideCell({ row, index }: { row: PieceRow; index: number }) {
  return (
    // one link, not a link beside a link: the photograph and the name are the same door
    <PieceLink
      product={pieceRefOf(row)}
      sizes="(min-width:768px) 42vw, 92vw"
      aspect="1 / 1"
      // `grid!` because PieceLink is a block by default and `cn` here is a plain join, not a merge
      className="grid! grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,44%)_1fr] md:gap-16"
    >
      <div className="flex flex-col gap-4">
        <p className="micro text-fg-muted">
          {String(index + 1).padStart(2, '0')}
          {row.c ? ` · ${CATEGORY_LABEL[row.c as Category]}` : ''}
        </p>
        <span className="display block max-w-[11em] text-display-s leading-[0.98]">{row.t}</span>
        <span aria-hidden className="hairline block w-24 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/piece:scale-x-100" />
        <Facts row={row} />
      </div>
    </PieceLink>
  );
}

export function PieceGrid({ rows, promoteEvery = 12 }: { rows: PieceRow[]; promoteEvery?: number }) {
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <div ref={scope} className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-3 md:gap-x-10 md:gap-y-20">
      {rows.map((row, i) => {
        const wide = promoteEvery > 0 && i % promoteEvery === promoteEvery - 1;
        return (
          <div key={row.s} data-rise className={cn(wide && 'col-span-full py-6 md:py-12')}>
            {wide ? (
              <WideCell row={row} index={i} />
            ) : (
              <PieceLink product={pieceRefOf(row)} sizes="(min-width:768px) 30vw, 46vw" aspect="4 / 5">
                <Caption row={row} index={i} />
              </PieceLink>
            )}
          </div>
        );
      })}
    </div>
  );
}
