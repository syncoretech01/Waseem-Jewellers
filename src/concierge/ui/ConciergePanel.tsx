'use client';

import { Img } from '@/components/media/Img';
import { useEffect, useRef } from 'react';
import { ScrollTrigger } from '@/lib/motion/gsap';
import { AnimatePresence, motion } from 'motion/react';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { useController } from '../useConcierge';
import { ExchangeList } from './Exchange';
import { Composer } from './Composer';
import { ContextRibbon } from './ContextRibbon';
import { VoiceStage } from './VoiceStage';
import { TrayBody, trayResultOf } from './cards/TrayBody';
import { factsOf } from './cards/PieceTile';
import { briefOfSlug } from '../context';
import { getRow } from '@/data/clientIndex';
import { SaveButton } from '@/components/commerce/SaveButton';
import { WaseemMark } from '@/components/brand/WaseemMark';
import { CONCIERGE } from '../copy';
import { TravellingLight } from '@/components/ui/primitives';
import { EASE } from '@/lib/motion/easings';
import { useMediaQuery, RAIL_QUERY } from '@/lib/useMediaQuery';
import { cn } from '@/lib/cn';
import { trapFocus } from '@/lib/focusTrap';

/**
 * The piece under discussion, given the room a piece deserves: a plate the width of the rail,
 * the name set large, the published facts, and the two things the rail covers on the page.
 */
function PiecePlate({ strip }: { strip?: boolean }) {
  const slug = useSiteStore((s) => s.currentProduct ?? s.focusedProduct);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const piece = briefOfSlug(slug);
  if (!piece) return null;
  const row = getRow(piece.slug);
  const facts = factsOf(row);
  const priced = row ? row.p > 0 : false;
  const line = [priced ? piece.priceLabel : undefined, facts].filter(Boolean).join(' · ');

  if (strip) {
    return (
      <div className="flex items-center gap-4 border-b border-line px-8 pb-4">
        <span className="salon-tile relative block h-14 w-11 shrink-0 overflow-hidden" style={{ background: 'var(--salon-well)' }}>
          <Img image={piece.image} alt="" sizes="44px" />
        </span>
        <div className="min-w-0">
          <p className="micro text-fg-muted">{CONCIERGE.inView}</p>
          <p dir="auto" className="truncate font-display text-[1.0625rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
            {piece.name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <figure className="px-8 pb-6">
      <span className="salon-tile relative block w-full overflow-hidden" style={{ aspectRatio: '3 / 2', background: 'var(--salon-well)' }}>
        <Img image={piece.image} alt="" sizes="(min-width: 1280px) 496px, 100vw" />
      </span>
      <figcaption className="mt-4 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="micro text-fg-muted">{CONCIERGE.inView}</p>
          <p dir="auto" className="mt-1 font-display text-[1.375rem] leading-tight text-fg" style={{ fontVariationSettings: '"opsz" 22' }}>
            {piece.name}
          </p>
          {line && <p className="mt-1.5 text-[0.8125rem] text-fg-2">{line}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={() => openConsultation({ topic: 'viewing', productSlug: piece.slug, source: 'cta' })}
            className="micro text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
            data-cursor="open"
          >
            Book a viewing
          </button>
          <SaveButton slug={piece.slug} variant="compact" />
        </div>
      </figcaption>
    </figure>
  );
}

/**
 * Desktop: a rail the height of the page, beside it, in the register of the chapter beneath.
 * Below the rail breakpoint: a sheet over the page that carries the tray inside itself.
 */
export function ConciergePanel() {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const mode = useConciergeStore((s) => s.mode);
  const panel = useConciergeStore((s) => s.panel);
  const turns = useConciergeStore((s) => s.turns);
  const trayOpen = useConciergeStore((s) => s.trayOpen);
  const spoken = useConciergeStore((s) => s.voice.spokenReplies);
  const preparing = useConciergeStore((s) => s.voice.preparing);
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const isXl = useMediaQuery(RAIL_QUERY);
  const sheet = !isXl;
  const open = OPEN_STATES.includes(state) && panel !== 'closed' && !menuOpen;
  const full = open && panel === 'full';
  const root = useRef<HTMLDivElement>(null);
  const suggestionsVisible = mode === 'chat' && turns.filter((t) => t.role === 'visitor').length === 0;
  const trayResult = sheet && trayOpen ? trayResultOf(turns) : null;

  // the rail's keep-out lane: a page that would be covered steps aside instead (>= xl, see globals.css)
  useEffect(() => {
    const el = document.documentElement;
    if (full && isXl) el.dataset.rail = '1';
    else delete el.dataset.rail;
    if (!document.querySelector('[data-rail-inset]')) return;
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 780);
    return () => window.clearTimeout(t);
  }, [full, isXl]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.rail;
    },
    [],
  );

  /**
   * Modal only when it covers the page. The sheet keys its semantics on the layout, not the
   * pointer: a tablet with a mouse gets the same inert page and wrapped Tab as a phone. The
   * desktop rail is deliberately non-modal — the page beside it stays live — and closing it
   * still returns focus to whatever asked for it, which the controller does.
   */
  useEffect(() => {
    const el = root.current;
    if (!open || !el || !sheet) return;
    const page = document.getElementById('page-root');
    page?.setAttribute('inert', '');
    const release = trapFocus(el);
    return () => {
      page?.removeAttribute('inert');
      release();
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && controller?.close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full, controller]);

  // keep the field above the on-screen keyboard on phones
  useEffect(() => {
    if (!full || !coarse || !window.visualViewport) return;
    const vv = window.visualViewport;
    const apply = () => {
      if (root.current) root.current.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    };
    vv.addEventListener('resize', apply);
    apply();
    return () => vv.removeEventListener('resize', apply);
  }, [full, coarse]);

  const enter = reduced ? { opacity: 0 } : sheet ? { y: '100%' } : { x: '100%' };
  const shown = reduced ? { opacity: 1, transition: { duration: 0.25 } } : sheet ? { y: 0, transition: { duration: 0.5, ease: EASE.out } } : { x: 0, transition: { duration: 0.56, ease: EASE.out } };
  const leave = reduced ? { opacity: 0, transition: { duration: 0.2 } } : sheet ? { y: '100%', transition: { duration: 0.4, ease: EASE.silk } } : { x: '100%', transition: { duration: 0.42, ease: EASE.silk } };

  return (
    <AnimatePresence>
      {full && (
        <motion.div
          key="panel"
          ref={root}
          role="dialog"
          aria-modal={sheet ? 'true' : 'false'}
          aria-label={CONCIERGE.name}
          data-lenis-prevent
          data-salon
          className={cn('fixed flex flex-col bg-surface text-fg', sheet ? 'inset-0' : 'bottom-0 right-0 top-[var(--nav-h)] w-[var(--rail-w)]')}
          style={{ zIndex: 'var(--z-concierge)', paddingBottom: 'var(--kb, 0px)', boxShadow: 'var(--salon-shadow)' }}
          initial={enter}
          animate={shown}
          exit={leave}
          onAnimationComplete={() => controller?.opened()}
        >
          {/* masthead */}
          <div className="flex items-center justify-between border-b border-line px-8 pb-5 pt-6">
            <div className="flex items-center gap-3.5">
              <WaseemMark variant="crest" tone="current" title={null} className="h-5 w-auto text-fg" />
              <p className="micro text-fg-2">{CONCIERGE.name}</p>
            </div>
            <button type="button" onClick={() => controller?.close()} className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="close" aria-label="Close the concierge">
              Close
            </button>
          </div>

          {/* the piece in view: a plate while writing, a strip while the stage is up */}
          <PiecePlate strip={mode === 'voice' || Boolean(trayResult)} />

          {/* voice stage */}
          {mode === 'voice' && <VoiceStage compact={sheet} />}

          {/* transcript */}
          <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-6 pt-4" data-lenis-prevent data-transcript>
            <ExchangeList latestOnly={mode === 'voice'} />
            {suggestionsVisible && (
              <div className="mt-9 flex flex-col gap-3.5">
                <p className="micro text-fg-muted">{CONCIERGE.youMightAsk}</p>
                {CONCIERGE.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => controller?.submitText(s, 'text')}
                    className="group/sug w-fit font-display italic text-[1.125rem] text-fg-2 transition-colors hover:text-fg"
                    style={{ fontVariationSettings: '"opsz" 18' }}
                    data-cursor="ask"
                  >
                    <span className="relative pb-0.5">
                      {s}
                      <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/sug:scale-x-100" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* the tray, inside the sheet: the jewellery is never behind the words */}
          {trayResult && (
            <div className="max-h-[47dvh] shrink-0 overflow-y-auto border-t border-line" data-vitrine data-lenis-prevent>
              <TrayBody key={`${trayResult.kind}:${'pieces' in trayResult ? trayResult.pieces.length : 0}`} result={trayResult} compact onClose={() => controller?.dismissTray()} />
            </div>
          )}

          {/* what the concierge believes it is being asked about, and how to drop a part of it */}
          <ContextRibbon />

          {/* composer + base links */}
          <div className="border-t border-line px-8 pb-5 pt-3">
            {mode === 'chat' && <Composer autoFocus={!coarse} />}
            <div className={cn('flex items-center justify-between', mode === 'chat' ? 'mt-4' : '')}>
              <div className="micro flex gap-5 text-fg-muted">
                <button type="button" onClick={() => controller?.toggleSpokenReplies()} className={cn('transition-colors hover:text-fg', spoken && 'text-fg-2')} aria-pressed={spoken}>
                  {CONCIERGE.spokenReplies}
                </button>
                <button type="button" onClick={() => controller?.forget()} className="transition-colors hover:text-fg">
                  {CONCIERGE.beginAgain}
                </button>
              </div>
              <TravellingLight active={preparing || state === 'THINKING' || state === 'EXECUTING_ACTION'} className="w-10" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
