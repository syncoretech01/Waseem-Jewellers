'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { Video } from '@/components/media/Video';
import { Img } from '@/components/media/Img';
import { Eyebrow, UrduAccent } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useFlipTarget } from '@/motion/hooks/useFlipTarget';
import { useQualityStore } from '@/state/qualityStore';
import { COPY } from '@/data/copy';
import type { Collection } from '@/data/types';

interface OpeningProps {
  collection: Collection;
  edit: 'gold' | 'diamond' | null;
  /** Still to show first (a world's hero when arriving from CH04). */
  still: string;
}

/**
 * The route opens inside the portrait mask of CH05 (62vw × 82svh) and expands to full bleed
 * over the first 60vh of scroll while the title stack exits upward — the chapter you just left.
 */
export function CollectionOpening({ collection, edit, still }: OpeningProps) {
  const { ref, ready } = useChapter({ id: 'collection-opening', theme: 'dark', pinned: true });
  const scope = useRef<HTMLDivElement>(null);
  const flipTarget = useFlipTarget<HTMLDivElement>('collection-hero');
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add(
        { desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' },
        (ctx) => {
          const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
          const mask = root.querySelector<HTMLElement>('.opening-mask');
          const frame = root.querySelector<HTMLElement>('.opening-frame');
          const ambient = root.querySelector<HTMLElement>('.opening-ambient');
          const title = root.querySelector<HTMLElement>('.opening-title');
          if (!mask || !frame || !ambient || !title) return;
          if (reduce || reduced) {
            gsap.set(mask, { clipPath: 'inset(0 0 0 0)' });
            gsap.set(frame, { opacity: 0 });
            ready();
            return;
          }
          const inset = mobile ? 'inset(15svh 11vw 15svh 11vw)' : 'inset(9svh 19vw 9svh 19vw)';
          gsap.set(mask, { clipPath: inset });
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: root,
              start: 'top top',
              end: '+=60%',
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          tl.to(mask, { clipPath: 'inset(0 0 0 0)', ease: 'none' }, 0)
            .to(frame, { opacity: 0, ease: 'none', duration: 0.5 }, 0.2)
            .to(ambient, { opacity: 0.55, ease: 'none' }, 0.3)
            .to(title, { y: '-12svh', opacity: 0, ease: 'none', duration: 0.6 }, 0);
          ready();
        },
      );
    },
    { scope, dependencies: [reduced] },
  );

  const word = edit === 'gold' ? COPY.duality.gold.word : edit === 'diamond' ? COPY.duality.diamond.word : null;

  return (
    <section ref={ref} data-theme="dark" className="relative bg-ink text-ivory" aria-label={`${collection.name} — opening`}>
      <div ref={scope} className="relative h-svh overflow-hidden">
        <div className="opening-mask absolute inset-0 grain vignette" style={{ clipPath: 'inset(9svh 19vw 9svh 19vw)' }}>
          <div ref={flipTarget} className="absolute inset-0" data-flip-target="collection-hero">
            <Img id={still} sizes="100vw" priority plain />
          </div>
          {collection.opening.video && (
            <div className="absolute inset-0">
              <Video id={collection.opening.video} preload="metadata" />
            </div>
          )}
          <div className="opening-ambient absolute inset-0 bg-ink opacity-0" />
        </div>
        <div aria-hidden className="opening-frame pointer-events-none absolute inset-0" style={{ inset: 'calc(9svh - 24px) calc(19vw - 24px)' }}>
          <div className="absolute inset-0 border border-champagne/40" />
        </div>
        <div className="opening-title absolute inset-x-0 bottom-[12svh] flex flex-col items-center gap-5 px-gutter text-center">
          <Eyebrow className="justify-center">{COPY.bridal.eyebrow}</Eyebrow>
          {word ? (
            <>
              <h1 className="display text-display-xl" style={{ fontVariationSettings: '"opsz" 96, "wght" 560' }}>
                {word}
              </h1>
              <p className="font-display italic text-lead text-fg-2" style={{ fontVariationSettings: '"opsz" 24' }}>
                {edit === 'gold' ? COPY.duality.landing.gold : COPY.duality.landing.diamond}
              </p>
            </>
          ) : (
            <>
              <h1 className="display text-display-xl">
                {collection.name}
                <UrduAccent text={collection.urdu} className="ml-4 text-[0.25em]" />
              </h1>
              <p className="font-display italic text-lead text-fg-2" style={{ fontVariationSettings: '"opsz" 24' }}>
                {collection.tagline}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
