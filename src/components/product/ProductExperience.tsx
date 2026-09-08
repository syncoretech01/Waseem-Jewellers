'use client';

import { useEffect } from 'react';
import { Gallery } from './Gallery';
import { InfoColumn } from './InfoColumn';
import { WornTogetherRail } from './WornTogetherRail';
import { useChapter } from '@/motion/hooks/useChapter';
import { useSiteStore } from '@/state/siteStore';
import { productsBySlugs } from '@/data';
import type { Product } from '@/data/types';

/** /jewellery/[slug] — imagery first: 62 / 38 on desktop, gallery on top on phones, sticky CTA bar. */
export function ProductExperience({ product }: { product: Product }) {
  const { ref } = useChapter({ id: 'gallery', theme: 'dark' });
  const setCurrent = useSiteStore((s) => s.setCurrentProduct);
  const setCollection = useSiteStore((s) => s.setSelectedCollection);
  const setVisible = useSiteStore((s) => s.setVisibleProducts);
  const complementary = productsBySlugs(product.complementary);

  useEffect(() => {
    setCurrent(product.slug);
    setCollection(product.collection);
    setVisible([product.slug, ...product.complementary]);
    return () => setCurrent(null);
  }, [product, setCurrent, setCollection, setVisible]);

  return (
    <main className="bg-bg text-fg">
      <section ref={ref} data-theme="dark" className="pt-[calc(var(--nav-h)+1rem)] md:pt-[calc(var(--nav-h)+2rem)]" aria-label={product.editorialTitle}>
        <div data-rail-inset className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,55fr)_minmax(340px,45fr)] md:gap-gutter md:px-gutter xl:grid-cols-[minmax(0,62fr)_minmax(360px,38fr)]">
          <div className="md:pb-section">
            <Gallery product={product} />
          </div>
          <div className="px-gutter pb-32 md:px-0 md:pb-section">
            <div className="md:sticky md:top-[calc(var(--nav-h)+2rem)]">
              <InfoColumn product={product} />
            </div>
          </div>
        </div>
      </section>
      <WornTogetherRail products={complementary} theme="ivory" />
    </main>
  );
}
