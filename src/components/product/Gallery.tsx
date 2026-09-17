'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Img } from '@/components/media/Img';
import { resolveImage } from '@/data';
import { InspectImage } from './InspectImage';
import { useMaskReveal } from '@/motion/hooks/useReveals';
import { useFlipTarget } from '@/motion/hooks/useFlipTarget';
import { nameOf } from '@/data/labels';
import { scrollTo } from '@/state/runtime';
import { useSiteStore } from '@/state/siteStore';
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

  /**
   * The concierge's hand on the gallery: "the second photograph."
   *
   * The page publishes how many frames this piece has, and answers a frame request from the
   * store by bringing that frame into view — the stacked frame on a wide screen, the snap
   * position on a phone. Nothing else about the gallery changes; the request is cleared once
   * it has been acted on so it cannot replay on the next piece.
   */
  const setGallery = useSiteStore((s) => s.setGallery);
  const slug = product.slug;
  const count = frames.length;
  useEffect(() => {
    setGallery({ slug, count, index: 0 });
    const show = (req: { slug: string; index: number } | null) => {
      const root = scope.current;
      if (!req || req.slug !== slug || !root) return;
      const index = Math.min(Math.max(0, req.index), count - 1);
      if (window.matchMedia('(min-width: 768px)').matches) {
        const frame = root.querySelector<HTMLElement>('[data-frames]')?.querySelectorAll<HTMLElement>('[data-frame]')[index];
        if (frame) scrollTo(frame, { offset: -Math.max(0, (window.innerHeight - frame.getBoundingClientRect().height) / 2), duration: 1.2 });
      } else {
        const track = root.querySelector<HTMLElement>('[data-track]');
        const frame = track?.querySelectorAll<HTMLElement>('[data-frame]')[index];
        if (track && frame) {
          const left = frame.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
          track.scrollTo({ left: left - (track.clientWidth - frame.clientWidth) / 2, behavior: 'smooth' });
        }
      }
      setGallery({ slug, count, index });
      useSiteStore.getState().clearGalleryRequest();
    };
    show(useSiteStore.getState().galleryRequest);
    const off = useSiteStore.subscribe((s, prev) => {
      if (s.galleryRequest !== prev.galleryRequest) show(s.galleryRequest);
    });
    return () => {
      off();
      setGallery(null);
    };
  }, [slug, count, setGallery]);

  const sizes =
    mode === 'single'
      ? '(min-width: 1024px) 64rem, 100vw'
      : mode === 'studio'
        ? '(min-width: 1280px) 31vw, (min-width: 768px) 28vw, 100vw'
        : '(min-width: 1280px) 62vw, (min-width: 768px) 55vw, 100vw';

  return (
    <div ref={scope}>
      {/* desktop / tablet */}
      <div className={cn('hidden md:grid md:gap-6', mode === 'studio' ? 'md:grid-cols-2' : 'md:grid-cols-1')} data-frames>
        {frames.map((img, i) => (
          <div key={`${img.order}-${i}`} ref={i === 0 ? flipTarget : undefined} data-reveal={i === 0 ? undefined : 'bottom'} data-frame={i} className="relative">
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
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pl-gutter" data-lenis-prevent-wheel data-track>
          {frames.map((img, i) => (
            <button
              key={`${img.order}-${i}`}
              type="button"
              onClick={() => setLightbox(i)}
              className="relative w-[88vw] shrink-0 snap-center overflow-hidden bg-bg-2"
              style={{ aspectRatio: '4 / 5' }}
              aria-label={`Open image ${i + 1} of ${frames.length}`}
              data-frame={i}
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
