'use client';

import { useEffect } from 'react';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo } from '@/state/runtime';
import { sectionElement, sectionsReady } from '@/state/sections';
import { Ch01Hero } from './chapters/Ch01Hero';
import { Ch02Kinds } from './chapters/Ch02Kinds';
import { Ch02Craft } from './chapters/Ch02Craft';
import { Ch02Bangle } from './chapters/Ch02Bangle';
import { Ch03Gate } from './chapters/Ch03Gate';
import { Ch06Goldwork } from './chapters/Ch06Goldwork';
import { Ch05Light } from './chapters/Ch05Light';
import { Ch04Worlds } from './chapters/Ch04Worlds';
import { Ch09Bespoke } from './chapters/Ch09Bespoke';
import { Arrive } from '@/components/motion/Arrive';
import { lazyChapter } from '@/components/motion/LazyChapter';

/**
 * The chapters that do not pin are server-rendered in full and hydrated on approach, so the
 * loading ritual is not spent running five chapters' effects for a visitor who is reading the
 * hero. A pinned chapter inserts its spacer on mount, so those hydrate with the page.
 */
const Ch03Gold = lazyChapter('gold', () => import('./chapters/Ch03Gold').then((m) => m.Ch03Gold));
const Ch04Diamond = lazyChapter('diamond', () => import('./chapters/Ch04Diamond').then((m) => m.Ch04Diamond));
const Ch05Bridal = lazyChapter('bridal', () => import('./chapters/Ch05Bridal').then((m) => m.Ch05Bridal));
const Ch07MenKids = lazyChapter('menkids', () => import('./chapters/Ch07MenKids').then((m) => m.Ch07MenKids));
const Ch03Heritage = lazyChapter('heritage', () => import('./chapters/Ch03Heritage').then((m) => m.Ch03Heritage));

import type { Department } from '@/data/types';
import type { PieceRow, Showcase } from '@/lib/facets';

/**
 * The homepage: eleven chapters in one continuous scroll, in the order a shop is walked —
 * the name over the door, the window, the craft, then the departments one after another
 * (gold, diamond, bridal), the campaigns, men and kids, the history and the showrooms, the
 * bespoke room, and the concierge. Dark and ivory alternate so the chapters read as rooms.
 * The loading ritual (CH00) lives in Providers and the footer sits fixed beneath the page root.
 */
export function Home({ showcase, departments, doors }: { showcase: Showcase; departments: { department: Department; count: number }[]; doors: Record<string, PieceRow> }) {
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

  const dept = (d: Department) => showcase.departments.find((x) => x.department === d);

  return (
    <main id="home">
      <Arrive />
      <Ch01Hero departments={departments} />
      <Ch02Kinds kinds={showcase.categories} />
      <Ch02Craft />
      <Ch02Bangle piece={doors['gold-bangles-k13798']} />
      <Ch03Gate goldPiece={doors['aks-e-noor-satlada-haar']} diamondPiece={doors['diamond-bridal-sapphire-suite']} />
      <Ch03Gold department={dept('gold')} figure={doors['gold-bridal-set-2']} />
      <Ch06Goldwork piece={doors['aks-e-noor-satlada-haar']} />
      <Ch04Diamond department={dept('diamond')} />
      <Ch05Light suite={doors['diamond-bridal-sapphire-suite']} />
      <Ch05Bridal suite={doors['rang-e-jamal-emerald-suite']} choker={doors['naqsh-e-gul-pearl-blossom-choker']} />
      <Ch04Worlds doors={doors} />
      <Ch07MenKids men={dept('men')} kids={dept('kids')} />
      <Ch03Heritage />
      <Ch09Bespoke pair={doors['emerald-tassel-earrings-t06768']} />
    </main>
  );
}
