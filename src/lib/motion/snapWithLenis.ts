'use client';

import { runtime } from '@/state/runtime';
import { expoOut } from './easings';

let locked = false;
let unlockTimer = 0;

/** True while a programmatic snap is travelling; pointer/wheel handlers should stand back. */
export function snapLocked() {
  return locked;
}

/**
 * Settles the page to `target` (px) through Lenis so ScrollTrigger stays the source of truth.
 * Snap targets always win over an in-flight snap.
 */
export function snapWithLenis(target: number, opts: { duration?: number; easing?: (t: number) => number; onComplete?: () => void } = {}) {
  const lenis = runtime.lenis;
  const duration = opts.duration ?? 0.7;
  window.clearTimeout(unlockTimer);
  locked = true;
  const release = () => {
    locked = false;
    opts.onComplete?.();
  };
  if (!lenis) {
    window.scrollTo({ top: target, behavior: 'auto' });
    release();
    return;
  }
  lenis.scrollTo(target, {
    duration,
    easing: opts.easing ?? expoOut,
    force: true,
    lock: true,
    onComplete: release,
  });
  unlockTimer = window.setTimeout(release, duration * 1000 + 120);
}
