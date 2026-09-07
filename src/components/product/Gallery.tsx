'use client';

import { useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Img } from '@/components/media/Img';
import { InspectImage } from './InspectImage';
import { useMaskReveal } from '@/motion/hooks/useReveals';
import type { Product } from '@/data/types';

/** Desktop: stacked large frames with draw-to-the-eye hover. Mobile: snap track + lightbox. */
export function Gallery({ product }: { product: Product }) {
  const scope = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const frames = product.media.gallery;
  useMaskReveal(scope, { selector: '[data-reveal]', from: 'bottom' });

  return (
    <div ref={scope}>
      {/* desktop / tablet */}
      <div className="hidden flex-col gap-6 md:flex">
        {frames.map((id, i) => (
          <div key={id} data-reveal={i === 0 ? undefined : 'bottom'} className="relative">
            <InspectImage
              id={id}
              slug={product.slug}
              sizes="(min-width: 1280px) 62vw, (min-width: 768px) 55vw, 100vw"
              priority={i === 0}
              flipTarget={i === 0}
              macro={id === product.media.macro || i > 0}
            />
          </div>
        ))}
      </div>

      {/* mobile */}
      <div className="md:hidden">
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pl-gutter" data-lenis-prevent-wheel>
          {frames.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setLightbox(i)}
              className="relative w-[88vw] shrink-0 snap-center overflow-hidden bg-bg-2"
              style={{ aspectRatio: '4 / 5' }}
              aria-label={`Open image ${i + 1} of ${frames.length}`}
              data-flip-target={i === 0 ? 'product-hero' : undefined}
              data-flip-slug={i === 0 ? product.slug : undefined}
            >
              <Img id={id} sizes="88vw" priority={i === 0} plain />
            </button>
          ))}
          <div className="w-gutter shrink-0" />
        </div>
        <div className="mt-4 flex items-center gap-2 px-gutter">
          {frames.map((id, i) => (
            <span key={id} className={i === 0 ? 'hairline h-px w-8' : 'rule h-px w-8'} />
          ))}
        </div>
      </div>

      <Dialog open={lightbox !== null} onClose={() => setLightbox(null)} label={`${product.editorialTitle} — image`} variant="sheet" className="h-dvh">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-gutter pt-6">
            <p className="micro text-fg-2">{product.editorialTitle}</p>
            <button type="button" onClick={() => setLightbox(null)} className="eyebrow text-fg">
              Close
            </button>
          </div>
          <div className="no-scrollbar flex flex-1 snap-x snap-mandatory items-center overflow-x-auto" data-lenis-prevent>
            {frames.map((id) => (
              <div key={id} className="relative h-full w-full shrink-0 snap-center" style={{ touchAction: 'pinch-zoom pan-x' }}>
                <Img id={id} sizes="100vw" className="object-contain" plain style={{ objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
