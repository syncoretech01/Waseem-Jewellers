'use client';

import { useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { requestConcierge } from '../bridge';
import { Orb } from '../orb/Orb';
import { CONCIERGE } from '../copy';
import { EASE } from '@/lib/motion/easings';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/cn';

/** The same two transitions the controller makes on hover, without the controller. */
function hover(on: boolean) {
  const s = useConciergeStore.getState();
  if (on && s.state === 'IDLE') s.transition('HOVER', 'pointer');
  else if (!on && s.state === 'HOVER') s.transition('IDLE', 'pointer');
}

const FIELD = 'input, textarea, select, [contenteditable="true"]';
const PHONE_QUERY = '(max-width: 767px)';

/**
 * Whether a form field has the keyboard. On a phone the keyboard rises over the corner the
 * crest sits in, and a crest floating over a field the visitor is typing into is a thing in
 * the way; it steps out until the field is left.
 */
function useFieldFocused(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('focusin', onChange);
      document.addEventListener('focusout', onChange);
      return () => {
        document.removeEventListener('focusin', onChange);
        document.removeEventListener('focusout', onChange);
      };
    },
    () => Boolean(document.activeElement && document.activeElement.matches(FIELD) && !document.activeElement.closest('[data-salon]')),
    () => false,
  );
}

/**
 * The chapters on a phone where the corner is spoken for: the window's row of kinds and the
 * gold / diamond gate carry controls at the bottom edge, the footer is the footer, a piece's
 * details and a department's grid put actions there. On these the crest docks — a smaller
 * disc, quieter, the same 48px target — rather than sitting on something.
 */
const DOCKED_SECTIONS = new Set(['vitrine', 'gate', 'footer', 'details', 'pieces']);

/**
 * The persistent trigger: Waseem's crest on a disc, bottom-right. A 48px target everywhere;
 * the disc inside it is 40px on a phone and 56px from the tablet up. It never sits over the
 * salon (the rail covers it; the sheet hides it), the menu, the appointment form, a field the
 * visitor is typing into, or the hero's own invitation — and on a phone it docks over the
 * chapters whose bottom edge is already busy.
 */
export function ConciergeOrb() {
  /**
   * No controller here. The trigger is the one piece of the concierge that is eager — it has
   * to be, it is the door — and importing the controller from it pulled the lexicon, the tools
   * and the providers into every first load. Hover is two lines against the store; a click
   * is a request on the bridge, and whatever is mounted answers it. The hover is also what
   * brings the concierge chunk in early: `ConciergeMount` latches on the first HOVER.
   */
  const state = useConciergeStore((s) => s.state);
  const panel = useConciergeStore((s) => s.panel);
  const invitationVisible = useSiteStore((s) => s.heroInvitationVisible);
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const modalOpen = useSiteStore((s) => s.consultation.open);
  const routeKind = useSiteStore((s) => s.routeKind);
  const section = useSiteStore((s) => s.section);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const phone = useMediaQuery(PHONE_QUERY);
  const fieldFocused = useFieldFocused();
  const open = OPEN_STATES.includes(state);
  // the full panel covers the trigger wherever it is: the rail on a desktop, the sheet on a phone
  const panelFull = open && panel === 'full';
  const visible = !menuOpen && !modalOpen && !invitationVisible && !panelFull && !fieldFocused && (routeKind !== 'home' || loaderDone);
  const docked = phone && !open && section !== null && DOCKED_SECTIONS.has(section);
  const hovered = state === 'HOVER';
  const lastLine = useConciergeStore((s) => {
    for (let i = s.turns.length - 1; i >= 0; i--) {
      const t = s.turns[i];
      if (t?.role === 'concierge' && t.text) return t.text;
    }
    return '';
  });
  // "the associate steps aside": the trigger carries the last line for a moment, on every device
  const compactCaption = open && panel === 'compact' && lastLine;
  const label = `${open ? 'Close' : 'Open'} the ${CONCIERGE.name}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="orb"
          className="wj-crest fixed flex items-center gap-4"
          style={{ zIndex: 'var(--z-concierge)' }}
          data-docked={docked ? '1' : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.8, ease: EASE.out } }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <AnimatePresence>
            {hovered && !open && !docked && (
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
          {/* focus is the house outline (globals.css): a second hairline 4px outside the disc's own */}
          <button
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            data-cursor="ask"
            data-concierge-orb
            onPointerEnter={() => hover(true)}
            onPointerLeave={() => hover(false)}
            onFocus={() => hover(true)}
            onBlur={() => hover(false)}
            onClick={() => {
              if (open && panel === 'compact') requestConcierge({ action: 'expand' });
              else if (open) requestConcierge({ action: 'close' });
              else requestConcierge({ action: 'open', mode: window.innerWidth < 768 ? 'voice' : 'chat' });
            }}
            className={cn('wj-crest-button relative block rounded-full')}
          >
            <Orb state={state} className="wj-crest-orb absolute" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
