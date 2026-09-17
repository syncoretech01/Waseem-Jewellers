'use client';

import { useCallback } from 'react';
import { runtime, type FlipKey } from '@/state/runtime';
import { useSiteStore } from '@/state/siteStore';
import { findFlipSource } from '@/lib/motion/transition';

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

/** `/jewellery/<slug>` → the slug, for doors that name a piece without carrying its photograph. */
export function productSlugOf(href: string): string | null {
  const m = /^\/jewellery\/([^/?#]+)/.exec(href);
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * Records the opened product for the concierge and back-link logic, and flies its photograph
 * into the piece's page: the one the door was opened from, or — for a door that is only words,
 * a name beneath a tile or a credit beside a frame — the piece's image wherever it is on screen.
 */
export function useOpenProduct() {
  const go = useFlipNavigate();
  const setLast = useSiteStore((s) => s.setLastOpenedProduct);
  return useCallback(
    (slug: string, sourceEl?: HTMLElement | null) => {
      setLast(slug);
      go(`/jewellery/${slug}`, sourceEl ?? findFlipSource(slug), 'product-hero');
    },
    [go, setLast],
  );
}
