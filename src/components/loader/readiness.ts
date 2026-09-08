'use client';

/**
 * What the loading ritual waits for: fonts, and the hero's first painted frame — its still if
 * the film is still arriving. Each is a one-shot promise with a short, bounded fallback, so a
 * slow film never holds the visitor in front of the wordmark.
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

export function heroReady(timeoutMs = 1500) {
  return Promise.race([heroPromise, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

export function fontsReady(timeoutMs = 900) {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  // The ritual draws one face. Waiting on document.fonts.ready waits on every face the page will
  // ever want — Nastaliq included — and holds the visitor in front of the wordmark for no gain.
  const word = document.querySelector<HTMLElement>('.ritual-word');
  const family = word ? getComputedStyle(word).fontFamily.split(',')[0]!.trim() : '';
  const wanted = family
    ? document.fonts.load(`600 96px ${family}`).then(() => undefined, () => undefined)
    : document.fonts.ready.then(() => undefined);
  return Promise.race([wanted, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
