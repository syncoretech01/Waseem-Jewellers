'use client';

import { Img } from '@/components/media/Img';
import { SaveButton } from '@/components/commerce/SaveButton';
import { getRow } from '@/data/clientIndex';
import { campaignLabel } from '@/data/labels';
import { useQualityStore } from '@/state/qualityStore';
import type { PieceCard } from '@/state/conciergeStore';
import type { PieceRow } from '@/lib/facets';
import { CONCIERGE } from '../../copy';
import { cn } from '@/lib/cn';

/** The published facts a tray can carry under a name: purity, weight, carats — nothing else. */
export function factsOf(row: PieceRow | undefined): string {
  if (!row) return '';
  return [row.k, row.w !== undefined ? `${row.w.toFixed(1)} g` : undefined, row.ct !== undefined ? `${row.ct} ct` : undefined].filter(Boolean).join(' · ');
}

interface PieceTileProps {
  card: PieceCard;
  total: number;
  onOpen: () => void;
  onCompare?: () => void;
  comparing?: boolean;
  /** The sheet's band on a phone: a smaller tile, the verbs always shown. */
  compact?: boolean;
}

/**
 * One piece on the tray: the photograph on its mount, the name, one or two published facts,
 * and the three things a visitor can do with it. A packshot sits on pearl and is never
 * cropped; a campaign frame fills its plate.
 */
export function PieceTile({ card, total, onOpen, onCompare, comparing, compact }: PieceTileProps) {
  const coarse = useQualityStore((s) => s.coarse);
  const row = getRow(card.slug);
  const facts = factsOf(row);
  const priced = row ? row.p > 0 : false;
  const verbsShown = coarse || compact;
  return (
    <div className={cn('group/tile flex shrink-0 snap-start flex-col', compact ? 'w-[152px]' : 'w-[clamp(220px,17vw,300px)]')}>
      <button
        type="button"
        data-ordinal={card.ordinal}
        data-slug={card.slug}
        data-name={card.name}
        onClick={onOpen}
        className="salon-tile relative block w-full overflow-hidden text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        style={{ aspectRatio: '4 / 5', background: 'var(--salon-well)' }}
        aria-label={`Piece ${card.ordinal} of ${total}, ${card.name}${priced ? `, ${card.priceLabel.toLowerCase()}` : ''}`}
        data-cursor="view"
      >
        <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/tile:scale-[1.03]">
          <Img image={card.image} alt="" sizes={compact ? '168px' : '(min-width: 1280px) 17vw, 300px'} />
        </span>
      </button>
      <div className="mt-4 flex items-baseline gap-2.5">
        <span className="font-display text-[0.75rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
          {String(card.ordinal).padStart(2, '0')}
        </span>
        <button type="button" onClick={onOpen} dir="auto" className={cn('text-left font-display leading-snug text-fg', compact ? 'text-[1rem]' : 'text-[1.125rem]')} style={{ fontVariationSettings: '"opsz" 18' }} data-cursor="view">
          {card.name}
        </button>
      </div>
      <p className="mt-1 text-[0.8125rem] text-fg-2">{priced ? card.priceLabel : facts || campaignLabel(card.collection)}</p>
      <div className={cn('mt-2.5 flex items-center gap-5 whitespace-nowrap transition-opacity duration-300', verbsShown ? 'opacity-100' : 'opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100')}>
        {/* on the sheet the photograph is the door; the verbs are the two that need a word */}
        {!compact && (
          <button type="button" onClick={onOpen} className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="view">
            {CONCIERGE.view}
          </button>
        )}
        <SaveButton slug={card.slug} variant="compact" className="-my-2 h-8 w-8" />
        {onCompare && (
          <button
            type="button"
            onClick={onCompare}
            aria-pressed={comparing}
            className={cn('micro transition-colors hover:text-fg', comparing ? 'text-fg underline decoration-gold-hi underline-offset-4' : 'text-fg-muted')}
            data-cursor="compare"
          >
            {CONCIERGE.compare}
          </button>
        )}
      </div>
    </div>
  );
}
