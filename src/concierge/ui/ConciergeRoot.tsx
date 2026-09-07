'use client';

import { useEffect } from 'react';
import { ConciergeOrb } from './ConciergeOrb';
import { ConciergePanel } from './ConciergePanel';
import { ResultTray } from './ResultTray';
import { useController } from '../useConcierge';
import { onConciergeRequest } from '../bridge';
import { useSiteStore } from '@/state/siteStore';
import type { ConciergeState } from '@/state/conciergeStore';

const STATES: ConciergeState[] = ['IDLE', 'HOVER', 'OPENING', 'CHAT', 'VOICE_READY', 'LISTENING', 'THINKING', 'SPEAKING', 'EXECUTING_ACTION', 'RESULT', 'ERROR'];

/** Mounted once in Providers: the jewel, the panel, the tray, and the bridge that lets any page ask for the concierge. */
export function ConciergeRoot() {
  const controller = useController();
  const pathname = useSiteStore((s) => s.pathname);

  useEffect(() => {
    if (!controller) return;
    return onConciergeRequest((req) => {
      if (req.product) useSiteStore.getState().setFocusedProduct(req.product);
      controller.open({ mode: req.mode ?? 'chat', submit: req.submit, prefill: req.prefill, autoListen: req.autoListen, example: req.example });
    });
  }, [controller]);

  // a route change while a turn is in flight keeps the panel; the tray closes
  useEffect(() => {
    controller?.dismissTray();
  }, [pathname, controller]);

  return (
    <>
      <DevPreview />
      <ConciergeOrb />
      <ConciergePanel />
      <ResultTray />
    </>
  );
}

/** Development only: `?concierge=LISTENING` forces a state so every visual can be polished. */
function DevPreview() {
  const controller = useController();
  const search = useSiteStore((s) => s.search);
  const wanted = new URLSearchParams(search).get('concierge');
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !controller || !wanted) return;
    const state = wanted.toUpperCase() as ConciergeState;
    if (STATES.includes(state)) {
      const id = window.setTimeout(() => controller.devPreview(state), 800);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [controller, wanted]);
  return null;
}
