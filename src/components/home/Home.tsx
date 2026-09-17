'use client';

import { useEffect } from 'react';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo } from '@/state/runtime';
import { sectionElement, sectionsReady } from '@/state/sections';
import { Ch01Hero } from './chapters/Ch01Hero';
import { Ch02Kinds } from './chapters/Ch02Kinds';
import { Ch02Craft } from './chapters/Ch02Craft';
import { Ch03Gate } from './chapters/Ch03Gate';
import { Ch03Gold } from './chapters/Ch03Gold';
import { Ch04Diamond } from './chapters/Ch04Diamond';
import { Ch05Bridal } from './chapters/Ch05Bridal';
import { Ch04Worlds } from './chapters/Ch04Worlds';
import { Ch07MenKids } from './chapters/Ch07MenKids';
import { Ch03Heritage } from './chapters/Ch03Heritage';
import { Ch09Bespoke } from './chapters/Ch09Bespoke';
import { Ch10Invitation } from './chapters/Ch10Invitation';
import { Arrive } from '@/components/motion/Arrive';

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
      <Ch01Hero credit={doors['royal-wedding-polki-raani-haar']} departments={departments} />
      <Ch02Kinds kinds={showcase.categories} />
      <Ch02Craft coda={doors['lavender-halo-ring-r11912']} />
      <Ch03Gate goldPiece={doors['aks-e-noor-satlada-haar']} diamondPiece={doors['diamond-bridal-sapphire-suite']} />
      <Ch03Gold department={dept('gold')} figure={doors['gold-bridal-set-2']} />
      <Ch04Diamond department={dept('diamond')} suite={doors['diamond-bridal-sapphire-suite']} />
      <Ch05Bridal suite={doors['rang-e-jamal-emerald-suite']} choker={doors['naqsh-e-gul-pearl-blossom-choker']} />
      <Ch04Worlds doors={doors} />
      <Ch07MenKids men={dept('men')} kids={dept('kids')} />
      <Ch03Heritage />
      <Ch09Bespoke pair={doors['emerald-tassel-earrings-t06768']} />
      <Ch10Invitation />
    </main>
  );
}
