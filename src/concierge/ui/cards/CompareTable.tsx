'use client';

import { Img } from '@/components/media/Img';
import type { CompareRow, PieceCard } from '@/state/conciergeStore';
import { CONCIERGE } from '../../copy';

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
      <table className="w-full min-w-[32rem] border-collapse text-left">
        <caption className="sr-only">{CONCIERGE.labels.compareDone}</caption>
        <thead>
          <tr>
            <th scope="col" className="micro w-[8.5rem] pb-5 align-bottom font-normal text-fg-muted">
              Published
            </th>
            {pieces.map((p) => (
              <th key={p.slug} scope="col" className="pb-5 pr-8 align-bottom font-normal">
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
              <th scope="row" className="micro py-3.5 pr-6 align-baseline font-normal text-fg-muted">
                {r.axis}
              </th>
              {r.values.map((v, i) => (
                <td key={pieces[i]?.slug ?? i} className="py-3.5 pr-8 align-baseline font-display text-[1.0625rem] text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
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
