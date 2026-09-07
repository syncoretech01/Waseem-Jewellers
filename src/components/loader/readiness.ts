'use client';

/**
 * What the loading ritual waits for: fonts, and the hero's first frame (or its poster),
 * reported by the hero itself. Each is a one-shot promise with a bounded fallback.
 */
let heroResolve: (() => void) | null = null;
let heroDone = false;
const heroPromise = new Promise<void>((resolve) => {
  heroResolve = resolve;
});

export function markHeroReady() {
  if (heroDone) return;
  heroDone = true;
  heroResolve?.();
}

export function heroReady(timeoutMs = 2500) {
  return Promise.race([heroPromise, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

export function fontsReady(timeoutMs = 1800) {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  return Promise.race([document.fonts.ready.then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
