'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { formatPrice } from '@/lib/format';
import { useRise } from '@/motion/hooks/useReveals';
import { useChapter } from '@/motion/hooks/useChapter';
import type { Product } from '@/data/types';
import { EASE } from '@/lib/motion/easings';

/** A restrained three-column index — editorial title, price line, no cards. */
export function IndexView({ products, title }: { products: Product[]; title?: string }) {
  const { ref } = useChapter({ id: 'pieces', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg py-section text-fg" aria-label={title ?? 'Index'}>
      <motion.div ref={scope} key={`${title ?? ''}|${products.map((p) => p.slug).join('|')}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, ease: EASE.out }} className="px-gutter">
        {title && (
          <p className="eyebrow mb-12 text-fg-2" data-rise>
            {title}
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-3 md:gap-x-10 md:gap-y-20">
          {products.map((p, i) => (
            <div key={p.slug} data-rise data-world={p.world}>
              <PieceLink product={p} sizes="(min-width:768px) 30vw, 46vw" aspect="4 / 5">
                <div className="mt-4 flex flex-col gap-1">
                  <p className="micro text-fg-muted">
                    {String(i + 1).padStart(2, '0')}
                    {p.house ? ` · ${p.house}` : ''}
                  </p>
                  <p className="font-display text-[1.125rem] leading-tight" style={{ fontVariationSettings: '"opsz" 18' }}>
                    {p.editorialTitle}
                  </p>
                  <p className="micro text-fg-2">{formatPrice(p.price)}</p>
                </div>
              </PieceLink>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
