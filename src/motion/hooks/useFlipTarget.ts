'use client';

import { useLayoutEffect, useRef } from 'react';
import { runtime, type FlipKey } from '@/state/runtime';

/** The frame the clone lands on: the scope itself when it is the target, else the first descendant target that is laid out (the phone track and the desktop grid both carry one; only one is displayed). */
function visibleTarget(scope: HTMLElement, key: FlipKey): HTMLElement | null {
  const sel = `[data-flip-target="${key}"]`;
  const candidates = [...(scope.matches(sel) ? [scope] : []), ...scope.querySelectorAll<HTMLElement>(sel)];
  return candidates.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

/**
 * Destination side of a FLIP. Put the ref on the frame itself or on a scope that contains
 * `[data-flip-target=key]`; once laid out, the hook hides the frame's image and tells the
 * transition layer where to land. The layer measures the frame, glides the clone to it,
 * shows the image and fades the clone from over it. `dep` re-runs the report when the same
 * page instance is reused for another slug (a related piece opened from a piece).
 */
export function useFlipTarget<T extends HTMLElement = HTMLElement>(key: FlipKey, dep?: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const t = runtime.transition;
    if (!t?.inFlight) return;
    const scope = ref.current;
    const el = scope ? visibleTarget(scope, key) : null;
    if (!el) {
      t.ready(key, null);
      return;
    }
    const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null;
    const flying = t.inFlight.kind === 'flip' && img !== null;
    if (flying) img.style.visibility = 'hidden';
    t.ready(key, el);
    if (!flying) return;
    // the layer shows the image as the clone lands; this is the net beneath — a flight that
    // ends any other way (forced, superseded, no clone) must not leave the hero invisible
    let live = true;
    void t
      .whenReady()
      .catch(() => undefined)
      .finally(() => {
        if (live) img.style.visibility = '';
      });
    return () => {
      live = false;
      img.style.visibility = '';
    };
  }, [key, dep]);
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
