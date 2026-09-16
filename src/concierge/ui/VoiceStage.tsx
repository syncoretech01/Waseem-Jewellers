'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useConciergeStore, type ConciergeState } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { voiceMeter } from '../voice/meter';
import { CONCIERGE } from '../copy';
import { WaseemMark } from '@/components/brand/WaseemMark';
import { MicGlyph } from '@/components/ui/MicGlyph';
import { TravellingLight } from '@/components/ui/primitives';
import { langOf } from './Exchange';
import { cn } from '@/lib/cn';

const STATUS: Partial<Record<string, string>> = {
  VOICE_READY: CONCIERGE.voice.ready,
  LISTENING: CONCIERGE.voice.listening,
  THINKING: CONCIERGE.voice.thinking,
  EXECUTING_ACTION: CONCIERGE.voice.executing,
  SPEAKING: CONCIERGE.voice.speaking,
  RESULT: CONCIERGE.voice.result,
};

/** One sentence for every voice condition, in the order the visitor most needs to hear it. */
function statusLine(v: { state: string; preparing: boolean; transcribing: boolean; denied: boolean; recognition: boolean; voiced: boolean; error: string | null; toolLabel: string; adapter: string | null; interrupted: boolean; fallback: string | null }) {
  const atRest = v.state === 'VOICE_READY' || v.state === 'CHAT' || v.state === 'ERROR';
  if (v.preparing) return CONCIERGE.voice.preparing;
  if (v.transcribing && (v.state === 'LISTENING' || v.state === 'THINKING' || v.state === 'VOICE_READY')) return CONCIERGE.voice.hearing;
  if (v.denied && atRest) return CONCIERGE.micDenied;
  if (v.error && v.state !== 'LISTENING') return v.error;
  // the sentence that was lost with a rung is asked for again on the microphone that just opened
  if (v.error && v.state === 'LISTENING' && v.fallback) return v.error;
  if (!v.recognition && atRest) return CONCIERGE.voice.unavailable;
  if (v.state === 'LISTENING' && v.interrupted) return CONCIERGE.voice.interrupted;
  if (v.state === 'LISTENING' && v.adapter === 'scripted') return CONCIERGE.youMightSay.replace(/ —$/, '');
  // a rung down from the best hearing on offer: said plainly, in the visitor's words
  if (v.state === 'LISTENING' && v.fallback) return CONCIERGE.voice.listeningFallback;
  if (v.state === 'EXECUTING_ACTION' && v.toolLabel) return v.toolLabel;
  if (v.state === 'SPEAKING' && !v.voiced) return CONCIERGE.voice.answering;
  if (v.state === 'SPEAKING' && v.recognition) return `${CONCIERGE.voice.speaking} ${CONCIERGE.voice.tapToInterrupt.toLowerCase()}.`;
  return STATUS[v.state] ?? '';
}

/**
 * The ring: a hairline circle with the crest at its centre, and a second circle that breathes
 * with the voice — the visitor's while listening, the concierge's while speaking. No sphere,
 * no waveform; the geometry is the mark's own, and the only light is the listening arc.
 */
function VoiceRing({ state, size, active }: { state: ConciergeState; size: number; active: boolean }) {
  const breath = useRef<HTMLSpanElement>(null);
  const thinking = state === 'THINKING' || state === 'EXECUTING_ACTION';

  // the effect owns the breath's opacity in every state — React re-applies an inline style only
  // when its value changes, so a value cleared here would otherwise stay cleared through the next states
  useEffect(() => {
    const el = breath.current;
    if (!el) return;
    const rest = state === 'RESULT' ? 0.6 : 0.28;
    if (state !== 'LISTENING' && state !== 'SPEAKING') {
      gsap.set(el, { clearProps: 'transform', opacity: rest });
      return;
    }
    const setScale = gsap.quickSetter(el, 'scale');
    const setOpacity = gsap.quickSetter(el, 'opacity');
    const tick = () => {
      const level = state === 'LISTENING' ? voiceMeter.level : voiceMeter.speech;
      setScale(1 + level * 0.42);
      setOpacity(0.28 + level * 0.65);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gsap.set(el, { clearProps: 'transform', opacity: rest });
    };
  }, [state]);

  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-hidden data-voice-ring={state}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r="49.5" fill="none" stroke="var(--line-strong)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="49.5" fill="none" stroke="var(--color-gold-hi)" strokeWidth="0.7" strokeLinecap="round" pathLength="100" strokeDasharray="14 86" className={active ? 'wj-ring-light' : 'opacity-0'} />
      </svg>
      <span
        ref={breath}
        className="absolute inset-[16%] rounded-full border border-gold-hi"
        style={{ animation: thinking ? 'breathe 1.6s ease-in-out infinite' : undefined }}
      />
      <WaseemMark variant="crest" tone="current" title={null} className="h-[36%] w-auto text-fg" />
    </span>
  );
}

/**
 * The voice stage: the ring, the state of the exchange written beneath it in words, and what
 * was heard set large. Every condition the visitor can be in says what it is — heard, thinking,
 * bringing, speaking, interrupted, denied — the ring alone is never the only signal.
 */
export function VoiceStage({ compact = false }: { compact?: boolean }) {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const transcript = useConciergeStore((s) => s.transcript);
  const recognition = useConciergeStore((s) => s.voice.recognition);
  const adapter = useConciergeStore((s) => s.voice.adapter);
  const preparing = useConciergeStore((s) => s.voice.preparing);
  const transcribing = useConciergeStore((s) => s.voice.transcribing);
  const denied = useConciergeStore((s) => s.voice.denied);
  const voiced = useConciergeStore((s) => s.voice.spokenReplies && s.voice.synthesis);
  const toolLabel = useConciergeStore((s) => s.activeTool?.label ?? '');
  const error = useConciergeStore((s) => s.error);
  const fallback = useConciergeStore((s) => s.voice.fallback);
  const language = useConciergeStore((s) => s.memory.language);
  const listening = state === 'LISTENING';
  const speaking = state === 'SPEAKING';
  const working = state === 'THINKING' || state === 'EXECUTING_ACTION';
  // what was heard stays on the stage through the whole answer, so a mishearing can be corrected while it is still fresh
  const heard = (working || speaking || state === 'RESULT') && Boolean(transcript.final);
  const correctable = heard && !transcript.active;

  const status = statusLine({ state, preparing, transcribing, denied, recognition, voiced, error: error?.message ?? null, toolLabel, adapter, interrupted: transcript.interrupted, fallback });
  const micLabel = denied ? CONCIERGE.voice.deniedLabel : preparing ? CONCIERGE.voice.preparingLabel : listening ? CONCIERGE.voice.stop : speaking ? CONCIERGE.voice.tapToInterrupt : CONCIERGE.voice.start;
  const size = compact ? 104 : 128;
  const text = heard ? transcript.final : transcript.interim;

  return (
    <div className={cn('flex flex-col items-center gap-5', compact ? 'px-6 pb-5 pt-5' : 'px-8 pb-6 pt-7')}>
      <VoiceRing state={state} size={size} active={listening || preparing} />

      <p className={cn('flex items-center justify-center gap-3 text-center font-display italic text-[0.9375rem]', denied ? 'text-fg-2' : 'text-fg-muted')} style={{ fontVariationSettings: '"opsz" 14' }} aria-live="polite">
        {(preparing || transcribing || working) && <TravellingLight active className="w-8" />}
        <span>{status}</span>
      </p>

      <div className={cn('flex w-full flex-col items-center justify-start gap-3', (transcript.interim || transcript.active || heard) && (compact ? 'min-h-[3rem]' : 'min-h-[4rem]'))}>
        {(transcript.interim || transcript.active || heard) && (
          <p dir="auto" lang={langOf(language)} className={cn('max-w-[22em] text-center font-display italic leading-snug text-fg', compact ? 'text-[1.1875rem]' : 'text-[1.375rem]')} style={{ fontVariationSettings: '"opsz" 22' }}>
            {heard && <span className="micro mr-2 not-italic text-fg-muted">{CONCIERGE.heard}</span>}
            {text}
            {transcript.active && !heard && <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-gold-hi/70 align-middle" />}
          </p>
        )}
        {/* a mishearing is corrected here, not endured: the words go back to the composer, or the microphone opens again */}
        {correctable && (
          <p className="micro flex items-center gap-4 text-fg-muted">
            <span>{CONCIERGE.voice.notQuite}</span>
            <button type="button" onClick={() => controller?.editHeard()} className="underline-offset-4 transition-colors hover:text-fg hover:underline">
              {CONCIERGE.voice.editHeard}
            </button>
            <button type="button" onClick={() => controller?.retryHearing()} className="underline-offset-4 transition-colors hover:text-fg hover:underline">
              {CONCIERGE.voice.retry}
            </button>
          </p>
        )}
      </div>

      <div className={cn('flex w-full items-center justify-center whitespace-nowrap', compact ? 'gap-6' : 'gap-8')}>
        <button type="button" onClick={() => controller?.setMode('chat')} className="micro text-fg-muted transition-colors hover:text-fg">
          {CONCIERGE.voice.write}
        </button>
        {recognition ? (
          <button
            type="button"
            aria-pressed={listening}
            aria-label={micLabel}
            disabled={preparing || working}
            onClick={() => (listening ? controller?.stopListening() : controller?.startListening())}
            className={cn(
              'relative inline-flex h-12 w-12 items-center justify-center rounded-full border transition-colors duration-500',
              listening ? 'border-gold-hi text-gold-hi' : 'border-line-strong text-fg-2',
              !listening && !preparing && !denied && !working && 'hover:border-gold-hi hover:text-fg',
              (preparing || working) && 'opacity-45',
              denied && 'border-line text-fg-muted opacity-70',
            )}
            data-cursor="listen"
            data-cursor-text={micLabel}
          >
            <MicGlyph className="h-4 w-4" />
            {denied && <span aria-hidden className="absolute left-3 right-3 top-1/2 h-px -rotate-45 bg-line-strong" />}
          </button>
        ) : (
          <span aria-hidden className="h-12 w-12" />
        )}
        <button type="button" onClick={() => controller?.runExample()} className="micro text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
          {CONCIERGE.letMeShowYou}
        </button>
      </div>
    </div>
  );
}
