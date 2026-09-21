'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLenis } from 'lenis/react';
import { useConciergeStore } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { useMediaQuery, RAIL_QUERY } from '@/lib/useMediaQuery';
import { TrayBody, trayResultOf } from './cards/TrayBody';
import { EASE } from '@/lib/motion/easings';

/**
 * The vitrine: what the associate brought, risen from the bottom of the room as a band the
 * width of the stage. It stops where the rail begins. Below the rail breakpoint the sheet
 * carries the same tray inside itself, so nothing is ever behind anything.
 */
export function ResultTray() {
  const controller = useController();
  const open = useConciergeStore((s) => s.trayOpen);
  const panel = useConciergeStore((s) => s.panel);
  const turns = useConciergeStore((s) => s.turns);
  const isXl = useMediaQuery(RAIL_QUERY);
  const result = trayResultOf(turns);
  const scrollStart = useRef<number | null>(null);
  const openedAt = useRef(0);
  const shown = open && isXl && Boolean(result);

  useEffect(() => {
    if (open) openedAt.current = performance.now();
  }, [open]);

  useLenis(({ scroll }) => {
    if (!shown) {
      scrollStart.current = null;
      return;
    }
    // the associate's own glide (a result that also moves the page) settles before the visitor's scroll counts
    if (performance.now() - openedAt.current < 2600) {
      scrollStart.current = scroll;
      return;
    }
    if (scrollStart.current === null) scrollStart.current = scroll;
    else if (Math.abs(scroll - scrollStart.current) > 160) controller?.dismissTray();
  });

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') controller?.dismissTray();
      const items = [...document.querySelectorAll<HTMLButtonElement>('[data-vitrine] button[data-ordinal]')];
      const idx = items.findIndex((b) => b === document.activeElement);
      if (idx === -1) return;
      if (e.key === 'ArrowRight') items[Math.min(items.length - 1, idx + 1)]?.focus();
      if (e.key === 'ArrowLeft') items[Math.max(0, idx - 1)]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, controller]);

  return (
    <AnimatePresence>
      {shown && result && (
        <motion.section
          key="tray"
          aria-label={result.kind === 'pieces' ? result.title : 'What the concierge brought'}
          data-salon
          data-vitrine
          data-lenis-prevent
          className="fixed bottom-0 left-0 bg-surface text-fg"
          style={{
            right: panel === 'full' ? 'var(--rail-w)' : 0,
            zIndex: 'calc(var(--z-concierge) - 1)',
            boxShadow: 'var(--salon-lift)',
            transition: 'right 700ms var(--ease-out-expo)',
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0, transition: { duration: 0.7, ease: EASE.out } }}
          exit={{ y: '100%', transition: { duration: 0.45, ease: EASE.silk } }}
        >
          <div className="hairline absolute inset-x-0 top-0" />
          <TrayBody key={`${result.kind}:${'title' in result ? result.title : ''}:${'pieces' in result ? result.pieces.length : 0}`} result={result} onClose={() => controller?.dismissTray()} />
        </motion.section>
      )}
    </AnimatePresence>
  );
}
