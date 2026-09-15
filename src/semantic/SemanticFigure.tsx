'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { gsap, useGSAP, ScrollTrigger } from '@/lib/motion/gsap';
import { Img } from '@/components/media/Img';
import { resolveImage } from '@/data';
import { useQualityStore } from '@/state/qualityStore';
import { beatsFor, DEFAULT_DISPLAY_PX, honestScale, resolveFigure } from './resolve';
import { StaticSequence } from './ui/StaticSequence';
import type { SemanticDescriptor } from './types';
import { cn } from '@/lib/cn';

/**
 * The host every semantic family runs inside.
 *
 * **One writer, structurally.** The outer box owns nothing but its own size. The inner
 * wrapper's `transform` belongs exclusively to this component's ticker callback, which
 * composes one string per frame rather than layering `quickTo`s — so there is never a second
 * property fighting it. Labels are lit with a `data-lit` attribute and animated by CSS
 * transitions, and GSAP never touches them. No Tailwind `translate` or `scale` utility
 * appears on the camera element, which is the shipped bug this codebase already paid for
 * once.
 *
 * Fidelity is resolved from `gsap.matchMedia`'s `reduce` condition — the media query, not the
 * quality store. How close the camera goes is decided per region against the box's real
 * rendered width, so no region is ever magnified past its own pixels.
 *
 * Two ways to drive it. Left alone, the figure reads as it travels through the viewport —
 * no pin, no height, nothing that can fight a product page's sticky column. A pinned chapter
 * that owns its own timeline passes `driven` and calls `apply(progress)` on the handle from
 * its scrub, so the figure's beats sit inside the chapter's choreography.
 */

export interface SemanticFigureHandle {
  /** Progress through the figure's beats, 0–1. Only meaningful when `driven`. */
  apply: (progress: number) => void;
}

interface SemanticFigureProps {
  descriptor: SemanticDescriptor;
  /** Rendered when the figure cannot be supported: the caller's ordinary image. */
  fallback: React.ReactNode;
  className?: string;
  sizes: string;
  /** The chapter drives progress itself; no ScrollTrigger is created. */
  driven?: boolean;
  ref?: Ref<SemanticFigureHandle>;
  /** Mirror the lit region outside the figure — a chapter's own words, lit in step. */
  onLit?: (key: string | null) => void;
  /** `inside` writes each region's note over the photograph; `none` leaves that to the caller. */
  captions?: 'inside' | 'none';
  /** Eager decode for a figure that is the first thing on its screen. */
  eager?: boolean;
  /**
   * The slug this figure is a door to. The photograph is then a bare `<img>` carrying the
   * FLIP source attribute, so opening the piece flies from the figure itself.
   */
  flipSource?: string;
}

export function SemanticFigure({ descriptor, fallback, className, sizes, driven = false, ref, onLit, captions = 'inside', eager, flipSource }: SemanticFigureProps) {
  const asset = resolveImage(descriptor.image);
  const modest = useQualityStore((s) => s.tier === 'LOW' || s.coarse);
  const box = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const applyRef = useRef<((p: number) => void) | null>(null);
  const litRef = useRef(onLit);
  const [lit, setLit] = useState<string | null>(null);

  // measured once, from the media query rather than the store, so it agrees with GSAP
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    litRef.current = onLit;
  }, [onLit]);

  useImperativeHandle(ref, () => ({ apply: (p: number) => applyRef.current?.(p) }), []);

  const resolved = resolveFigure({
    descriptor,
    sourceWidth: asset.width,
    sourceHeight: asset.height,
    reducedMotion: reducedMotion ?? false,
    modest,
  });

  useGSAP(
    () => {
      const root = box.current;
      const cam = camera.current;
      if (!root || !cam) return;
      const mm = gsap.matchMedia();

      mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { reduce } = ctx.conditions as { reduce: boolean };
        setReducedMotion(reduce);
        if (reduce || !resolved.supported) return;

        const beats = beatsFor(resolved.regions);
        const magnify = resolved.fidelity === 'full';
        const state = { x: 0, y: 0, scale: 1 };
        // one composed transform per frame — never two setters on one element
        const write = () => {
          cam.style.transform = `translate3d(${state.x.toFixed(3)}%, ${state.y.toFixed(3)}%, 0) scale(${state.scale.toFixed(4)})`;
        };
        const light = (key: string | null) => {
          setLit(key);
          litRef.current?.(key);
        };

        let lastKey: string | null = null;
        const apply = (progress: number) => {
          const p = Math.max(0, Math.min(1, progress));
          const beat = beats.find((b) => p >= b.at && p < b.until) ?? beats[beats.length - 1]!;
          const key = beat.region?.key ?? null;
          if (key === lastKey) return;
          lastKey = key;
          light(key);
          if (!beat.region) {
            gsap.to(state, { x: 0, y: 0, scale: 1, duration: 0.9, ease: 'wj.out', overwrite: true, onUpdate: write });
            return;
          }
          const [rx, ry, rw, rh] = beat.region.rect;
          /**
           * How close: as far as the region fills the box, but never past the point where
           * its source pixels are spread thinner than the screen's — measured against the
           * box as it is actually rendered, now, not a size assumed at build time.
           */
          const displayPx = root.clientWidth || DEFAULT_DISPLAY_PX;
          const honest = honestScale(beat.region, asset.width, displayPx);
          const scale = magnify ? honest : Math.min(1.35, honest);
          // the region's centre, expressed as a translation of the frame behind a fixed box
          const cx = rx + rw / 2;
          const cy = ry + rh / 2;
          gsap.to(state, {
            x: (0.5 - cx) * 100,
            y: (0.5 - cy) * 100,
            scale,
            duration: 1.1,
            ease: 'wj.out',
            overwrite: true,
            onUpdate: write,
          });
        };
        applyRef.current = apply;
        write();

        if (driven) {
          return () => {
            applyRef.current = null;
            gsap.killTweensOf(state);
          };
        }

        /**
         * No pin. The figure reads as the square travels through the viewport, which costs
         * the page no extra height and — more to the point — cannot fight the product
         * page's sticky information column, where two pinned things would each believe they
         * owned the scroll.
         */
        const st = ScrollTrigger.create({
          trigger: root,
          start: 'top 85%',
          end: 'bottom 15%',
          scrub: 0.5,
          invalidateOnRefresh: true,
          onUpdate: (self) => apply(self.progress),
        });
        return () => {
          st.kill();
          applyRef.current = null;
          gsap.killTweensOf(state);
        };
      });

      return () => mm.revert();
    },
    { scope: box, dependencies: [resolved.supported, resolved.fidelity, resolved.regions.length, driven] },
  );

  // nothing to teach with: the caller's own image, unadorned
  if (!resolved.supported) return <>{fallback}</>;
  if (reducedMotion || resolved.fidelity === 'static') {
    return <StaticSequence descriptor={descriptor} regions={resolved.regions} sizes={sizes} className={className} />;
  }

  return (
    <div ref={box} className={cn('relative w-full overflow-hidden bg-bg-2', className)} style={{ aspectRatio: '1 / 1' }} data-figure={descriptor.family} data-lit-region={lit ?? ''}>
      {/* the camera: this element's transform has exactly one writer */}
      <div ref={camera} className="absolute inset-0 will-change-transform">
        <Img image={descriptor.image} sizes={sizes} eager={eager} plain={Boolean(flipSource)} data={flipSource ? { 'flip-source': flipSource } : undefined} />
      </div>

      {captions === 'inside' && (
        <>
          {/**
           * A scrim, not a text-shadow. These photographs are lit high-key — ivory drape, pale
           * skin — and white type over them is unreadable however hard it is shadowed. It fades
           * in only while a caption is up, so the photograph is unobstructed the rest of the time.
           */}
          <div
            aria-hidden
            data-lit={lit ? '1' : '0'}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 opacity-0 transition-opacity duration-500 data-[lit=1]:opacity-100"
            style={{ background: 'linear-gradient(to top, rgba(11,10,9,0.82), rgba(11,10,9,0.45) 45%, transparent)' }}
          />

          {/* labels are lit by an attribute and faded by CSS; GSAP never touches them */}
          <div className="pointer-events-none absolute inset-0">
            {resolved.regions.map((r) => (
              <p
                key={r.key}
                data-lit={lit === r.key ? '1' : '0'}
                className="absolute bottom-6 left-6 right-6 max-w-[30em] font-display text-[0.9375rem] leading-snug text-ivory opacity-0 transition-opacity duration-500 data-[lit=1]:opacity-100 md:bottom-8 md:left-8 md:right-8 md:text-[1.0625rem]"
                style={{ fontVariationSettings: '"opsz" 18' }}
              >
                <span className="micro mr-3 text-champagne">{r.label}</span>
                {r.note}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
