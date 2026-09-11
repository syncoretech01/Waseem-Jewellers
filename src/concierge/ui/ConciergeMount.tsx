'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ConciergeOrb } from './ConciergeOrb';
import { onConciergeRequest, type ConciergeRequest } from '../bridge';
import { useConciergeStore, type ConciergeState } from '@/state/conciergeStore';
import { useSiteStore, type SiteState } from '@/state/siteStore';
import { useIdleAfter, useLatch } from '@/lib/useLatch';

/**
 * The door is eager; the room behind it is not.
 *
 * Measured on 11 September 2026, every route carried some 65 kB gzipped of concierge — the
 * lexicon, the parser, the tools, the providers, the panel — in its initial script set, hydrated
 * before a visitor could scroll, for a surface nothing on the page shows until it is asked for.
 * The orb is the only part that has to be there at first paint, and it needs nothing but the
 * store and the bridge.
 *
 * The salon mounts on whichever comes first: a request on the bridge (a click on the orb, the
 * ENQUIRE button, a card), a hover on the orb — which is a visitor about to click — or idle
 * after the loading ritual, so the ordinary case still has it ready before it is wanted. A
 * request that arrives before the chunk does is held and handed to the salon as `pending`, so
 * nothing a visitor asked for is lost to the gap.
 */
const ConciergeRoot = dynamic(() => import('./ConciergeRoot').then((m) => m.ConciergeRoot), { ssr: false });

const everHovered = (s: { state: ConciergeState }) => s.state === 'HOVER';
const pastTheRitual = (s: SiteState) => s.routeKind !== 'home' || s.loaderDone;

export function ConciergeMount() {
  // a request before the salon exists is the reason to bring it into existence
  const [pending, setPending] = useState<ConciergeRequest | null>(null);
  useEffect(() => {
    if (pending) return;
    return onConciergeRequest((req) => setPending(req));
  }, [pending]);

  const hovered = useLatch(useConciergeStore, everHovered);
  const idle = useIdleAfter(useLatch(useSiteStore, pastTheRitual));
  const mounted = pending !== null || hovered || idle;

  return (
    <>
      <ConciergeOrb />
      {mounted && <ConciergeRoot pending={pending} />}
    </>
  );
}
