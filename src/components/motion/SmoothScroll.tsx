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
    lenis.on('scroll', onScroll);
    return () => {
      gsap.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      if (runtime.lenis === lenis) runtime.lenis = null;
    };
  }, [lenis]);

  return null;
}
