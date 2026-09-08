'use client';

import { useEffect, useRef } from 'react';
import { ScrollTrigger } from '@/lib/motion/gsap';
import { AnimatePresence, motion } from 'motion/react';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { useController } from '../useConcierge';
import { ExchangeList } from './Exchange';
import { Composer } from './Composer';
import { VoiceStage } from './VoiceStage';
import { OrbStatic } from '../orb/OrbStatic';
import { briefOfSlug } from '../context';
import { SaveButton } from '@/components/commerce/SaveButton';
import { CONCIERGE } from '../copy';
import { TravellingLight } from '@/components/ui/primitives';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

/**
 * Desktop: a floating spatial panel above the jewel, unfolding upward from its base hairline.
 * Mobile: a full-screen, voice-first sheet. Opaque ink (pearl over ivory chapters); no bubbles.
 */
/** The piece under discussion: 72×92 of jewellery and the two page controls the rail covers. */
function PieceInView() {
  const slug = useSiteStore((s) => s.currentProduct ?? s.focusedProduct);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const piece = briefOfSlug(slug);
  if (!piece) return null;
  return (
    <div className="flex items-stretch gap-4 border-y border-line px-6 py-4 md:px-7">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={piece.image} alt="" className="h-[92px] w-[72px] shrink-0 object-cover" loading="lazy" style={{ background: 'var(--salon-well)' }} />
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="micro text-fg-muted">In view</p>
          <p className="mt-1 truncate font-display text-[1.0625rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
            {piece.name}
          </p>
          <p className="micro mt-1 text-fg-2">{piece.priceLabel}</p>
        </div>
        <div className="-mb-2 flex items-center gap-4">
          <button
            type="button"
            onClick={() => openConsultation({ topic: 'viewing', productSlug: piece.slug, source: 'cta' })}
            className="micro text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
          >
            Private viewing
          </button>
          <SaveButton slug={piece.slug} variant="compact" />
        </div>
      </div>
    </div>
  );
}

export function ConciergePanel() {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const mode = useConciergeStore((s) => s.mode);
  const panel = useConciergeStore((s) => s.panel);
  const turns = useConciergeStore((s) => s.turns);
  const spoken = useConciergeStore((s) => s.voice.spokenReplies);
  const preparing = useConciergeStore((s) => s.voice.preparing);
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const open = OPEN_STATES.includes(state) && panel !== 'closed' && !menuOpen;
  const full = open && panel === 'full';
  const root = useRef<HTMLDivElement>(null);
  const suggestionsVisible = mode === 'chat' && turns.filter((t) => t.role === 'visitor').length === 0;
  const lastLine = [...turns].reverse().find((t) => t.role === 'concierge' && t.text)?.text ?? '';

  // the rail's keep-out lane: a page that would be covered steps aside instead (>= xl, see globals.css)
  useEffect(() => {
    const el = document.documentElement;
    if (full) el.dataset.rail = '1';
    else delete el.dataset.rail;
    if (!document.querySelector('[data-rail-inset]')) return;
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 780);
    return () => window.clearTimeout(t);
  }, [full]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.rail;
    },
    [],
  );

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

  return (
    <>
      <AnimatePresence>
        {full && (
          <motion.div
            key="scrim"
            aria-hidden
            className="pointer-events-none fixed bottom-0 right-0 hidden xl:block xl:w-[648px]"
            style={{
              top: 'var(--nav-h)',
              zIndex: 'calc(var(--z-concierge) - 2)',
              background: 'linear-gradient(90deg, transparent 0%, var(--veil) 72%, var(--veil) 100%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.55, ease: EASE.out } }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          />
        )}
        {full && (
          <motion.div
            key="panel"
            ref={root}
            role="dialog"
            aria-modal={coarse ? 'true' : 'false'}
            aria-label={CONCIERGE.name}
            data-lenis-prevent
            data-salon
            data-theme="dark"
            className={cn(
              'fixed flex flex-col bg-surface text-fg',
              'inset-0 xl:inset-auto xl:bottom-[104px] xl:right-7 xl:h-[min(680px,calc(100dvh-var(--nav-h)-128px))] xl:w-[468px]',
            )}
            style={{ zIndex: 'var(--z-concierge)', paddingBottom: 'var(--kb, 0px)', boxShadow: 'var(--salon-shadow)' }}
            initial={reduced ? { opacity: 0 } : { clipPath: 'inset(100% 0 0 0)' }}
            animate={reduced ? { opacity: 1, transition: { duration: 0.25 } } : { clipPath: 'inset(0% 0 0 0)', transition: { duration: 0.46, ease: EASE.out } }}
            exit={reduced ? { opacity: 0, transition: { duration: 0.2 } } : { clipPath: 'inset(100% 0 0 0)', transition: { duration: 0.4, ease: EASE.silk } }}
            onAnimationComplete={() => controller?.opened()}
          >
            <div className="hairline absolute inset-x-0 top-0 opacity-70" />

            {/* masthead */}
            <div className="flex items-center justify-between px-6 pb-5 pt-6 md:px-7">
              <div className="flex items-center gap-4">
                <OrbStatic state={mode === 'voice' ? 'CHAT' : state} size={24} />
                <div>
                  <p className="micro text-fg-2">{CONCIERGE.name}</p>
                  <p className="font-display italic text-[0.8125rem] leading-tight text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
                    {CONCIERGE.sub}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {mode === 'voice' && (
                  <button type="button" onClick={() => controller?.setMode('chat')} className="micro text-fg-muted transition-colors hover:text-fg">
                    Write
                  </button>
                )}
                <button type="button" onClick={() => controller?.close()} className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="close" aria-label="Close the concierge">
                  Close
                </button>
              </div>
            </div>

            <PieceInView />

            {/* voice stage */}
            {mode === 'voice' && <VoiceStage size={coarse ? 148 : 132} />}

            {/* transcript */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 md:px-7" data-lenis-prevent data-transcript>
              <ExchangeList latestOnly={mode === 'voice'} />
              {suggestionsVisible && (
                <div className="mt-8 flex flex-col gap-3">
                  <p className="micro text-fg-muted">{CONCIERGE.youMightAsk}</p>
                  {CONCIERGE.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => controller?.submitText(s, 'text')}
                      className="group/sug w-fit font-display italic text-[1.0625rem] text-fg-2 transition-colors hover:text-fg"
                      style={{ fontVariationSettings: '"opsz" 16' }}
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

            {/* composer + base links */}
            <div className="px-6 pb-5 md:px-7">
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
            <div className="hairline absolute inset-x-0 bottom-0 opacity-50" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* the piece under discussion, kept present while the rail covers the page's own column */}
      {null}

      {/* compact ticket (desktop): the associate steps aside */}
      <AnimatePresence>
        {open && panel === 'compact' && !coarse && lastLine && (
          <motion.button
            key="ticket"
            type="button"
            onClick={() => controller?.expand()}
            data-salon
            data-theme="dark"
            className="fixed bottom-[104px] right-7 flex w-[400px] items-start gap-4 bg-surface px-6 py-5 text-left text-fg lg:w-[452px] xl:w-[468px]"
            style={{ zIndex: 'var(--z-concierge)', boxShadow: 'var(--salon-shadow)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE.out } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
            aria-label="Return to the concierge"
          >
            <div className="hairline absolute inset-x-0 top-0 opacity-60" />
            <OrbStatic state={state} size={28} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2 font-display text-[0.9375rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 14' }}>
              {lastLine}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
