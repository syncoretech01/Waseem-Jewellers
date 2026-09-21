'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLenis } from 'lenis/react';
import { useSiteStore } from '@/state/siteStore';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { requestConcierge } from '@/concierge/bridge';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { WaseemMark } from '@/components/brand/WaseemMark';
import { WaseemLockup } from '@/components/brand/WaseemLockup';
import { MENU } from '@/data/menu';
import { usePathname } from 'next/navigation';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

/**
 * The authentic lockup at the top of a page — the crest over the ligature, the name set beside
 * them on one line (only WASEEM on a phone) — and the crest alone once the page has moved;
 * the five departments on a wide screen (a jeweller's header names what it sells); ASK; a
 * quiet motion control; MENU. Recedes on scroll-down past 120px, returns on scroll-up or when a dialog opens — and
 * when it returns over content it brings a surface with it, in the chapter's own paper or
 * ink, so the mark is never floating over a photograph.
 *
 * It also publishes its own height as `--nav-offset` while it is shown, so anything sticky
 * beneath it (the department refine bar) can stand under it rather than be overprinted.
 */
export function Nav() {
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const openMenu = useSiteStore((s) => s.openMenu);
  const closeMenu = useSiteStore((s) => s.closeMenu);
  const section = useSiteStore((s) => s.section);
  const routeKind = useSiteStore((s) => s.routeKind);
  const invitationVisible = useSiteStore((s) => s.heroInvitationVisible);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const videoPaused = useSiteStore((s) => s.videoPaused);
  const setVideoPaused = useSiteStore((s) => s.setVideoPaused);
  const conciergeOpen = useConciergeStore((s) => OPEN_STATES.includes(s.state));
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useLenis(({ direction, scroll }) => {
    if (menuOpen) return;
    const shouldHide = direction === 1 && scroll > 120;
    setHidden((h) => (h === shouldHide ? h : shouldHide));
    const past = scroll > 120;
    setScrolled((s) => (s === past ? s : past));
  });

  const shown = !(hidden && !menuOpen && !conciergeOpen);
  // the surface: only once the page has moved beneath the mark
  const surfaced = scrolled && shown && !menuOpen;

  useEffect(() => {
    document.documentElement.style.setProperty('--nav-offset', shown ? 'var(--nav-h)' : '0px');
    return () => {
      document.documentElement.style.removeProperty('--nav-offset');
    };
  }, [shown]);

  const onHome = routeKind === 'home';
  // the authentic lockup at the top of every page; the crest alone once the page has moved beneath it
  const showMonogram = onHome ? section !== null && section !== 'hero' && section !== 'loader' : scrolled;
  const visible = !onHome || loaderDone;

  return (
    <motion.header
      className={cn('fixed inset-x-0 top-0 flex items-center justify-between px-gutter text-fg transition-[background-color,border-color,backdrop-filter] duration-500', surfaced ? 'wj-nav-surfaced' : 'border-b border-transparent')}
      style={{ zIndex: menuOpen ? 'calc(var(--z-menu) + 1)' : 'var(--z-nav)', height: 'var(--nav-h)' }}
      initial={false}
      animate={{ y: shown ? 0 : '-100%', opacity: visible ? 1 : 0 }}
      data-surfaced={surfaced ? '1' : '0'}
      transition={{ duration: 0.5, ease: EASE.silk }}
      aria-label="Primary"
    >
      {/* one content width across the site: the row inside the gutter is capped like every chapter */}
      <div className="wj-content flex items-center justify-between">
      {/* the hero's veil: a soft ground while the film is under the mark; gone once the nav has a surface */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[140%] bg-gradient-to-b from-ink/50 to-transparent opacity-0 transition-opacity duration-700" style={{ opacity: surfaced ? 0 : 'var(--header-veil, 0)' }} />
      <TransitionLink href="/" className="relative flex h-10 items-center" aria-label="Waseem Jewellers — home">
        <AnimatePresence mode="wait" initial={false}>
          {showMonogram ? (
            <motion.span key="mono" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4, ease: EASE.out }} className="inline-flex">
              <WaseemMark variant="crest" tone="current" className="h-[26px] w-auto sm:h-7" />
            </motion.span>
          ) : (
            <motion.span key="lockup" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4, ease: EASE.out }} className="inline-flex">
              {/* the real lockup: the crest and ligature with the name beside them — WASEEM alone where a phone has no width for the second word */}
              <WaseemLockup layout="inline" words="first" tone="current" title={null} className="h-[34px] w-auto sm:hidden" />
              <WaseemLockup layout="inline" tone="current" title={null} className="hidden h-[38px] w-auto sm:block lg:h-[40px]" />
            </motion.span>
          )}
        </AnimatePresence>
      </TransitionLink>

      {/* the departments, with the one the visitor is standing in underlined */}
      <nav aria-label="Departments" className="hidden flex-1 items-center justify-center gap-7 min-[1360px]:flex">
        {MENU.map((item) => {
          const here = pathname === item.target || pathname.startsWith(`${item.target}/`);
          return (
            <TransitionLink key={item.id} href={item.target} className="micro group/sel relative flex h-11 items-center text-fg" aria-current={here ? 'page' : undefined} data-cursor="explore">
              {item.label}
              <Underline held={here} />
            </TransitionLink>
          );
        })}
      </nav>

      <nav className="flex items-center gap-8 md:gap-10">
        {!invitationVisible && !conciergeOpen && (
          <button type="button" onClick={() => requestConcierge({ mode: 'chat' })} className="micro group/sel relative hidden h-11 items-center text-fg md:flex" data-cursor="ask">
            Ask
            <Underline />
          </button>
        )}
        {/* the motion control stays for whoever needs it, and says nothing until it is looked at: a small glyph, its name for assistive technology and on hover */}
        <button
          type="button"
          onClick={() => setVideoPaused(!videoPaused)}
          aria-pressed={videoPaused}
          aria-label={videoPaused ? 'Play motion' : 'Pause motion'}
          title={videoPaused ? 'Play motion' : 'Pause motion'}
          className="group/motion relative flex h-11 w-8 items-center justify-center text-fg/55 transition-colors hover:text-fg"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden fill="currentColor">
            {videoPaused ? <path d="M3 1.5v9l7-4.5z" /> : <path d="M2.5 1.5h2.2v9H2.5zM7.3 1.5h2.2v9H7.3z" />}
          </svg>
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
      </div>
    </motion.header>
  );
}

function Underline({ held = false }: { held?: boolean }) {
  return (
    <span aria-hidden className={cn('hairline absolute inset-x-0 bottom-2 origin-left transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/sel:scale-x-100 group-focus-visible/sel:scale-x-100', held ? 'scale-x-100' : 'scale-x-0')} />
  );
}
