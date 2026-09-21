'use client';

import { useEffect } from 'react';
import { useLenis } from 'lenis/react';
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { runtime } from '@/state/runtime';

/**
 * One RAF for the whole DOM layer: gsap.ticker drives lenis.raf (milliseconds),
 * Lenis notifies ScrollTrigger on every smoothed scroll. No second loop anywhere.
 */
export function SmoothScroll() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    runtime.lenis = lenis;
    const tick = (time: number) => lenis.raf(time * 1000);
    const onScroll = () => ScrollTrigger.update();
    gsap.ticker.add(tick);
    // Lenis tells ScrollTrigger about the scroll only where Lenis drives it. On a coarse
    // pointer the page scrolls natively and ScrollTrigger's own document listener already
    // sees every scroll event; bridging it too updated every trigger twice per event, and the
    // second read paid a forced style recalculation.
    const bridge = !document.documentElement.hasAttribute('data-coarse');
    if (bridge) lenis.on('scroll', onScroll);
    return () => {
      gsap.ticker.remove(tick);
      if (bridge) lenis.off('scroll', onScroll);
      if (runtime.lenis === lenis) runtime.lenis = null;
    };
  }, [lenis]);

  return null;
}
