'use client';

/**
 * Flip and Observer are only needed by the transition layer and the sliders,
 * so they register on first use. This file and gsap.ts are the only modules
 * allowed to import from 'gsap/*'.
 */
import { gsap } from './gsap';

type FlipModule = typeof import('gsap/Flip');
type ObserverModule = typeof import('gsap/Observer');

let flipPromise: Promise<FlipModule['Flip']> | null = null;
let scrollers: unknown[] | null = null;
let observerPromise: Promise<ObserverModule['Observer']> | null = null;

export function loadFlip() {
  flipPromise ??= import('gsap/Flip').then((m) => {
    gsap.registerPlugin(m.Flip);
    return m.Flip;
  });
  return flipPromise;
}

export function loadObserver() {
  observerPromise ??= import('gsap/Observer').then((m) => {
    gsap.registerPlugin(m.Observer);
    // exported at runtime (Observer.js line 707) and absent from the type declarations
    scrollers = (m as unknown as { _scrollers: unknown[] })._scrollers;
    return m.Observer;
  });
  return observerPromise;
}

/**
 * Kills an Observer and forgets its target — which `kill()` alone does not.
 *
 * Observer caches every target it is ever given in a module-level `_scrollers` array,
 * three slots per element: the element and two scroll closures bound to it. `kill()`
 * disables the observer and removes it from `_observers`, and leaves `_scrollers` exactly as
 * it was. A component that creates an Observer on a fresh element every mount — the vitrine
 * slider, on every visit to the homepage — therefore grows that array by one detached
 * element per visit, and each of those elements retains its whole page: measured at +4,400
 * DOM nodes and +1 MB of heap per visit, with the hero video and its 31 seconds of buffered
 * film kept alive five times over after five visits.
 *
 * This is the only place in the codebase that reaches into that array, and it reaches in
 * only to remove what this project put there.
 */
export function killObserver(observer: { kill: () => void; _dc?: { kill: () => void } } | null, target: Element | null) {
  if (!observer) return;
  observer.kill();
  // the paused delayedCall Observer keeps for its own debounce is the seventh orphan per visit
  observer._dc?.kill();
  if (!scrollers || !target) return;
  const i = scrollers.indexOf(target);
  if (i >= 0) scrollers.splice(i, 3);
}
