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
    return m.Observer;
  });
  return observerPromise;
}
