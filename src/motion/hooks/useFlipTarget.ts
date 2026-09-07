'use client';

import { useLayoutEffect, useRef } from 'react';
import { runtime, type FlipKey } from '@/state/runtime';

/**
 * Destination side of a FLIP: once the hero image is decoded, tell the transition layer
 * where to land. Falls back to `ready()` without a target after a short timeout.
 */
export function useFlipTarget<T extends HTMLElement = HTMLElement>(key: FlipKey) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const t = runtime.transition;
    if (!t) return;
    if (!t.inFlight) return;
    if (!el) {
      t.ready(key, null);
      return;
    }
    const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      t.ready(key, el);
    };
    if (img && t.inFlight.kind === 'flip') {
      img.style.visibility = 'hidden';
      const timeout = window.setTimeout(finish, 1600);
      (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)).then(() => {
        window.clearTimeout(timeout);
        finish();
      });
      return () => {
        window.clearTimeout(timeout);
        img.style.visibility = '';
      };
    }
    finish();
    return undefined;
  }, [key]);
  return ref;
}

/** Non-FLIP destinations (home, 404) call this once mounted so the curtain lifts. */
export function useArrive() {
  useLayoutEffect(() => {
    const t = runtime.transition;
    if (t?.inFlight && t.inFlight.kind !== 'flip') t.ready();
    else if (t?.inFlight) t.ready(t.inFlight.flipKey, null);
  }, []);
}
