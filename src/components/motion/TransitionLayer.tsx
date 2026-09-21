'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { TransitionController } from '@/lib/motion/transition';
import { runtime } from '@/state/runtime';
import { gsap } from '@/lib/motion/gsap';
import { useSiteStore } from '@/state/siteStore';

/**
 * Fixed curtain, veil and FLIP host. Publishes the transition controller to the runtime
 * registry. The `data-*` names are the contract `scripts/dev/flip-check.mjs` reads: the
 * layer, its veil and curtain, and any `[data-flip-clone]` the controller puts in the host.
 */
export function TransitionLayer() {
  const curtain = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const flipLayer = useRef<HTMLDivElement>(null);
  const controller = useRef<TransitionController | null>(null);
  const pathname = useSiteStore((s) => s.pathname);
  const navEpoch = useSiteStore((s) => s.navEpoch);
  const lastPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!curtain.current || !veil.current || !flipLayer.current) return;
    // GSAP is the only writer of the curtain's transform (see MOTION_SYSTEM.md). Hidden while
    // no flight runs: a fixed viewport-sized layer translated off screen is otherwise held as a
    // rasterised texture on every page, for nothing
    gsap.set(curtain.current, { yPercent: 100, visibility: 'hidden' });
    const c = new TransitionController();
    c.attach({ curtain: curtain.current, veil: veil.current, flipLayer: flipLayer.current });
    controller.current = c;
    runtime.transition = c;
    return () => {
      c.detach();
      if (runtime.transition === c) runtime.transition = null;
      controller.current = null;
    };
  }, []);

  // Route changes that did not go through navigate() get the reveal half only.
  useEffect(() => {
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      controller.current?.arrivePlain(pathname);
    }
  }, [pathname, navEpoch]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-transition)' }} data-transition-layer>
      <div ref={veil} className="absolute inset-0 bg-ink opacity-0" data-veil />
      <div ref={flipLayer} className="absolute inset-0" data-flip-host />
      <div ref={curtain} className="absolute inset-0 bg-ink" data-curtain>
        <div className="hairline absolute inset-x-0 top-0" />
        <div className="absolute inset-x-0 top-px h-[6vh] bg-gradient-to-b from-champagne/15 to-transparent" />
      </div>
    </div>
  );
}
