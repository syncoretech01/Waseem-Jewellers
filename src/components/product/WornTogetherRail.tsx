'use client';

import { useId, useRef } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { Eyebrow } from '@/components/ui/primitives';
import { formatPrice } from '@/lib/format';
import { useRise } from '@/motion/hooks/useReveals';
import { useChapter } from '@/motion/hooks/useChapter';
import { nameOf } from '@/data/labels';
import type { Product } from '@/data/types';

interface RailProps {
  products: Product[];
  eyebrow?: string;
  title?: string;
  theme?: 'dark' | 'ivory';
}

/**
 * Complementary pieces in a horizontal drag/snap rail; where price-on-request and priced
 * pieces meet.
 *
 * It renders nothing when it has nothing. A heading reading "Pieces that answer this one"
 * over an empty row is worse than silence, and with 599 pieces most of which have no
 * authored companions, silence is the common case.
 */
export function WornTogetherRail({ products, eyebrow = 'Worn together', title, theme = 'dark' }: RailProps) {
  const { ref } = useChapter({ id: 'related', theme });
  const scope = useRef<HTMLDivElement>(null);
  // three rails can stand on one page, so the heading id has to be its own
  const titleId = useId();
  useRise(scope);
  if (products.length === 0) return null;

  return (
    <section ref={ref} data-theme={theme} className="bg-bg text-fg py-section" aria-labelledby={titleId}>
      <div ref={scope} className="px-gutter">
        <div className="flex flex-wrap items-end justify-between gap-6" data-rise>
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 id={titleId} className="display mt-4 text-display-m">
              {title ?? 'Pieces that answer this one.'}
            </h2>
          </div>
        </div>
        <div className="no-scrollbar mt-12 flex snap-x snap-proximity gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible" data-lenis-prevent-wheel>
          {products.map((p, i) => (
            <div key={p.slug} className="w-[72vw] shrink-0 snap-start md:w-auto" data-rise>
              <PieceLink product={p} sizes="(min-width: 768px) 30vw, 72vw" aspect="3 / 4">
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-[1.125rem] leading-tight text-fg" style={{ fontVariationSettings: '"opsz" 18' }}>
                      {nameOf(p)}
                    </p>
                    {p.campaign && <p className="micro mt-1 text-fg-muted">{p.campaign}</p>}
                  </div>
                  <p className="micro pt-1 text-fg-2">{formatPrice(p.price)}</p>
                </div>
                <span className="sr-only">{`Piece ${i + 1} of ${products.length}`}</span>
              </PieceLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
