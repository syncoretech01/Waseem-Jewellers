'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSiteStore, type SiteState } from '@/state/siteStore';
import { useIdleAfter, useLatch } from '@/lib/useLatch';

/**
 * Chrome that is on every route and visible on none of them until asked.
 *
 * The menu, the selection ledger and the consultation form all mount closed and open on an
 * interaction — and all three hydrated with the page, on every route, ahead of the content the
 * visitor came for. They are pulled in here on idle after the ritual, so they are ready before
 * they are wanted, or at once when their store flag flips first, so nothing a visitor opens is
 * ever missing. Off the critical path is the aim; never-loaded is not.
 *
 * The cursor layer is stricter: it is only for a fine pointer, and a touch device never pays
 * for it at all.
 */
const MenuOverlay = dynamic(() => import('./MenuOverlay').then((m) => m.MenuOverlay), { ssr: false });
const SelectionLedger = dynamic(() => import('@/components/commerce/SelectionLedger').then((m) => m.SelectionLedger), { ssr: false });
const ConsultationModal = dynamic(() => import('@/components/commerce/ConsultationModal').then((m) => m.ConsultationModal), { ssr: false });
const CursorLayer = dynamic(() => import('@/components/motion/CursorLayer').then((m) => m.CursorLayer), { ssr: false });

const wanted = (s: SiteState) => s.menuOpen || s.ledgerOpen || s.consultation.open;
const pastTheRitual = (s: SiteState) => s.routeKind !== 'home' || s.loaderDone;

export function LazyChrome() {
  const asked = useLatch(useSiteStore, wanted);
  const idle = useIdleAfter(useLatch(useSiteStore, pastTheRitual));
  const ready = asked || idle;

  const [fine, setFine] = useState(false);
  useEffect(() => {
    // pointer:fine is the whole question; the cursor layer is decoration for a mouse
    const mq = window.matchMedia('(pointer: fine)');
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener('change', onChange);
    // the initial answer, delivered the same way the changes are
    onChange({ matches: mq.matches } as MediaQueryListEvent);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      {ready && (
        <>
          <MenuOverlay />
          <SelectionLedger />
          <ConsultationModal />
        </>
      )}
      {ready && fine && <CursorLayer />}
    </>
  );
}
