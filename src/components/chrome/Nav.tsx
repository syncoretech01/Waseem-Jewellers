'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLenis } from 'lenis/react';
import { useSiteStore } from '@/state/siteStore';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { requestConcierge } from '@/concierge/bridge';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { Monogram } from './Monogram';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

/**
 * Text only, no bar: WASEEM (→ monogram after the hero), SELECTION · 02, ASK, MENU.
 * Recedes on scroll-down past 120px, returns on scroll-up or when a dialog opens.
 */
export function Nav() {
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const openMenu = useSiteStore((s) => s.openMenu);
  const closeMenu = useSiteStore((s) => s.closeMenu);
  const openLedger = useSiteStore((s) => s.openLedger);
  const section = useSiteStore((s) => s.section);
  const routeKind = useSiteStore((s) => s.routeKind);
  const hydrated = useSiteStore((s) => s.hydrated);
  const count = useSiteStore((s) => s.wishlist.length);
  const invitationVisible = useSiteStore((s) => s.heroInvitationVisible);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const videoPaused = useSiteStore((s) => s.videoPaused);
  const setVideoPaused = useSiteStore((s) => s.setVideoPaused);
  const conciergeOpen = useConciergeStore((s) => OPEN_STATES.includes(s.state));
  const [hidden, setHidden] = useState(false);

  useLenis(({ direction, scroll }) => {
    if (menuOpen) return;
    const shouldHide = direction === 1 && scroll > 120;
    setHidden((h) => (h === shouldHide ? h : shouldHide));
  });

  const onHome = routeKind === 'home';
  const showMonogram = !onHome || (section !== null && section !== 'hero' && section !== 'loader');
  const visible = !onHome || loaderDone;

  return (
    <motion.header
      className="fixed inset-x-0 top-0 flex items-center justify-between px-gutter text-fg"
      style={{ zIndex: menuOpen ? 'calc(var(--z-menu) + 1)' : 'var(--z-nav)', height: 'var(--nav-h)' }}
      initial={false}
      animate={{ y: hidden && !menuOpen && !conciergeOpen ? '-100%' : 0, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.5, ease: EASE.silk }}
      aria-label="Primary"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[140%] bg-gradient-to-b from-ink/50 to-transparent opacity-0 transition-opacity duration-700" style={{ opacity: 'var(--header-veil, 0)' }} />
      <TransitionLink href="/" className="relative flex h-10 items-center" aria-label="Waseem Jewellers — home">
        <AnimatePresence mode="wait" initial={false}>
          {showMonogram ? (
            <motion.span key="mono" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4, ease: EASE.out }} className="inline-flex">
              <Monogram className="h-5 w-auto" />
            </motion.span>
          ) : (
            <motion.span
              key="word"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4, ease: EASE.out }}
              className="font-display text-[0.8125rem] uppercase tracking-[0.32em]"
              style={{ fontVariationSettings: '"opsz" 12' }}
            >
              Waseem
            </motion.span>
          )}
        </AnimatePresence>
      </TransitionLink>

      <nav className="flex items-center gap-8 md:gap-10">
        {hydrated && count > 0 && (
          <button type="button" onClick={openLedger} className="micro group/sel relative flex h-11 items-center gap-2 text-fg" aria-label={count === 1 ? 'Your selection, one piece' : `Your selection, ${count} pieces`}>
            <span className="hidden sm:inline">Selection</span>
            <span className="font-display text-[0.9rem] tracking-normal" style={{ fontVariationSettings: '"opsz" 12' }}>
              {String(count).padStart(2, '0')}
            </span>
            <Underline />
          </button>
        )}
        {!invitationVisible && !conciergeOpen && (
          <button type="button" onClick={() => requestConcierge({ mode: 'chat' })} className="micro group/sel relative hidden h-11 items-center text-fg md:flex" data-cursor="ask">
            Ask
            <Underline />
          </button>
        )}
        <button
          type="button"
          onClick={() => setVideoPaused(!videoPaused)}
          aria-pressed={videoPaused}
          className="micro group/sel relative hidden h-11 items-center text-fg md:flex"
        >
          {videoPaused ? 'Play motion' : 'Pause motion'}
          <Underline />
        </button>
        <button
          type="button"
          onClick={menuOpen ? closeMenu : openMenu}
          aria-expanded={menuOpen}
          aria-controls="wj-menu"
          className="micro group/sel relative flex h-11 items-center text-fg"
        >
          <span className="relative grid">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={menuOpen ? 'close' : 'menu'} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.25 }}>
                {menuOpen ? 'Close' : 'Menu'}
              </motion.span>
            </AnimatePresence>
          </span>
          <span aria-hidden className="ml-3 hidden h-px w-6 bg-line-strong transition-all duration-500 ease-[var(--ease-out-expo)] group-hover/sel:w-10 group-hover/sel:bg-gold-hi sm:inline-block" />
        </button>
      </nav>
    </motion.header>
  );
}

function Underline() {
  return (
    <span aria-hidden className={cn('hairline absolute inset-x-0 bottom-2 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/sel:scale-x-100 group-focus-visible/sel:scale-x-100')} />
  );
}
