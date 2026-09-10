'use client';

import { Img } from '@/components/media/Img';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLenis } from 'lenis/react';
import { useConciergeStore, type PieceCard } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

/**
 * The associate's tray: results rise from the bottom of the room as a full-width ink-velvet
 * band with four pieces and serif ordinals. Native scroll-snap, roving keyboard focus.
 */
export function ResultTray() {
  const controller = useController();
  const open = useConciergeStore((s) => s.trayOpen);
  const panel = useConciergeStore((s) => s.panel);
  const turns = useConciergeStore((s) => s.turns);
  const last = [...turns].reverse().find((t) => t.result && (t.result.kind === 'pieces' || t.result.kind === 'wishlist' || t.result.kind === 'collections'));
  const result = last?.result;
  const list = useRef<HTMLOListElement>(null);
  const scrollStart = useRef<number | null>(null);
  const openedAt = useRef(0);

  useEffect(() => {
    if (open) openedAt.current = performance.now();
  }, [open]);

  useLenis(({ scroll }) => {
    if (!open) {
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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') controller?.dismissTray();
      if (!list.current) return;
      const items = [...list.current.querySelectorAll<HTMLButtonElement>('button[data-ordinal]')];
      const idx = items.findIndex((b) => b === document.activeElement);
      if (idx === -1) return;
      if (e.key === 'ArrowRight') items[Math.min(items.length - 1, idx + 1)]?.focus();
      if (e.key === 'ArrowLeft') items[Math.max(0, idx - 1)]?.focus();
      if (e.key.toLowerCase() === 's') {
        const slug = items[idx]?.dataset.slug;
        if (slug) controller?.submitText(`Save the ${items[idx]?.dataset.name}`, 'card');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, controller]);

  const pieces: PieceCard[] | null = result && (result.kind === 'pieces' || result.kind === 'wishlist') ? result.pieces : null;
  const collections = result?.kind === 'collections' ? result.collections : null;
  const title = result?.kind === 'pieces' ? result.title : result?.kind === 'wishlist' ? 'Your selection' : result?.kind === 'collections' ? 'Five worlds' : '';

  return (
    <AnimatePresence>
      {open && (pieces?.length || collections?.length) ? (
        <motion.section
          key="tray"
          aria-label={title}
          data-salon
          className="fixed inset-x-0 bottom-0 bg-surface text-fg"
          style={{ zIndex: 'calc(var(--z-concierge) - 1)', boxShadow: 'var(--salon-lift)' }}
          initial={{ y: '100%' }}
          animate={{ y: 0, transition: { duration: 0.7, ease: EASE.out } }}
          exit={{ y: '100%', transition: { duration: 0.45, ease: EASE.silk } }}
          data-theme="dark"
          data-lenis-prevent
        >
          <div className="hairline absolute inset-x-0 top-0" />
          {/*
            The vitrine stops where the rail begins. Derived from --rail-w rather than written
            out, because these were hard-coded for a 468px rail and silently became too narrow
            the moment it widened — the tray Close ended up underneath the panel. Below xl the
            panel covers the screen and there is no rail to avoid, so only xl carries it.
          */}
          <div className={cn('flex items-center justify-between px-gutter pt-6', panel === 'full' && 'xl:pr-[calc(var(--rail-w)+2.75rem)]')}>
            <p className="font-display italic text-[1.0625rem] text-fg-2" style={{ fontVariationSettings: '"opsz" 16' }}>
              {title}
            </p>
            <button type="button" onClick={() => controller?.dismissTray()} className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="close">
              Close
            </button>
          </div>
          <ol
            ref={list}
            className={cn('no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-gutter pb-28 pt-5 md:gap-8 md:pb-8', panel === 'full' && 'xl:pr-[calc(var(--rail-w)+2.75rem)]')}
            style={{ scrollPaddingLeft: 'var(--spacing-gutter)' }}
            data-lenis-prevent-wheel
            role="list"
          >
            {pieces?.map((p, i) => (
              <motion.li
                key={p.slug}
                className="w-[172px] shrink-0 snap-start md:w-[clamp(208px,16vw,264px)]"
                initial={{ clipPath: 'inset(0 100% 0 0)' }}
                animate={{ clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.55, ease: EASE.out, delay: 0.15 + i * 0.08 } }}
              >
                <button
                  type="button"
                  data-ordinal={p.ordinal}
                  data-slug={p.slug}
                  data-name={p.name}
                  onClick={() => controller?.tapCard(p.slug, p.name)}
                  className="group/tray block w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-gold-hi"
                  aria-label={`Piece ${p.ordinal} of ${pieces.length}, ${p.name}, ${p.priceLabel.toLowerCase()}`}
                  data-cursor="view"
                >
                  <span className="relative block w-full overflow-hidden" style={{ aspectRatio: '4 / 5', background: 'var(--salon-well)' }}>
                    <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/tray:scale-[1.04]">
                      <Img image={p.image} alt="" sizes="(min-width:768px) 300px, 240px" />
                    </span>
                  </span>
                  <span className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-[0.75rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
                      {String(p.ordinal).padStart(2, '0')}
                    </span>
                    <span className="font-display text-[1.0625rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
                      {p.name}
                    </span>
                  </span>
                  <span className="micro mt-1 block text-fg-2">{p.priceLabel}</span>
                </button>
              </motion.li>
            ))}
            {collections?.map((c, i) => (
              <motion.li key={c.slug} className="w-[240px] shrink-0 snap-start md:w-[300px]" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.55, ease: EASE.out, delay: 0.15 + i * 0.08 } }}>
                <button type="button" data-ordinal={c.ordinal} data-slug={c.slug} data-name={c.name} onClick={() => controller?.submitText(`Show me ${c.name}`, 'card')} className={cn('group/tray block w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-gold-hi')} aria-label={`World ${c.ordinal} of ${collections.length}, ${c.name}`} data-cursor="explore">
                  <span className="relative block w-full overflow-hidden" style={{ aspectRatio: '3 / 2', background: 'var(--salon-well)' }}>
                    <span className="absolute inset-0 block transition-transform duration-700 group-hover/tray:scale-[1.04]">
                      <Img image={c.image} alt="" sizes="(min-width:768px) 300px, 240px" />
                    </span>
                  </span>
                  <span className="mt-4 block font-display text-[1.0625rem] text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
                    {c.name}
                  </span>
                </button>
              </motion.li>
            ))}
          </ol>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
