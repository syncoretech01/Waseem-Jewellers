'use client';

import { Img } from '@/components/media/Img';
import type { CompareRow, PieceCard } from '@/state/conciergeStore';
import { CONCIERGE } from '../../copy';
import { cn } from '@/lib/cn';

interface CompareTableProps {
  pieces: PieceCard[];
  rows: CompareRow[];
  onOpen: (piece: PieceCard) => void;
  onAsk: (piece: PieceCard) => void;
  compact?: boolean;
}

/**
 * Two or three pieces, side by side, as a real table: a caption, scoped headers, one row per
 * published axis. A figure Waseem has not published is a dash and a way to ask — never a
 * number borrowed from the piece beside it.
 */
export function CompareTable({ pieces, rows, onOpen, onAsk, compact }: CompareTableProps) {
  const thumb = compact ? 88 : 128;
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-left', compact ? (pieces.length > 2 ? 'min-w-[26rem]' : 'min-w-0') : 'min-w-[32rem]')}>
        <caption className="sr-only">{CONCIERGE.labels.compareDone}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn('micro pb-5 align-bottom font-normal text-fg-muted', compact ? 'w-[5.5rem]' : 'w-[8.5rem]')}>
              Published
            </th>
            {pieces.map((p) => (
              <th key={p.slug} scope="col" className={cn('pb-5 align-bottom font-normal', compact ? 'pr-4' : 'pr-8')}>
                <button type="button" onClick={() => onOpen(p)} className="group/col block text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]" data-cursor="view">
                  <span className="salon-tile relative block overflow-hidden" style={{ width: thumb, aspectRatio: '4 / 5', background: 'var(--salon-well)' }}>
                    <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/col:scale-[1.03]">
                      <Img image={p.image} alt="" sizes={`${thumb}px`} />
                    </span>
                  </span>
                  <span dir="auto" className="mt-3 block max-w-[14em] font-display text-[1.0625rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
                    {p.name}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.axis} className="border-t border-line">
              <th scope="row" className={cn('micro py-3.5 align-baseline font-normal text-fg-muted', compact ? 'pr-3' : 'pr-6')}>
                {r.axis}
              </th>
              {r.values.map((v, i) => (
                <td key={pieces[i]?.slug ?? i} className={cn('py-3.5 align-baseline font-display text-fg', compact ? 'pr-4 text-[1rem]' : 'pr-8 text-[1.0625rem]')} style={{ fontVariationSettings: '"opsz" 16' }}>
                  {v ?? (
                    <span className="flex items-baseline gap-3">
                      <span aria-label={CONCIERGE.notPublished} className="text-fg-muted">
                        —
                      </span>
                      {pieces[i] && (
                        <button type="button" onClick={() => onAsk(pieces[i]!)} className="micro text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
                          {CONCIERGE.ask}
                        </button>
                      )}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
