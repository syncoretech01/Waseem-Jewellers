'use client';

import { useEffect } from 'react';
import { Gallery } from './Gallery';
import { InfoColumn } from './InfoColumn';
import { WornTogetherRail } from './WornTogetherRail';
import { pdpMode } from './pdpMode';
import { CloseLook } from './CloseLook';
import { semanticFor } from '@/data/semantic';
import { useChapter } from '@/motion/hooks/useChapter';
import { useSiteStore } from '@/state/siteStore';
import { nameOf } from '@/data/labels';
import type { Product } from '@/data/types';

interface ProductExperienceProps {
  product: Product;
  /** The other pieces of the same suite, where the piece belongs to one. */
  suite: Product[];
  /** Complementary kinds — what is worn with this. */
  matching: Product[];
  /** More of the same kind — what else is like this. */
  similar: Product[];
}

/**
 * /jewellery/[slug] — imagery first, in whichever shape the imagery actually takes.
 *
 * A piece photographed as a scene opens 62/38 beside its words, exactly as Stage 1 did. A
 * piece with two or three studio cut-outs shows them side by side, because two stacked
 * pearl plates is mostly pearl. And a piece with one photograph — which is three quarters of
 * this shop — is given a single centred frame with the words beneath it, so the page reads
 * as a considered composition rather than as a gallery missing its other images.
 */
export function ProductExperience({ product, suite, matching, similar }: ProductExperienceProps) {
  const { ref } = useChapter({ id: 'gallery', theme: 'dark' });
  const setCurrent = useSiteStore((s) => s.setCurrentProduct);
  const setCollection = useSiteStore((s) => s.setSelectedCollection);
  const setVisible = useSiteStore((s) => s.setVisibleProducts);
  const nearby = [...suite, ...matching, ...similar].map((p) => p.slug);

  useEffect(() => {
    setCurrent(product.slug);
    setCollection(product.departments[0] ?? null);
    // everything the concierge can be asked to open by ordinal while this page is in view
    setVisible([product.slug, ...nearby]);
    return () => setCurrent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, setCurrent, setCollection, setVisible, nearby.join('|')]);

  const mode = pdpMode(product);
  const closely = semanticFor(product.slug);

  return (
    <main className="bg-bg text-fg">
      <section ref={ref} data-theme="dark" className="pt-[calc(var(--nav-h)+1rem)] md:pt-[calc(var(--nav-h)+2rem)]" aria-label={nameOf(product)}>
        {mode === 'single' ? (
          /**
           * One frame, centred, and the words beneath it. There is no second column to
           * leave empty and no gallery track carrying a single slide — the composition is
           * the composition, and at this width the photograph is larger than it would be
           * in the 62/38 split.
           */
          <div data-rail-inset className="mx-auto flex max-w-[64rem] flex-col gap-14 px-gutter md:gap-20 md:pb-section">
            <Gallery product={product} mode={mode} />
            <div className="mx-auto w-full max-w-[42rem] pb-32 md:pb-0">
              <InfoColumn product={product} />
            </div>
          </div>
        ) : (
          <div data-rail-inset className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,55fr)_minmax(340px,45fr)] md:gap-gutter md:px-gutter xl:grid-cols-[minmax(0,62fr)_minmax(360px,38fr)]">
            <div className="md:pb-section">
              <Gallery product={product} mode={mode} />
            </div>
            <div className="px-gutter pb-32 md:px-0 md:pb-section">
              <div className="md:sticky md:top-[calc(var(--nav-h)+2rem)]">
                <InfoColumn product={product} />
              </div>
            </div>
          </div>
        )}
      </section>
      {/* only where there is something specific to say about this piece */}
      {closely && <CloseLook descriptor={closely} name={nameOf(product)} />}

      {/* each rail renders only if it has something; most pieces show one, some show none */}
      <WornTogetherRail products={suite} eyebrow="The suite" title="The rest of the set." theme="ivory" />
      <WornTogetherRail products={matching} eyebrow="Worn together" title="Pieces that answer this one." theme="ivory" />
      <WornTogetherRail products={similar} eyebrow="In the same spirit" title="More like this one." theme={suite.length || matching.length ? 'dark' : 'ivory'} />
    </main>
  );
}
