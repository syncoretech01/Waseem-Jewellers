'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import { ReactLenis } from 'lenis/react';
import { MotionConfig } from 'motion/react';
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { TransitionLayer } from '@/components/motion/TransitionLayer';
import { Loader } from '@/components/loader/Loader';
import { Nav } from '@/components/chrome/Nav';
import { Footer } from '@/components/chrome/Footer';
import { LazyChrome } from '@/components/chrome/LazyChrome';
import { ConciergeMount } from '@/concierge/ui/ConciergeMount';
import { QualityDetector, RouteTracker, RuntimeBridge, StoreHydrator } from '@/state/trackers';
import { installDevInspector } from '@/lib/devInspector';

/**
 * Provider order matters:
 *  1. quality is resolved before any canvas can mount,
 *  2. GSAP is configured before Lenis is ticked by it,
 *  3. Lenis wraps the page; SmoothScroll wires gsap.ticker → lenis.raf → ScrollTrigger.update,
 *  4. persistent chrome (nav, menu, concierge, transition layer) mounts once, outside the routed tree —
 *     and what is invisible until an interaction (the menu, the ledger, the consultation form, the
 *     salon behind the orb, the cursor) hydrates on idle after the ritual rather than with the page.
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    history.scrollRestoration = 'manual';
    ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });
    ScrollTrigger.clearScrollMemory('manual');
    gsap.ticker.lagSmoothing(0);
    installDevInspector();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ReactLenis root options={{ autoRaf: false, lerp: 0.09, smoothWheel: true, syncTouch: false }}>
        <QualityDetector />
        <SmoothScroll />
        <RuntimeBridge />
        <Suspense fallback={null}>
          <RouteTracker />
        </Suspense>
        <StoreHydrator />
        <div id="page-root">{children}</div>
        <Footer />
        <TransitionLayer />
        <Nav />
        <ConciergeMount />
        <LazyChrome />
        <Loader />
      </ReactLenis>
    </MotionConfig>
  );
}
