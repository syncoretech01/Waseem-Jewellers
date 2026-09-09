'use client';

import { useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Img } from '@/components/media/Img';
import { resolveImage } from '@/data';
import { InspectImage } from './InspectImage';
import { useMaskReveal } from '@/motion/hooks/useReveals';
import { useFlipTarget } from '@/motion/hooks/useFlipTarget';
import { nameOf } from '@/data/labels';
import type { PdpMode } from './pdpMode';
import type { Product } from '@/data/types';
import { cn } from '@/lib/cn';

/**
 * Desktop: frames arranged for what they are. Mobile: snap track + lightbox.
 *
 *   campaign  stacked, full width — a scene deserves the whole column
 *   studio    two abreast, because two stacked pearl plates is mostly pearl
 *   single    one frame, as large as the page allows
 */
export function Gallery({ product, mode = 'campaign' }: { product: Product; mode?: PdpMode }) {
  const scope = useRef<HTMLDivElement>(null);
  const flipTarget = useFlipTarget<HTMLDivElement>('product-hero');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const frames = product.media.gallery;
  useMaskReveal(scope, { selector: '[data-reveal]', from: 'bottom' });

  const sizes =
    mode === 'single'
      ? '(min-width: 1024px) 64rem, 100vw'
      : mode === 'studio'
        ? '(min-width: 1280px) 31vw, (min-width: 768px) 28vw, 100vw'
        : '(min-width: 1280px) 62vw, (min-width: 768px) 55vw, 100vw';

  return (
    <div ref={scope}>
      {/* desktop / tablet */}
      <div className={cn('hidden md:grid md:gap-6', mode === 'studio' ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
        {frames.map((img, i) => (
          <div key={`${img.order}-${i}`} ref={i === 0 ? flipTarget : undefined} data-reveal={i === 0 ? undefined : 'bottom'} className="relative">
            <InspectImage
              image={img}
              slug={product.slug}
              sizes={sizes}
              priority={i === 0}
              flipTarget={i === 0}
              // inspect is offered only where the negative can carry it; at 2.4× a 1080px
              // frame shows the visitor the JPEG rather than the jewellery
              macro={img.role === 'macro' || img.role === 'detail' || resolveImage(img.ref).width >= 2000}
              frame={i}
            />
          </div>
        ))}
      </div>

      {/* mobile */}
      <div className="md:hidden">
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pl-gutter" data-lenis-prevent-wheel>
          {frames.map((img, i) => (
            <button
              key={`${img.order}-${i}`}
              type="button"
              onClick={() => setLightbox(i)}
              className="relative w-[88vw] shrink-0 snap-center overflow-hidden bg-bg-2"
              style={{ aspectRatio: '4 / 5' }}
              aria-label={`Open image ${i + 1} of ${frames.length}`}
              data-flip-target={i === 0 ? 'product-hero' : undefined}
              data-flip-slug={i === 0 ? product.slug : undefined}
            >
              <Img image={img} sizes="88vw" plain />
            </button>
          ))}
          <div className="w-gutter shrink-0" />
        </div>
        {/* an indicator for a track of one is furniture, not information */}
        {frames.length > 1 && (
          <div className="mt-4 flex items-center gap-2 px-gutter">
            {frames.map((img, i) => (
              <span key={`${img.order}-${i}`} className={i === 0 ? 'hairline h-px w-8' : 'rule h-px w-8'} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={lightbox !== null} onClose={() => setLightbox(null)} label={`${nameOf(product)} — image`} variant="sheet" className="h-dvh">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-gutter pt-6">
            <p className="micro text-fg-2">{nameOf(product)}</p>
            <button type="button" onClick={() => setLightbox(null)} className="eyebrow text-fg">
              Close
            </button>
          </div>
          <div className="no-scrollbar flex flex-1 snap-x snap-mandatory items-center overflow-x-auto" data-lenis-prevent>
            {frames.map((img, i) => (
              <div key={`${img.order}-${i}`} className="relative h-full w-full shrink-0 snap-center" style={{ touchAction: 'pinch-zoom pan-x' }}>
                <Img image={img} sizes="100vw" className="object-contain" plain style={{ objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
