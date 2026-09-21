'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@/components/ui/Dialog';
import { Img } from '@/components/media/Img';
import { resolveImage } from '@/data';
import { InspectImage } from './InspectImage';
import { useMaskReveal } from '@/motion/hooks/useReveals';
import { useFlipTarget } from '@/motion/hooks/useFlipTarget';
import { nameOf } from '@/data/labels';
import { pad2 } from '@/lib/format';
import { scrollTo } from '@/state/runtime';
import { useSiteStore } from '@/state/siteStore';
import type { PdpMode } from './pdpMode';
import type { Product, ProductImage } from '@/data/types';
import { cn } from '@/lib/cn';

/**
 * Which slide of a horizontal snap track is showing, reported only when it changes.
 *
 * One IntersectionObserver rooted on the track itself, one entry per `[data-frame]` slide:
 * the slide with the largest visible share wins, the earlier one on a tie. The browser
 * computes the shares in its own rendering step, so no scroll event is listened to, no
 * `scrollLeft` or `offsetLeft` is ever read, and a vertical scroll of the page — which never
 * moves the track's content — costs the indicator nothing at all.
 */
function watchSlides(track: HTMLElement | null, onChange: (index: number) => void): (() => void) | undefined {
  if (!track) return undefined;
  const slides = [...track.querySelectorAll<HTMLElement>('[data-frame]')];
  if (slides.length < 2) return undefined;
  const shares = new Map<Element, number>();
  let current = -1;
  const io = new IntersectionObserver(
    (records) => {
      for (const r of records) shares.set(r.target, r.intersectionRatio);
      let best = -1;
      let bestShare = -1;
      slides.forEach((s, i) => {
        const share = shares.get(s) ?? 0;
        if (share > bestShare) {
          bestShare = share;
          best = i;
        }
      });
      if (best !== -1 && best !== current) {
        current = best;
        onChange(best);
      }
    },
    { root: track, threshold: [0.25, 0.5, 0.75, 1] },
  );
  for (const s of slides) io.observe(s);
  return () => io.disconnect();
}

/**
 * Desktop: frames arranged for what they are. Phone: one hero, or a snap track, then a lightbox.
 *
 *   campaign  stacked, full width — a scene deserves the whole column
 *   studio    two abreast, because two stacked pearl plates is mostly pearl
 *   single    one frame, as large as the page allows
 *
 * On a phone a piece with one photograph is given one frame, the width of the page inside its
 * gutters, and never a track: a carousel of one reads as a gallery missing its other slides.
 * A piece with two or three keeps the swipe, each slide aligned to the gutter with the next
 * one showing at the edge, and a live indicator beneath.
 */
export function Gallery({ product, mode = 'campaign' }: { product: Product; mode?: PdpMode }) {
  const scope = useRef<HTMLDivElement>(null);
  /**
   * The FLIP lands on whichever opening frame is displayed — the desktop plate or the phone's
   * hero or first slide — so the target is found inside the gallery rather than pinned to one
   * layout. The slug re-arms it when this instance is reused for a related piece.
   */
  const flipTargetRef = useFlipTarget<HTMLDivElement>('product-hero', product.slug);
  const [lightbox, setLightbox] = useState<number | null>(null);
  /**
   * The sheet is rendered at the body, not here: a dialog inside #page-root sits beneath the
   * fixed nav and the orb (the page root is its own stacking context), and it goes inert with
   * the page it is meant to cover — a Close button nobody could press. It mounts on the first
   * tap and stays for its exit animation; the server never renders it.
   */
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTrack = useRef<HTMLDivElement>(null);
  const frames = product.media.gallery;
  const single = mode === 'single' || frames.length <= 1;
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
        if (frame)
          scrollTo(frame, {
            offset: -Math.max(0, (window.innerHeight - frame.getBoundingClientRect().height) / 2),
            duration: 1.2,
          });
      } else {
        const track = root.querySelector<HTMLElement>('[data-track]');
        const slides = track?.querySelectorAll<HTMLElement>('[data-frame]');
        const first = slides?.[0];
        const frame = slides?.[index];
        // the snap positions are the slides' offsets from the first, which sits at the gutter
        if (track && first && frame)
          track.scrollTo({
            left: frame.offsetLeft - first.offsetLeft,
            behavior: 'smooth',
          });
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

  // a new piece in the same instance starts at its first frame
  const [shownSlug, setShownSlug] = useState(slug);
  if (shownSlug !== slug) {
    setShownSlug(slug);
    setActive(0);
  }

  /**
   * The indicator follows the track, not the other way round: the slide most in view is the
   * one showing. The track is watched by an IntersectionObserver rooted on itself — one
   * callback when a slide crosses a quarter of its width, no `offsetLeft` or `scrollLeft`
   * read on any scroll event, and nothing at all while the page scrolls vertically — and the
   * store learns the index so the concierge can say which photograph is in view.
   */
  const track = useRef<HTMLDivElement>(null);
  const onSlide = useCallback(
    (index: number) => {
      setActive(index);
      setGallery({ slug, count, index });
    },
    [slug, count, setGallery],
  );
  useEffect(() => watchSlides(track.current, onSlide), [onSlide, single]);

  /** The ground behind a frame, as the desktop mounts it: pearl under a cut-out, the warm plate under a scene. */
  const plateOf = (img: ProductImage) =>
    resolveImage(img.ref, undefined, img.role === 'campaign' ? 'campaign' : img.role === 'macro' ? 'macro' : 'packshot').role === 'packshot' ? 'bg-pearl' : 'bg-bg-2';

  const sizes =
    mode === 'single'
      ? '(min-width: 1024px) 64rem, 100vw'
      : mode === 'studio'
        ? '(min-width: 1280px) 31vw, (min-width: 768px) 28vw, 100vw'
        : '(min-width: 1280px) 62vw, (min-width: 768px) 55vw, 100vw';

  const open = (i: number) => {
    setSheet(true);
    setLightboxIndex(i);
    setLightbox(i);
  };
  // the sheet opens on the photograph that was tapped, not always the first
  useEffect(() => {
    const el = lightboxTrack.current;
    if (lightbox !== null && el) el.scrollLeft = lightbox * el.clientWidth;
  }, [lightbox]);
  // and its count follows the swipe the same way the page's indicator does
  useEffect(() => (lightbox === null ? undefined : watchSlides(lightboxTrack.current, setLightboxIndex)), [lightbox]);

  return (
    <div
      ref={(el) => {
        scope.current = el;
        flipTargetRef.current = el;
      }}
      data-gallery={single ? 'single' : 'track'}
    >
      {/* desktop / tablet */}
      <div className={cn('hidden md:grid md:gap-6', mode === 'studio' ? 'md:grid-cols-2' : 'md:grid-cols-1')} data-frames>
        {frames.map((img, i) => (
          <div key={`${img.order}-${i}`} data-reveal={i === 0 ? undefined : 'bottom'} data-frame={i} className="relative">
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

      {/* phone */}
      <div className="md:hidden">
        {single ? (
          /**
           * One photograph, one frame: the width of the page inside its gutters, 4:5, the
           * aspect box reserved before the image arrives so nothing beneath it moves. The
           * first frame is the page's largest paint, so it loads first and eagerly.
           */
          <div className="px-gutter">
            <button
              type="button"
              onClick={() => open(0)}
              className={cn('relative block w-full overflow-hidden', frames[0] ? plateOf(frames[0]) : 'bg-bg-2')}
              style={{ aspectRatio: '4 / 5' }}
              aria-label={`Open the photograph of ${nameOf(product)}`}
              data-frame={0}
              data-flip-target="product-hero"
              data-flip-slug={product.slug}
            >
              {frames[0] && <Img image={frames[0]} sizes={sizes} priority plain />}
            </button>
          </div>
        ) : (
          <>
            {/*
              Each slide is the page's width less the gutter and a 40px edge — the gap and a
              sliver of the next photograph, which is how the visitor learns there is one. The
              track's scroll padding aligns every snapped slide to the gutter, and the spacer
              after the last one lets it align there too.

              The swipe is the platform's: CSS snap points, the horizontal overscroll contained
              so the last slide never hands the gesture to the browser's own back swipe, and
              `touch-action: pan-x pan-y` so the compositor owns both axes from the first pixel
              of the gesture. Not `pan-x` alone — the photograph is most of the first screen,
              and a thumb landing on it must still be able to scroll the page.
            */}
            <div ref={track} className="no-scrollbar -my-1.5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y py-1.5 pl-gutter scroll-pl-gutter" data-lenis-prevent-wheel data-track>
              {frames.map((img, i) => (
                <button
                  key={`${img.order}-${i}`}
                  type="button"
                  onClick={() => open(i)}
                  className={cn('relative w-[calc(100vw-var(--spacing-gutter)-2.5rem)] shrink-0 snap-start overflow-hidden', plateOf(img))}
                  style={{ aspectRatio: '4 / 5' }}
                  aria-label={`Open photograph ${i + 1} of ${frames.length}`}
                  data-frame={i}
                  data-flip-target={i === 0 ? 'product-hero' : undefined}
                  data-flip-slug={i === 0 ? product.slug : undefined}
                >
                  <Img image={img} sizes={sizes} priority={i === 0} plain />
                </button>
              ))}
              <div className="w-7 shrink-0" aria-hidden />
            </div>
            {/* which photograph is showing: one gold hairline among the rules, and the count */}
            <div className="mt-4 flex items-center justify-between px-gutter" data-indicator>
              <div className="flex items-center gap-2" aria-hidden>
                {frames.map((img, i) => (
                  <span key={`${img.order}-${i}`} className="rule relative w-7">
                    <span className={cn('hairline absolute inset-0 transition-opacity duration-500 ease-[var(--ease-silk)]', i === active ? 'opacity-100' : 'opacity-0')} />
                  </span>
                ))}
              </div>
              <p className="micro text-fg-muted" aria-live="polite">
                <span className="sr-only">Photograph </span>
                {pad2(active + 1)}
                <span className="mx-1 opacity-60">/</span>
                {pad2(frames.length)}
              </p>
            </div>
          </>
        )}
      </div>

      {sheet &&
        createPortal(
          <Dialog open={lightbox !== null} onClose={() => setLightbox(null)} label={`${nameOf(product)} — photographs`} variant="sheet" className="h-dvh">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-6 px-gutter pt-[calc(1.5rem+var(--safe-top))]">
                <p className="micro truncate text-fg-2">{nameOf(product)}</p>
                <div className="flex shrink-0 items-center gap-6">
                  {frames.length > 1 && (
                    <p className="micro text-fg-muted" aria-live="polite">
                      <span className="sr-only">Photograph </span>
                      {pad2(lightboxIndex + 1)}
                      <span className="mx-1 opacity-60">/</span>
                      {pad2(frames.length)}
                    </p>
                  )}
                  <button type="button" onClick={() => setLightbox(null)} className="eyebrow py-2 text-fg transition-colors hover:text-accent" data-cursor="close">
                    Close
                  </button>
                </div>
              </div>
              <div ref={lightboxTrack} className="no-scrollbar flex flex-1 snap-x snap-mandatory items-center overflow-x-auto overscroll-x-contain" data-lenis-prevent>
                {frames.map((img, i) => (
                  <div key={`${img.order}-${i}`} className="relative h-full w-full shrink-0 snap-center" style={{ touchAction: 'pinch-zoom pan-x' }} data-frame={i}>
                    <Img image={img} sizes="100vw" className="object-contain" plain style={{ objectFit: 'contain' }} />
                  </div>
                ))}
              </div>
            </div>
          </Dialog>,
          document.body,
        )}
    </div>
  );
}
