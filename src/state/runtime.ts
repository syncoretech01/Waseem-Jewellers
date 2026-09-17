/**
 * Imperative handles that must never live in Zustand (non-serialisable, hot).
 * Set once by RuntimeBridge / SmoothScroll / TransitionLayer; read by tools and chapters.
 */
import type Lenis from 'lenis';
import { useQualityStore } from './qualityStore';

export type FlipKey = 'collection-hero' | 'product-hero';

export interface NavigateOptions {
  kind?: 'curtain' | 'flip' | 'veil';
  sourceEl?: HTMLElement | null;
  flipKey?: FlipKey;
}

export interface TransitionHandle {
  navigate(href: string, opts?: NavigateOptions): Promise<void>;
  ready(flipKey?: FlipKey, targetEl?: HTMLElement | null): void;
  whenReady(): Promise<void>;
  readonly inFlight: { href: string; kind: string; flipKey?: FlipKey; epoch: number } | null;
}

export interface RouterHandle {
  push(href: string, opts?: { scroll?: boolean }): void;
  replace(href: string, opts?: { scroll?: boolean }): void;
  prefetch(href: string): void;
  back(): void;
}

export const runtime: {
  lenis: Lenis | null;
  transition: TransitionHandle | null;
  router: RouterHandle | null;
} = {
  lenis: null,
  transition: null,
  router: null,
};

export interface ScrollToOptions {
  offset?: number;
  duration?: number;
  immediate?: boolean;
  lock?: boolean;
  easing?: (t: number) => number;
  onComplete?: () => void;
}

const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * The only sanctioned way to scroll programmatically. Forces past Lenis' stopped
 * state and collapses to an immediate jump under reduced motion.
 */
export function scrollTo(target: number | string | HTMLElement, opts: ScrollToOptions = {}) {
  const reduced = useQualityStore.getState().tier === 'REDUCED';
  const lenis = runtime.lenis;
  if (lenis) {
    // measure the page as it is now, not as the previous route left it: a glide to a chapter
    // straight after a route change would otherwise be clamped to the old page's length
    lenis.resize();
    lenis.scrollTo(target, {
      offset: opts.offset ?? 0,
      duration: opts.duration ?? 1.4,
      immediate: reduced || opts.immediate ? true : undefined,
      lock: opts.lock,
      easing: opts.easing ?? quartOut,
      force: true,
      onComplete: opts.onComplete,
    });
    return;
  }
  const el =
    typeof target === 'string'
      ? document.querySelector<HTMLElement>(target)
      : typeof target === 'number'
        ? null
        : target;
  if (el) el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  opts.onComplete?.();
}

let settledUntil = 0;

/** After a back/forward or deep-link arrival at a saved position, in-view reveals land composed rather than replaying. */
export function markSettledArrival(ms = 2500) {
  settledUntil = performance.now() + ms;
}
export function isSettledArrival() {
  return performance.now() < settledUntil;
}

export function currentScroll() {
  return runtime.lenis?.scroll ?? window.scrollY;
}

export function stopScroll() {
  runtime.lenis?.stop();
}

export function startScroll() {
  runtime.lenis?.start();
}
