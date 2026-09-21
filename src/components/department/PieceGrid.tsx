'use client';

import { useRef } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { pieceRefOf } from '@/data/clientIndex';
import { useRise } from '@/motion/hooks/useReveals';
import { CATEGORY_LABEL } from '@/data/labels';
import type { Category } from '@/data/types';
import type { PieceRow } from '@/lib/facets';

/**
 * The index of a department.
 *
 * It is not a product grid with the cards taken off. Every twelfth piece is given the full
 * width instead of a column, so the page keeps the asymmetry the wall established and never
 * settles into a tile field — and because the promoted piece is the piece at that position
 * rather than an extra one, no piece is shown twice and the count stays true.
 *
 * The cards are the house's (src/styles/cards.css): EDITORIAL in the columns, HERO for the
 * promoted piece, the same pearl plate, the same inset, the same caption as the homepage's
 * trays, so a department page and the homepage read as one shop. Two columns on a phone,
 * three from md.
 *
 * A cell says what Waseem publishes about the piece: its kind, its purity and its weight.
 * It does not say PRICE ON REQUEST twenty-four times; that sentence belongs on the page of a
 * piece a visitor has chosen to look at, not under every photograph in the collection.
 */

const rupees = (p: number) => (p > 0 ? `Rs. ${new Intl.NumberFormat('en-US').format(p)}` : undefined);

/**
 * Only what is published, in the order a jeweller would say it — and the item code last,
 * because the shop names four hundred pieces "Gold Pendant" and the reference is the only
 * thing that tells one from the next. The units are held out of the micro face's upper case,
 * so grams stay `g` and carats stay `ct` rather than becoming initials.
 */
function facts(row: PieceRow): string[] {
  const unit = (value: string, u: string) => `${value} ${u}`;
  return [row.k, row.w !== undefined ? unit(row.w.toFixed(3), 'g') : undefined, row.ct !== undefined ? unit(String(row.ct), 'ct') : undefined, rupees(row.p)].filter((f): f is string => Boolean(f));
}

const index = (i: number) => String(i + 1).padStart(2, '0');

/**
 * The promoted piece: shown larger, in its own square — never cropped to a letterbox — with
 * its published facts set beside it in the display face. It is the piece that would have
 * occupied this position anyway, given room to be looked at. On a phone the words come
 * first and the square follows, the width of the page.
 */
function WideCell({ row, index: i }: { row: PieceRow; index: number }) {
  return (
    // one link, not a link beside a link: the photograph and the name are the same door
    <PieceLink
      product={pieceRefOf(row)}
      sizes="(min-width: 1744px) 700px, (min-width: 768px) 42vw, 92vw"
      scale="hero"
      aspect="1 / 1"
      // `grid!` because PieceLink is a block by default and `cn` here is a plain join, not a merge
      className="grid! grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,44%)_1fr] md:gap-16"
    >
      <span className="wj-caption order-first mt-0 gap-3 md:order-none md:gap-4">
        <span className="wj-caption-kind">
          {index(i)}
          {row.c ? ` · ${CATEGORY_LABEL[row.c as Category]}` : ''}
        </span>
        <span className="display block max-w-[11em] text-[clamp(1.75rem,1.1rem+2vw,2.75rem)] leading-[0.98] [text-wrap:balance]">{row.t}</span>
        <span aria-hidden className="hairline block w-24 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/piece:scale-x-100" />
        <span className="wj-caption-tag">
          {facts(row).map((f) => (
            <span key={f} className="wj-caption-part">
              {f}
            </span>
          ))}
          {row.rf && <span className="wj-caption-ref">{row.rf}</span>}
        </span>
      </span>
    </PieceLink>
  );
}

export function PieceGrid({ rows, promoteEvery = 12 }: { rows: PieceRow[]; promoteEvery?: number }) {
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <div ref={scope} className="wj-index">
      {rows.map((row, i) => {
        const wide = promoteEvery > 0 && i % promoteEvery === promoteEvery - 1;
        return (
          <div key={row.s} data-rise data-wide={wide ? '' : undefined} className={wide ? 'py-[var(--block-y)]' : undefined}>
            {wide ? (
              <WideCell row={row} index={i} />
            ) : (
              <PieceLink
                product={pieceRefOf(row)}
                sizes="(min-width: 1744px) 520px, (min-width: 768px) 30vw, 46vw"
                scale="editorial"
                // the first row is above the fold on every screen: fetched at once, not when scrolled to
                priority={i < 3}
                caption={{ kind: `${index(i)}${row.c ? ` · ${CATEGORY_LABEL[row.c as Category]}` : ''}`, name: row.t, facts: facts(row), ref: row.rf || undefined }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
