'use client';

import { useCallback } from 'react';
import { runtime, type FlipKey } from '@/state/runtime';
import { useSiteStore } from '@/state/siteStore';

/**
 * Navigates through the TransitionLayer (FLIP when a source image is given, curtain otherwise),
 * falling back to a plain router push before the layer has mounted.
 */
export function useFlipNavigate() {
  return useCallback((href: string, sourceEl?: HTMLElement | null, flipKey?: FlipKey) => {
    const t = runtime.transition;
    if (t) {
      void t.navigate(href, sourceEl && flipKey ? { kind: 'flip', sourceEl, flipKey } : { kind: 'curtain' });
      return;
    }
    runtime.router?.push(href, { scroll: false });
  }, []);
}

export function navigateTo(href: string, opts?: { kind?: 'curtain' | 'veil' }) {
  const t = runtime.transition;
  if (t) return t.navigate(href, { kind: opts?.kind ?? 'curtain' });
  runtime.router?.push(href, { scroll: false });
  return Promise.resolve();
}

/** Records the opened product for the concierge and back-link logic. */
export function useOpenProduct() {
  const go = useFlipNavigate();
  const setLast = useSiteStore((s) => s.setLastOpenedProduct);
  return useCallback(
    (slug: string, sourceEl?: HTMLElement | null) => {
      setLast(slug);
      go(`/jewellery/${slug}`, sourceEl, 'product-hero');
    },
    [go, setLast],
  );
}
