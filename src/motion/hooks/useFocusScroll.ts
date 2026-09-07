'use client';

import { useEffect, type RefObject } from 'react';
import { scrollTo } from '@/state/runtime';

/**
 * Keyboard focus inside a pinned chapter: when a focused control sits outside the viewport
 * (or beneath the pin's scroll range), glide the page so it is visible. Pinned chapters map
 * their controls to scroll positions through `positionFor`; unpinned ones fall back to the element.
 */
export function useFocusScroll(scope: RefObject<HTMLElement | null>, positionFor?: (el: HTMLElement) => number | null) {
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      const pos = positionFor?.(el);
      if (typeof pos === 'number') {
        scrollTo(pos, { duration: 0.8 });
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) scrollTo(el, { offset: -Math.round(window.innerHeight / 3), duration: 0.8 });
    };
    root.addEventListener('focusin', onFocus);
    return () => root.removeEventListener('focusin', onFocus);
  }, [scope, positionFor]);
}
