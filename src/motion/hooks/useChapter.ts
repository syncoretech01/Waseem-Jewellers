'use client';

import { useCallback, useEffect, useRef } from 'react';
import { markSectionReady, registerSection, type SectionTheme } from '@/state/sections';
import type { SectionId } from '@/state/siteStore';

interface ChapterOptions {
  id: SectionId;
  theme: SectionTheme;
  /** Pinned chapters must call `ready()` once their pin ScrollTrigger exists. */
  pinned?: boolean;
}

/**
 * Registers a chapter / page section with the section registry (current section,
 * theme mirroring, readiness for scroll restoration) and returns the section ref.
 */
export function useChapter({ id, theme, pinned = false }: ChapterOptions) {
  const ref = useRef<HTMLElement>(null);
  const unregister = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    unregister.current = registerSection(el, id, theme, pinned);
    return () => {
      unregister.current?.();
      unregister.current = null;
    };
  }, [id, theme, pinned]);

  const ready = useCallback(() => {
    if (ref.current) markSectionReady(ref.current);
  }, []);

  return { ref, ready };
}
