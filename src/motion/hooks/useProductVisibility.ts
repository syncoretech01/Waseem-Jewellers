'use client';

import { useEffect, useRef } from 'react';
import { observeProduct } from '@/state/visibility';
import { useSiteStore } from '@/state/siteStore';

/** Registers a product element so the concierge knows what the visitor can see. */
export function useProductVisibility<T extends HTMLElement = HTMLElement>(slug: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute('data-product', slug);
    return observeProduct(el, slug);
  }, [slug]);
  return ref;
}

/** Marks a product as "focused" (engaged but not opened) on hover ≥ 400ms, focus-visible or tap. */
export function useFocusedProduct(slug: string) {
  const timer = useRef<number | null>(null);
  const setFocused = useSiteStore((s) => s.setFocusedProduct);
  const start = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFocused(slug), 400);
  };
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerEnter: start,
    onPointerLeave: cancel,
    onFocus: () => setFocused(slug),
    onTouchStart: () => setFocused(slug),
  };
}
