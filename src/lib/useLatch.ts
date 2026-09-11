'use client';

import { useEffect, useState } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * True once a store has ever satisfied a predicate, and true from then on.
 *
 * Chrome that opens on interaction — the menu, the ledger, the salon — must not be *unmounted*
 * when it closes, or its exit animation dies with it. So "should this be in the tree" is not
 * "is it open" but "has it ever been wanted", which is a latch. Set from the store's own
 * subscription, an event callback, rather than from an effect watching a hook value: React
 * flags a synchronous `setState` inside an effect as a cascading render, and it is right to.
 */
export function useLatch<S>(store: UseBoundStore<StoreApi<S>>, when: (s: S) => boolean): boolean {
  const [latched, setLatched] = useState(() => (typeof window === 'undefined' ? false : when(store.getState())));
  useEffect(() => {
    if (latched) return;
    return store.subscribe((s) => {
      if (when(s)) setLatched(true);
    });
  }, [store, when, latched]);
  return latched;
}

/** True after a quiet moment following `armed` becoming true — or a generous timeout if the browser offers none. */
export function useIdleAfter(armed: boolean): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (idle || !armed) return;
    const w = window as Window & { requestIdleCallback?: typeof requestIdleCallback; cancelIdleCallback?: typeof cancelIdleCallback };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout: 4000 });
      return () => w.cancelIdleCallback!(id);
    }
    const id = w.setTimeout(() => setIdle(true), 1500);
    return () => w.clearTimeout(id);
  }, [idle, armed]);
  return idle;
}
