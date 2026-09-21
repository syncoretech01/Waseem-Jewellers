/**
 * Imperative handles that must never live in Zustand (non-serialisable, hot).
 * Set once by RuntimeBridge / SmoothScroll / TransitionLayer; read by tools and chapters.
 */
import type Lenis from 'lenis';
import { gsap } from '@/lib/motion/gsap';
import { openAllChapterGates } from '@/lib/perf/chapterGates';
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

/** The page's y for a scroll target, measured now. */
function resolveY(target: number | string | HTMLElement, offset: number): number | null {
  if (typeof target === 'number') return target + offset;
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!el) return null;
  return el.getBoundingClientRect().top + window.scrollY + offset;
}

let glide: gsap.core.Tween | null = null;

/**
 * A programmatic glide without Lenis: one GSAP tween on a proxy, writing `window.scrollTo`
 * each frame, so the page has exactly one writer and the caller gets its `onComplete`.
 * Native `scroll-behavior: smooth` gives neither — it cannot be timed, eased or awaited.
 */
function tweenScroll(y: number, opts: ScrollToOptions, reduced: boolean) {
  glide?.kill();
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const to = Math.max(0, Math.min(max, y));
  if (reduced || opts.immediate) {
    window.scrollTo(0, to);
    opts.onComplete?.();
    return;
  }
  const proxy = { y: window.scrollY };
  glide = gsap.to(proxy, {
    y: to,
    duration: opts.duration ?? 1.4,
    ease: opts.easing ?? quartOut,
    onUpdate: () => window.scrollTo(0, proxy.y),
    onComplete: () => {
      glide = null;
      opts.onComplete?.();
    },
  });
}

/**
 * The only sanctioned way to scroll programmatically. Forces past Lenis' stopped
 * state and collapses to an immediate jump under reduced motion. Before Lenis exists —
 * or should it ever not — the same glide is a GSAP tween owned here.
 */
export function scrollTo(target: number | string | HTMLElement, opts: ScrollToOptions = {}) {
  const reduced = useQualityStore.getState().tier === 'REDUCED';
  // a glide can land anywhere: every lazily hydrated chapter starts hydrating now — except
  // for the jump to the top that every arrival makes, which lands on chapters already live
  if (!(typeof target === 'number' && target <= 0)) openAllChapterGates();
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
  const y = resolveY(target, opts.offset ?? 0);
  if (y === null) {
    opts.onComplete?.();
    return;
  }
  tweenScroll(y, opts, reduced);
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

/**
 * Freeze and release the page. Through Lenis where it exists (its `lenis-stopped` class clips
 * the root's overflow); otherwise the same clip is written here, so an overlay or the loading
 * ritual holds the page still whichever owns the scroll.
 */
export function stopScroll() {
  if (runtime.lenis) {
    runtime.lenis.stop();
    return;
  }
  document.documentElement.style.overflow = 'clip';
}

export function startScroll() {
  if (runtime.lenis) {
    runtime.lenis.start();
    return;
  }
  document.documentElement.style.removeProperty('overflow');
}
