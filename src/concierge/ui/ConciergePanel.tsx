'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useConciergeStore, OPEN_STATES } from '@/state/conciergeStore';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { useController } from '../useConcierge';
import { ExchangeList } from './Exchange';
import { Composer } from './Composer';
import { VoiceStage } from './VoiceStage';
import { OrbStatic } from '../orb/OrbStatic';
import { CONCIERGE } from '../copy';
import { TravellingLight } from '@/components/ui/primitives';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

/**
 * Desktop: a floating spatial panel above the jewel, unfolding upward from its base hairline.
 * Mobile: a full-screen, voice-first sheet. Opaque ink (pearl over ivory chapters); no bubbles.
 */
export function ConciergePanel() {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const mode = useConciergeStore((s) => s.mode);
  const panel = useConciergeStore((s) => s.panel);
  const turns = useConciergeStore((s) => s.turns);
  const spoken = useConciergeStore((s) => s.voice.spokenReplies);
  const menuOpen = useSiteStore((s) => s.menuOpen);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const open = OPEN_STATES.includes(state) && panel !== 'closed' && !menuOpen;
  const full = open && panel === 'full';
  const root = useRef<HTMLDivElement>(null);
  const suggestionsVisible = mode === 'chat' && turns.filter((t) => t.role === 'visitor').length === 0;
  const lastLine = [...turns].reverse().find((t) => t.role === 'concierge' && t.text)?.text ?? '';

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
            key="panel"
            ref={root}
            role="dialog"
            aria-modal={coarse ? 'true' : 'false'}
            aria-label={CONCIERGE.name}
            data-lenis-prevent
            className={cn(
              'fixed flex flex-col bg-surface text-fg shadow-none',
              'inset-0 md:inset-auto md:bottom-[104px] md:right-7 md:h-[min(640px,calc(100dvh-140px))] md:w-[min(400px,calc(100vw-48px))]',
            )}
            style={{ zIndex: 'var(--z-concierge)', paddingBottom: 'var(--kb, 0px)' }}
            initial={reduced ? { opacity: 0 } : { clipPath: 'inset(100% 0 0 0)' }}
            animate={reduced ? { opacity: 1, transition: { duration: 0.25 } } : { clipPath: 'inset(0% 0 0 0)', transition: { duration: 0.7, ease: EASE.out } }}
            exit={reduced ? { opacity: 0, transition: { duration: 0.2 } } : { clipPath: 'inset(100% 0 0 0)', transition: { duration: 0.4, ease: EASE.silk } }}
            onAnimationComplete={() => controller?.opened()}
          >
            <div className="hairline absolute inset-x-0 top-0 opacity-70" />
            <div className="pointer-events-none absolute inset-x-0 top-px h-16 bg-gradient-to-b from-champagne/[0.06] to-transparent" />

            {/* masthead */}
            <div className="flex items-start justify-between px-6 pb-4 pt-6 md:px-7">
              <div className="flex items-center gap-4">
                <OrbStatic state={mode === 'voice' ? 'CHAT' : state} size={28} />
                <div>
                  <p className="micro text-fg">{CONCIERGE.name}</p>
                  <p className="font-display italic text-[0.8125rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
                    {CONCIERGE.sub}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <button type="button" onClick={() => controller?.setMode(mode === 'voice' ? 'chat' : 'voice')} className="micro text-fg-muted transition-colors hover:text-fg">
                  {mode === 'voice' ? 'Write' : 'Speak'}
                </button>
                <button type="button" onClick={() => controller?.close()} className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="close" aria-label="Close the concierge">
                  Close
                </button>
              </div>
            </div>

            {/* voice stage */}
            {mode === 'voice' && (
              <div className="px-6 md:px-7">
                <VoiceStage size={coarse ? 176 : 168} />
              </div>
            )}

            {/* transcript */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-2 md:px-7" data-lenis-prevent data-transcript>
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
              <Composer autoFocus={!coarse && mode === 'chat'} />
              <div className="mt-4 flex items-center justify-between">
                <div className="micro flex gap-5 text-fg-muted">
                  <button type="button" onClick={() => controller?.toggleSpokenReplies()} className={cn('transition-colors hover:text-fg', spoken && 'text-fg-2')} aria-pressed={spoken}>
                    {CONCIERGE.spokenReplies}
                  </button>
                  <button type="button" onClick={() => controller?.forget()} className="transition-colors hover:text-fg">
                    {CONCIERGE.beginAgain}
                  </button>
                </div>
                <TravellingLight active={state === 'THINKING' || state === 'EXECUTING_ACTION'} className="w-10" />
              </div>
            </div>
            <div className="hairline absolute inset-x-0 bottom-0 opacity-50" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* compact ticket (desktop): the associate steps aside */}
      <AnimatePresence>
        {open && panel === 'compact' && !coarse && lastLine && (
          <motion.button
            key="ticket"
            type="button"
            onClick={() => controller?.expand()}
            className="fixed bottom-[104px] right-7 flex w-[360px] items-start gap-4 bg-surface px-5 py-4 text-left text-fg"
            style={{ zIndex: 'var(--z-concierge)' }}
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
