'use client';

import { useEffect } from 'react';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo } from '@/state/runtime';
import { sectionElement, sectionsReady } from '@/state/sections';
import { Ch01Hero } from './chapters/Ch01Hero';
import { Ch02Vitrine } from './chapters/Ch02Vitrine';
import { Ch02Craft } from './chapters/Ch02Craft';
import { Ch03Heritage } from './chapters/Ch03Heritage';
import { Ch04Worlds } from './chapters/Ch04Worlds';
import { Ch05Bridal } from './chapters/Ch05Bridal';
import { Ch06Wall } from './chapters/Ch06Wall';
import { Ch07Slider } from './chapters/Ch07Slider';
import { Ch08Duality } from './chapters/Ch08Duality';
import { Ch09Bespoke } from './chapters/Ch09Bespoke';
import { Arrive } from '@/components/motion/Arrive';
import type { WallCut } from '@/data/repository';
import type { Department } from '@/data/types';
import type { PieceRow } from '@/lib/facets';

/**
 * The homepage: ten chapters in one continuous scroll. The loading ritual (CH00) lives in
 * Providers and the footer (CH10) sits fixed beneath the page root.
 */
export function Home({ wallCuts, departments, vitrine, total }: { wallCuts: WallCut[]; departments: { department: Department; count: number }[]; vitrine: PieceRow[]; total: number }) {
  const setPendingSection = useSiteStore((s) => s.setPendingSection);

  // arriving from the menu or the concierge with a chapter in mind
  useEffect(() => {
    const id = useSiteStore.getState().pendingSection;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      await runtime.transition?.whenReady().catch(() => undefined);
      await Promise.race([sectionsReady(), new Promise((r) => setTimeout(r, 1200))]);
      if (cancelled) return;
      const el = sectionElement(id);
      if (el) scrollTo(el, { duration: 1.6 });
      setPendingSection(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [setPendingSection]);

  return (
    <main id="home">
      <Arrive />
      <Ch01Hero />
      <Ch02Vitrine pieces={vitrine} total={total} />
      <Ch02Craft />
      <Ch03Heritage />
      <Ch04Worlds />
      <Ch05Bridal />
      <Ch06Wall cuts={wallCuts} departments={departments} />
      <Ch07Slider />
      <Ch08Duality />
      <Ch09Bespoke />
    </main>
  );
}
