'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { requestConcierge } from '../bridge';
import { OrbStatic } from '../orb/OrbStatic';
import { preloadOrbCanvas } from '../orb/Orb';
import { CONCIERGE } from '../copy';
import { EASE } from '@/lib/motion/easings';
import { useMediaQuery, RAIL_QUERY } from '@/lib/useMediaQuery';

/** The same two transitions the controller makes on hover, without the controller. */
function hover(on: boolean) {
  const s = useConciergeStore.getState();
  if (on && s.state === 'IDLE') s.transition('HOVER', 'pointer');
  else if (!on && s.state === 'HOVER') s.transition('IDLE', 'pointer');
}

/** The persistent jewel: 56px CSS gem, bottom-right; the rail opens beside it, and covers it. */
export function ConciergeOrb() {
  /**
   * No controller here. The orb is the one piece of the concierge that is eager — it has to
   * be, it is the door — and importing the controller from it pulled the lexicon, the tools
   * and the providers into every first load. Hover is two lines against the store; a click
   * is a request on the bridge, and whatever is mounted answers it.
   */
  const state = useConciergeStore((s) => s.state);
  const panel = useConciergeStore((s) => s.panel);
  const invitationVisible = useSiteStore((s) => s.heroInvitationVisible);
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const ledgerOpen = useSiteStore((s) => s.ledgerOpen);
  const modalOpen = useSiteStore((s) => s.consultation.open);
  const routeKind = useSiteStore((s) => s.routeKind);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const isXl = useMediaQuery(RAIL_QUERY);
  const open = OPEN_STATES.includes(state);
  // the desktop rail runs the full height of the page and sits where the jewel sits; it takes over
  const railOpen = open && panel === 'full' && isXl;
  const visible = !menuOpen && !ledgerOpen && !modalOpen && !invitationVisible && !railOpen && (routeKind !== 'home' || loaderDone);
  const hovered = state === 'HOVER';
  const lastLine = useConciergeStore((s) => {
    for (let i = s.turns.length - 1; i >= 0; i--) {
      const t = s.turns[i];
      if (t?.role === 'concierge' && t.text) return t.text;
    }
    return '';
  });
  // "the associate steps aside": the jewel carries the last line for a moment, on every device
  const compactCaption = open && panel === 'compact' && lastLine;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="orb"
          className="fixed bottom-6 right-6 flex items-center gap-4 md:bottom-7 md:right-7"
          style={{ zIndex: 'var(--z-concierge)' }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE.out } }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}
        >
          <AnimatePresence>
            {hovered && !open && (
              <motion.span
                key="caption"
                className="micro pointer-events-none text-fg"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE.out } }}
                exit={{ opacity: 0, x: 6, transition: { duration: 0.2 } }}
              >
                {CONCIERGE.name}
              </motion.span>
            )}
            {compactCaption && (
              <motion.button
                key={`ticket-${lastLine.slice(0, 24)}`}
                type="button"
                onClick={() => requestConcierge({ action: 'expand' })}
                className="line-clamp-2 max-w-[62vw] text-left font-display text-[1rem] leading-snug text-fg md:max-w-[26rem]"
                style={{ fontVariationSettings: '"opsz" 16' }}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: [0, 1, 1, 0.55], x: 0, transition: { duration: 6, times: [0, 0.08, 0.7, 1], ease: 'linear' } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                aria-label="Return to the concierge"
                data-cursor="ask"
              >
                {lastLine}
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            aria-label={open ? 'Close the Waseem Concierge' : 'Open the Waseem Concierge'}
            aria-haspopup="dialog"
            aria-expanded={open}
            data-cursor="ask"
            onPointerEnter={() => {
              hover(true);
              preloadOrbCanvas();
            }}
            onPointerLeave={() => hover(false)}
            onFocus={() => hover(true)}
            onBlur={() => hover(false)}
            onClick={() => {
              if (open && panel === 'compact') requestConcierge({ action: 'expand' });
              else if (open) requestConcierge({ action: 'close' });
              else requestConcierge({ action: 'open', mode: window.innerWidth < 768 ? 'voice' : 'chat' });
            }}
            className="relative block h-14 w-14 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] md:h-14 md:w-14"
          >
            <OrbStatic state={state === 'IDLE' || state === 'HOVER' ? state : open ? 'CHAT' : state} size={56} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
