'use client';

import { useEffect } from 'react';
import { ConciergePanel } from './ConciergePanel';
import { ResultTray } from './ResultTray';
import { useController } from '../useConcierge';
import { onConciergeRequest, type ConciergeRequest } from '../bridge';
import { useSiteStore } from '@/state/siteStore';
import { OPEN_STATES, useConciergeStore, type ConciergeState } from '@/state/conciergeStore';

const STATES: ConciergeState[] = ['IDLE', 'HOVER', 'OPENING', 'CHAT', 'VOICE_READY', 'LISTENING', 'THINKING', 'SPEAKING', 'EXECUTING_ACTION', 'RESULT', 'ERROR'];

/**
 * The salon: the panel, the tray, the controller, and the bridge that lets any page ask for it.
 *
 * Not mounted with the page. `ConciergeMount` puts it in the tree on the first request or on
 * idle after the ritual, whichever comes first, so the lexicon, the tools and the providers
 * hydrate off the critical path. A request that arrived before this mounted is handed in as
 * `pending` and answered as soon as the controller exists.
 */
export function ConciergeRoot({ pending }: { pending?: ConciergeRequest | null } = {}) {
  const controller = useController();
  const pathname = useSiteStore((s) => s.pathname);

  useEffect(() => {
    if (!controller) return;
    const handle = (req: ConciergeRequest) => {
      const action = req.action ?? 'open';
      if (action === 'close') return controller.close();
      if (action === 'expand') return controller.expand();
      if (action === 'toggle' && OPEN_STATES.includes(useConciergeStore.getState().state)) return controller.close();
      if (req.product) useSiteStore.getState().setFocusedProduct(req.product);
      controller.open({ mode: req.mode ?? 'chat', submit: req.submit, prefill: req.prefill, autoListen: req.autoListen, example: req.example });
    };
    if (pending) handle(pending);
    return onConciergeRequest(handle);
  }, [controller, pending]);

  // a route change while a turn is in flight keeps the panel; the tray closes
  useEffect(() => {
    controller?.dismissTray();
  }, [pathname, controller]);

  return (
    <>
      <DevPreview />
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
