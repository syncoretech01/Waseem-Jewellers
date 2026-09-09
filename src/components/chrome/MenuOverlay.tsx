'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { gsap } from '@/lib/motion/gsap';
import { Img } from '@/components/media/Img';
import { Video } from '@/components/media/Video';
import { UrduAccent } from '@/components/ui/primitives';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo, startScroll, stopScroll } from '@/state/runtime';
import { sectionElement } from '@/state/sections';
import { trapFocus } from '@/lib/focusTrap';
import { MENU, MENU_ALL, MENU_SECONDARY, SITE } from '@/data';
import { EASE } from '@/lib/motion/easings';
import { useQualityStore } from '@/state/qualityStore';
import type { MenuItem } from '@/data/types';
import type { SectionId } from '@/state/siteStore';
import { cn } from '@/lib/cn';

/**
 * The veil behind each entry. Keyed loosely with a fallback, so adding a menu item is a
 * change to data alone — the closed record this replaced meant a new department could not
 * be added without editing this component.
 */
const WORLD_TINT: Record<string, string> = {
  gold: 'rgba(46, 31, 10, 0.55)',
  diamond: 'rgba(14, 22, 34, 0.55)',
  bridal: 'rgba(40, 12, 18, 0.55)',
  men: 'rgba(18, 16, 12, 0.6)',
  kids: 'rgba(24, 20, 16, 0.55)',
  collections: 'rgba(16, 14, 24, 0.55)',
  bespoke: 'rgba(20, 20, 20, 0.55)',
  house: 'rgba(12, 16, 20, 0.55)',
};
const TINT_DEFAULT = 'rgba(16, 16, 18, 0.55)';

/**
 * Full-screen navigation. The scene recedes (`.recede` leaves scale up beneath a tinted veil),
 * huge type rises through masks, hover changes the imagery. GSAP handles the page recede,
 * Motion the overlay itself.
 */
export function MenuOverlay() {
  const open = useSiteStore((s) => s.menuOpen);
  const closeMenu = useSiteStore((s) => s.closeMenu);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const setPendingSection = useSiteStore((s) => s.setPendingSection);
  const routeKind = useSiteStore((s) => s.routeKind);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const highOrMedium = useQualityStore((s) => s.tier === 'HIGH' || s.tier === 'MEDIUM');
  const [active, setActive] = useState<MenuItem['id']>('bridal');
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    trigger.current = document.activeElement;
    stopScroll();
    const page = document.getElementById('page-root');
    page?.setAttribute('inert', '');
    const leaves = [...document.querySelectorAll<HTMLElement>('#page-root .recede')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    }).slice(0, 2);
    if (!reduced && leaves.length) gsap.to(leaves, { scale: 1.06, y: '-1.5svh', duration: 0.9, ease: 'wj.inOut', overwrite: 'auto' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    document.addEventListener('keydown', onKey);
    let release: (() => void) | null = null;
    const raf = requestAnimationFrame(() => {
      if (panel.current) release = trapFocus(panel.current, panel.current.querySelector<HTMLElement>('a, button'));
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      release?.();
      page?.removeAttribute('inert');
      if (leaves.length) gsap.to(leaves, { scale: 1, y: 0, duration: 0.55, ease: 'wj.inOut', overwrite: 'auto' });
      startScroll();
      (trigger.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open, closeMenu, reduced]);

  const go = (item: MenuItem) => {
    closeMenu();
    window.setTimeout(() => {
      if (item.kind === 'route') {
        void (runtime.transition?.navigate(item.target, { kind: 'curtain' }) ?? runtime.router?.push(item.target, { scroll: false }));
      } else if (item.kind === 'chapter') {
        const id = item.target as SectionId;
        if (routeKind === 'home') {
          const el = sectionElement(id);
          if (el) scrollTo(el, { duration: 1.6 });
        } else {
          setPendingSection(id);
          void (runtime.transition?.navigate('/', { kind: 'curtain' }) ?? runtime.router?.push('/', { scroll: false }));
        }
      } else {
        openConsultation({ topic: 'bespoke', source: 'menu' });
      }
    }, 140);
  };

  const activeItem = MENU_ALL.find((m) => m.id === active) ?? MENU[2]!;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="wj-menu"
          key="menu"
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          data-lenis-prevent
          className="fixed inset-0 overflow-y-auto text-ivory"
          style={{ zIndex: 'var(--z-menu)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.38 } }}
        >
          {/* ambient */}
          <div className="absolute inset-0 overflow-hidden bg-ink">
            {highOrMedium && !reduced && (
              <motion.div className="absolute inset-0 opacity-40" initial={{ scale: 1.08 }} animate={{ scale: 1, transition: { duration: 1.4, ease: EASE.out } }}>
                <Video id="menu-ambient" preload="metadata" portrait={false} className="brightness-[0.55]" />
              </motion.div>
            )}
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={activeItem.id}
                className="absolute inset-0 md:left-auto md:w-[46vw]"
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE.out } }}
                exit={{ opacity: 0, transition: { duration: 0.6 } }}
              >
                <div className="absolute inset-0 grain vignette">
                  {/* a department with no campaign photography shows the ambient scene, never someone else's piece */}
                  {activeItem.media.still && <Img id={activeItem.media.still} sizes="(min-width:768px) 46vw, 100vw" />}
                  {activeItem.media.video && highOrMedium && !reduced && (
                    <div className="absolute inset-0">
                      <Video id={activeItem.media.video} preload="metadata" portrait={false} />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/40 to-transparent md:from-ink/90" />
              </motion.div>
            </AnimatePresence>
            <motion.div className="absolute inset-0" animate={{ backgroundColor: WORLD_TINT[activeItem.id] ?? TINT_DEFAULT }} transition={{ duration: 0.8 }} />
          </div>

          {/* items */}
          <div className="relative flex min-h-full flex-col justify-between px-gutter pb-10 pt-[calc(var(--nav-h)+2vh)]">
            <motion.ul className="flex flex-col" initial="closed" animate="open" exit="closed" variants={{ open: { transition: { staggerChildren: 0.022, delayChildren: 0.015 } }, closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } } }}>
              {MENU.map((item) => {
                const isActive = active === item.id;
                return (
                  <li key={item.id} className="overflow-hidden border-b border-champagne/10 last:border-0">
                    <motion.div variants={{ open: { y: 0, transition: { duration: 0.34, ease: EASE.out } }, closed: { y: '110%', transition: { duration: 0.34, ease: EASE.silk } } }}>
                      <button
                        type="button"
                        data-menu-id={item.id}
                        onClick={() => go(item)}
                        onPointerEnter={() => setActive(item.id)}
                        onFocus={() => setActive(item.id)}
                        onTouchStart={() => setActive(item.id)}
                        className={cn('group/item flex w-full items-baseline gap-6 py-3 text-left transition-opacity duration-500', !isActive && 'opacity-45 hover:opacity-100')}
                        data-cursor="discover"
                      >
                        <span className="font-display text-[0.9rem] text-champagne/70" style={{ fontVariationSettings: '"opsz" 12' }}>
                          {item.numeral}
                        </span>
                        <span className="display text-[clamp(2.4rem,min(6.2vw,9svh),6.5rem)] leading-[0.95]">{item.label}</span>
                        {item.id === 'collections' && <UrduAccent text={undefined} />}
                        <span className={cn('hidden font-display italic text-[1rem] text-champagne/80 transition-opacity duration-500 md:inline', isActive ? 'opacity-100' : 'opacity-0')} style={{ fontVariationSettings: '"opsz" 16' }}>
                          {item.line}
                        </span>
                        <span aria-hidden className={cn('hairline ml-auto hidden w-16 origin-left transition-transform duration-700 ease-[var(--ease-out-expo)] md:block', isActive ? 'scale-x-100' : 'scale-x-0')} />
                      </button>
                    </motion.div>
                  </li>
                );
              })}
            </motion.ul>

            {/* the chapters: read rather than shopped, so they are set below the departments and smaller */}
            <motion.ul
              className="mt-8 flex flex-wrap items-baseline gap-x-10 gap-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.34 } }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              {MENU_SECONDARY.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-menu-id={item.id}
                    onClick={() => go(item)}
                    onPointerEnter={() => setActive(item.id)}
                    onFocus={() => setActive(item.id)}
                    onTouchStart={() => setActive(item.id)}
                    className={cn('group/sec relative pb-1 font-display text-[1.35rem] transition-opacity duration-500', active === item.id ? 'opacity-100' : 'opacity-55 hover:opacity-100')}
                    style={{ fontVariationSettings: '"opsz" 24' }}
                    data-cursor="discover"
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-x-0 bottom-0 h-px origin-left bg-champagne/50 transition-transform duration-700 ease-[var(--ease-out-expo)]',
                        active === item.id ? 'scale-x-100' : 'scale-x-0 group-hover/sec:scale-x-100',
                      )}
                    />
                  </button>
                </li>
              ))}
            </motion.ul>

            <motion.div className="mt-6 flex flex-col gap-6 text-[0.75rem] text-ivory/70 md:flex-row md:items-end md:justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.16, duration: 0.34 } }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
              <div className="flex flex-col gap-1">
                {SITE.showrooms.map((s) => (
                  <span key={s.id}>{s.address}</span>
                ))}
                <span className="mt-2">
                  {SITE.hours} · {SITE.phone}
                </span>
              </div>
              <div className="micro flex gap-6">
                {SITE.socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-ivory">
                    {s.label}
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
