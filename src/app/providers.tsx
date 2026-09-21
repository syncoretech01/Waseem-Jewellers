'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Lenis, { type LenisOptions, type ScrollCallback } from 'lenis';
import { LenisContext, type LenisContextValue } from 'lenis/react';
import { MotionConfig } from 'motion/react';
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { TransitionLayer } from '@/components/motion/TransitionLayer';
import { Loader } from '@/components/loader/Loader';
import { Nav } from '@/components/chrome/Nav';
import { Footer } from '@/components/chrome/Footer';
import { LazyChrome } from '@/components/chrome/LazyChrome';
import { ConciergeMount } from '@/concierge/ui/ConciergeMount';
import { QualityDetector, RouteTracker, RuntimeBridge, StorageSweeper } from '@/state/trackers';
import { TierResolver } from '@/lib/perf/TierResolver';
import { installDevInspector } from '@/lib/devInspector';

/**
 * Whether the page's scroll is owned by the finger rather than by Lenis.
 *
 * Lenis attaches `touchstart`, `touchmove`, `touchend` and `wheel` listeners to the window
 * with `passive: false` — it has to, to smooth a wheel — and a non-passive touch listener is
 * scroll-blocking: on every touch event the compositor waits for the main thread before it
 * may move the page, so a 120 ms decode or a chapter's setup becomes 120 ms in which the
 * visitor's thumb is dragging and nothing moves. With `syncTouch` off those listeners did
 * nothing on a phone but cost that wait. On a coarse pointer Lenis is therefore given an
 * element that receives no events at all as its `eventsTarget`: it keeps following the native
 * scroll (its `scroll` listener on the window, and the events the nav and the tray subscribe
 * to), `scrollTo()`, `stop()` and `start()` keep working, and the finger scrolls the page the
 * way the platform does. Decided from the pre-hydration `data-coarse` stamp, once, before any
 * effect runs. `?scroll=lenis` puts the listeners back in development, for comparison.
 */
function touchOwnsScroll(): boolean {
  if (typeof document === 'undefined') return false;
  if (process.env.NODE_ENV === 'development') {
    const forced = new URLSearchParams(window.location.search).get('scroll');
    if (forced === 'lenis') return false;
    if (forced === 'native') return true;
  }
  return document.documentElement.hasAttribute('data-coarse');
}

/** One Lenis for the document, created on the client's first render and never replaced. */
let lenisInstance: Lenis | null = null;

/**
 * `lenis/react`'s provider, rewritten so its context value never changes after the first
 * client render. `ReactLenis` creates its instance in an effect and publishes it through a new
 * context object, which is fine for a page that hydrates in one pass and fatal for one that
 * hydrates in parts: a Suspense boundary still waiting for its chapter is *client-rendered*
 * — server DOM dropped, fallback shown — the moment any context above it changes. Here the
 * instance exists before hydration and the value is memoised on it, so the chapters below
 * see one context for the life of the page. `useLenis` from `lenis/react` reads this same
 * context, so the nav and the tray subscribe as before.
 */
function LenisProvider({ options, children }: { options: LenisOptions; children: ReactNode }) {
  const [lenis] = useState(() => {
    if (typeof window === 'undefined') return null;
    lenisInstance ??= new Lenis(options);
    return lenisInstance;
  });
  const callbacks = useRef<{ callback: ScrollCallback; priority: number }[]>([]);
  const value = useMemo<LenisContextValue | null>(
    () =>
      lenis
        ? {
            lenis,
            addCallback: (callback, priority) => {
              callbacks.current.push({ callback, priority });
              callbacks.current.sort((a, b) => a.priority - b.priority);
            },
            removeCallback: (callback) => {
              callbacks.current = callbacks.current.filter((c) => c.callback !== callback);
            },
          }
        : null,
    [lenis],
  );
  useEffect(() => {
    if (!lenis) return;
    const onScroll = (data: Lenis) => {
      for (const { callback } of callbacks.current) callback(data);
    };
    lenis.on('scroll', onScroll);
    return () => {
      lenis.off('scroll', onScroll);
    };
  }, [lenis]);
  return <LenisContext.Provider value={value}>{children}</LenisContext.Provider>;
}

/**
 * Provider order matters:
 *  1. quality is resolved before any canvas can mount — `TierResolver` does it in the first
 *     layout effect of the page, before any chapter's,
 *  2. GSAP is configured before Lenis is ticked by it,
 *  3. Lenis wraps the page; SmoothScroll wires gsap.ticker → lenis.raf → ScrollTrigger.update,
 *  4. persistent chrome (nav, menu, concierge, transition layer) mounts once, outside the routed tree —
 *     and what is invisible until an interaction (the menu, the consultation form, the
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

  const lenisOptions = useMemo<LenisOptions>(() => {
    const base: LenisOptions = {
      autoRaf: false,
      lerp: 0.09,
      smoothWheel: true,
      syncTouch: false,
    };
    if (!touchOwnsScroll()) return base;
    return {
      ...base,
      smoothWheel: false,
      eventsTarget: document.createElement('div'),
    };
  }, []);
  useEffect(() => {
    if (lenisOptions.eventsTarget) document.documentElement.setAttribute('data-scroll', 'native');
  }, [lenisOptions]);

  return (
    <MotionConfig reducedMotion="user">
      <LenisProvider options={lenisOptions}>
        <TierResolver />
        <QualityDetector />
        <SmoothScroll />
        <RuntimeBridge />
        <Suspense fallback={null}>
          <RouteTracker />
        </Suspense>
        <StorageSweeper />
        {/*
          The nav and the orb are position:fixed, so where they sit in the DOM changes nothing
          visually and everything for the keyboard: after the page and the footer, a visitor
          on a department page pressed Tab twenty-eight times to reach the menu that had been
          at the top of their screen the whole time.
        */}
        <a href="#page-root" className="skip-link">
          Skip to content
        </a>
        {/*
          The chrome takes the theme of the chapter beneath the viewport centre. It is written
          to these two wrappers (src/state/sections.ts), never to <html>: a root-level theme
          change re-propagates inherited tokens to every node on the page, which was the
          65 ms style recalculation at every chapter boundary. `contents` gives the wrappers
          no box of their own, so the fixed chrome inside them is laid out exactly as before.
        */}
        <div data-chrome data-theme="dark" className="contents">
          <Nav />
          <ConciergeMount />
        </div>
        <div id="page-root" tabIndex={-1}>
          {children}
        </div>
        <Footer />
        <div data-chrome data-theme="dark" className="contents">
          <TransitionLayer />
          <LazyChrome />
          <Loader />
        </div>
      </LenisProvider>
    </MotionConfig>
  );
}
