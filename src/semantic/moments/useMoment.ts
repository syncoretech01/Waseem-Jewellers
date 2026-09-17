'use client';

import { useImperativeHandle, useRef, useState, type Ref, type RefObject } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/motion/gsap';

/**
 * What every moment shares: one paused timeline, built once against the moment's own DOM,
 * and exactly one thing driving its playhead. Left alone, the moment reads as it travels
 * through the viewport — a scrubbed ScrollTrigger, no pin, no height, so it cannot fight a
 * pinned chapter or a product page's sticky column. A chapter that owns its own scrub passes
 * `driven` and calls `apply(progress)` on the handle instead.
 *
 * Reduced motion is read from the media query, through `gsap.matchMedia`, so it agrees with
 * every other GSAP decision on the page. Under it no timeline is built and the moment renders
 * its still form — the photograph and the words, with nothing to scrub.
 */

export interface MomentHandle {
  /** Progress through the moment's beats, 0–1. Only meaningful when `driven`. */
  apply: (progress: number) => void;
}

export function useMoment(
  root: RefObject<HTMLElement | null>,
  build: (tl: gsap.core.Timeline, root: HTMLElement) => void,
  { driven = false, ref, dependencies = [] }: { driven?: boolean; ref?: Ref<MomentHandle>; dependencies?: unknown[] },
) {
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [still, setStill] = useState<boolean | null>(null);

  useImperativeHandle(ref, () => ({ apply: (p: number) => tlRef.current?.progress(Math.max(0, Math.min(1, p))) }), []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { reduce } = ctx.conditions as { reduce: boolean };
        setStill(reduce);
        if (reduce) return;
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
        build(tl, el);
        tlRef.current = tl;
        if (driven) {
          return () => {
            tlRef.current = null;
            tl.kill();
          };
        }
        /**
         * A moment is a child of its chapter, and React runs a child's effects before the
         * parent's — so this trigger exists before the chapter's pin does. ScrollTrigger
         * refreshes triggers in creation order unless one of them names a refreshPriority,
         * and a trigger measured before a preceding pin has re-applied its spacer lands a
         * whole pin early (the craft coda did, by 155svh). Naming a priority turns on
         * ScrollTrigger's sort, which refreshes every trigger in document order; the low
         * priority also keeps the moment after its chapter whatever the order of creation.
         */
        const st = ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          end: 'bottom 15%',
          scrub: 0.5,
          refreshPriority: -1,
          invalidateOnRefresh: true,
          onUpdate: (self) => tl.progress(self.progress),
        });
        return () => {
          st.kill();
          tlRef.current = null;
          tl.kill();
        };
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [driven, ...dependencies] },
  );

  return { still: still ?? false };
}
