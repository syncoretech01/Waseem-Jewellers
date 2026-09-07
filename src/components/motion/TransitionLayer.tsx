'use client';

import { useEffect, useRef } from 'react';
import { TransitionController } from '@/lib/motion/transition';
import { loadFlip } from '@/lib/motion/lazyPlugins';
import { runtime } from '@/state/runtime';
import { useSiteStore } from '@/state/siteStore';

/** Fixed curtain, veil and FLIP host. Publishes the transition controller to the runtime registry. */
export function TransitionLayer() {
  const curtain = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const flipLayer = useRef<HTMLDivElement>(null);
  const controller = useRef<TransitionController | null>(null);
  const pathname = useSiteStore((s) => s.pathname);
  const navEpoch = useSiteStore((s) => s.navEpoch);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!curtain.current || !veil.current || !flipLayer.current) return;
    const c = new TransitionController();
    c.attach({ curtain: curtain.current, veil: veil.current, flipLayer: flipLayer.current });
    controller.current = c;
    runtime.transition = c;
    const idle = window.setTimeout(() => void loadFlip(), 1500);
    return () => {
      window.clearTimeout(idle);
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
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-transition)' }}>
      <div ref={veil} className="absolute inset-0 bg-ink opacity-0" />
      <div ref={flipLayer} className="absolute inset-0" />
      <div ref={curtain} className="absolute inset-0 translate-y-full bg-ink">
        <div className="hairline absolute inset-x-0 top-0" />
        <div className="absolute inset-x-0 top-px h-[6vh] bg-gradient-to-b from-champagne/15 to-transparent" />
      </div>
    </div>
  );
}
