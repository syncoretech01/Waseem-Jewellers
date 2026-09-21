'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useConciergeStore, type ConciergeState } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { voiceMeter } from '../voice/meter';
import { CONCIERGE } from '../copy';
import { replies } from '../replies';
import { describeTrace, qaMode, useQaTrace } from '../qa';
import { WaseemMark } from '@/components/brand/WaseemMark';
import { MicGlyph } from '@/components/ui/MicGlyph';
import { TravellingLight } from '@/components/ui/primitives';
import { langOf } from './Exchange';
import { cn } from '@/lib/cn';

/**
 * What the stage says, in two lines: a small label naming which of the five things is
 * happening — LISTENING · THINKING · BRINGING IT TO YOU · SPEAKING · TRY AGAIN — and one
 * sentence beneath it in the display face. Never the visitor's own words: a transcript is
 * kept for the conversation and the tests, and shown only in the QA view.
 */
interface Status {
  label: string;
  line: string;
  /** The next thing to press beneath the line, beyond the two that always wait below the ring: Write instead, Let me show you. */
  actions: ('tryAgain' | 'write')[];
  busy: boolean;
  lit: boolean;
}

function statusOf(v: { state: string; preparing: boolean; transcribing: boolean; denied: boolean; recognition: boolean; error: string | null; toolLabel: string; adapter: string | null; interrupted: boolean; fallback: string | null; writeOffered: boolean }): Status {
  const S = CONCIERGE.voice.state;
  const atRest = v.state === 'VOICE_READY' || v.state === 'CHAT' || v.state === 'ERROR';
  if (v.preparing) return { label: S.preparing, line: CONCIERGE.voice.preparing, actions: [], busy: true, lit: true };
  if (v.transcribing && (v.state === 'LISTENING' || v.state === 'THINKING' || v.state === 'VOICE_READY')) return { label: S.thinking, line: CONCIERGE.voice.hearing, actions: [], busy: true, lit: false };
  // the microphone is refused or absent: said as its own state, with writing and the example beneath the ring
  if (v.denied && atRest) return { label: S.micOff, line: CONCIERGE.micDenied, actions: [], busy: false, lit: false };
  // a fault at rest is the TRY AGAIN state: the line says what happened, the action says what to do —
  // and after a second sentence in a row that was not understood, writing is offered as the action
  if (v.error && v.state !== 'LISTENING') return { label: S.tryAgain, line: v.error, actions: v.writeOffered ? (v.recognition ? ['write', 'tryAgain'] : ['write']) : v.recognition ? ['tryAgain'] : [], busy: false, lit: false };
  // the sentence that was lost with a rung is asked for again on the microphone that just opened
  if (v.error && v.state === 'LISTENING' && v.fallback) return { label: S.listening, line: v.error, actions: [], busy: false, lit: true };
  if (!v.recognition && atRest) return { label: S.micOff, line: CONCIERGE.voice.unavailable, actions: [], busy: false, lit: false };
  switch (v.state) {
    case 'LISTENING':
      return {
        label: S.listening,
        line: v.interrupted ? CONCIERGE.voice.interrupted : v.adapter === 'scripted' ? CONCIERGE.youMightSay.replace(/ —$/, '') : v.fallback ? CONCIERGE.voice.listeningFallback : CONCIERGE.voice.listening,
        actions: [],
        busy: false,
        lit: true,
      };
    case 'THINKING':
      return { label: S.thinking, line: CONCIERGE.voice.thinking, actions: [], busy: true, lit: false };
    case 'EXECUTING_ACTION':
      return { label: S.bringing, line: v.toolLabel || CONCIERGE.voice.executing, actions: [], busy: true, lit: false };
    case 'RESULT':
      return { label: S.bringing, line: CONCIERGE.voice.result, actions: [], busy: false, lit: false };
    case 'SPEAKING':
      return { label: S.speaking, line: v.adapter === 'realtime' || v.adapter === 'server' ? CONCIERGE.voice.speakingInterruptible : `${CONCIERGE.voice.speaking} ${CONCIERGE.voice.tapToInterrupt}.`, actions: [], busy: false, lit: false };
    default:
      return { label: S.ready, line: CONCIERGE.voice.ready, actions: [], busy: false, lit: false };
  }
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
      <span ref={breath} className="absolute inset-[16%] rounded-full border border-gold-hi" style={{ animation: thinking ? 'breathe 1.6s ease-in-out infinite' : undefined }} />
      <WaseemMark variant="crest" tone="current" title={null} className="h-[36%] w-auto text-fg" />
    </span>
  );
}

/**
 * The voice stage: the ring, the state named in a small label, one sentence beneath it, and
 * the next thing to press whenever something did not work. The visitor's words are never
 * printed here — a misheard sentence written back is worse than one acted on and corrected
 * in a breath — and the ring alone is never the only signal.
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
  const toolLabel = useConciergeStore((s) => s.activeTool?.label ?? '');
  const error = useConciergeStore((s) => s.error);
  const fallback = useConciergeStore((s) => s.voice.fallback);
  const language = useConciergeStore((s) => s.memory.language);
  const listening = state === 'LISTENING';
  const speaking = state === 'SPEAKING';
  const working = state === 'THINKING' || state === 'EXECUTING_ACTION';
  const qa = qaMode();
  const trace = useQaTrace();
  const R = replies(language);

  const status = statusOf({ state, preparing, transcribing, denied, recognition, error: error?.message ?? null, toolLabel, adapter, interrupted: transcript.interrupted, fallback, writeOffered: error?.message === R.writeInstead });
  const micLabel = denied ? CONCIERGE.voice.deniedLabel : preparing ? CONCIERGE.voice.preparingLabel : listening ? CONCIERGE.voice.stop : speaking ? CONCIERGE.voice.tapToInterrupt : CONCIERGE.voice.start;
  const size = compact ? 104 : 128;
  const heard = transcript.final || transcript.interim;


  return (
    <div className={cn('flex flex-col items-center', compact ? 'gap-4 px-6 pb-5 pt-4' : 'gap-5 px-8 pb-6 pt-6')} data-voice-stage data-voice-status={status.label}>
      <VoiceRing state={state} size={size} active={listening || preparing} />

      <div className="flex flex-col items-center gap-2 text-center" aria-live="polite">
        <p className={cn('micro flex items-center gap-3 transition-colors duration-500', status.lit ? 'text-gold-hi' : status.label === CONCIERGE.voice.state.tryAgain ? 'text-fg-2' : 'text-fg-muted')}>
          {status.busy && <TravellingLight active className="w-7" />}
          <span>{status.label}</span>
        </p>
        <p className={cn('max-w-[24em] font-display italic leading-snug text-fg', compact ? 'text-[1.125rem]' : 'text-[1.25rem]')} style={{ fontVariationSettings: '"opsz" 20' }}>
          {status.line}
        </p>
        {status.actions.length > 0 && (
          <p className="mt-1 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1.5" data-next-steps>
            {status.actions.map((a, i) => (
              <button
                key={a}
                type="button"
                onClick={() => (a === 'write' ? controller?.setMode('chat') : controller?.retryHearing())}
                className={cn('font-display text-[1rem] underline-offset-[5px] transition-colors hover:text-fg-2', i === 0 ? 'text-fg underline decoration-gold-hi' : 'text-fg-2 hover:underline')}
                style={{ fontVariationSettings: '"opsz" 16' }}
                data-cursor={a === 'write' ? 'ask' : 'listen'}
                lang={langOf(language)}
              >
                {a === 'write' ? R.actions.write : R.actions.tryAgain}
              </button>
            ))}
          </p>
        )}
        {/* the QA view alone shows what was heard; a visitor is never shown a reading of their own words */}
        {qa && heard && (
          <p dir="auto" lang={langOf(language)} className="micro mt-1 max-w-[26em] normal-case tracking-normal text-fg-muted" data-qa-heard>
            heard — {heard}
          </p>
        )}
        {/* the QA view alone: which engine answered, and why — never a customer-facing line */}
        {qa && trace.length > 0 && (
          <p className="micro mt-1 max-w-[30em] normal-case tracking-normal text-fg-muted" data-qa-trace>
            {describeTrace(trace[trace.length - 1])}
          </p>
        )}
      </div>

      <div className={cn('flex w-full items-center justify-center whitespace-nowrap', compact ? 'gap-6' : 'gap-9')}>
        <button type="button" onClick={() => controller?.setMode('chat')} className="micro shrink-0 text-fg-muted transition-colors hover:text-fg" lang={langOf(language)}>
          {R.actions.write}
        </button>
        {recognition ? (
          <button
            type="button"
            aria-pressed={listening}
            aria-label={micLabel}
            disabled={preparing || working}
            onClick={() => (listening ? controller?.stopListening() : controller?.startListening())}
            onPointerEnter={() => controller?.warmVoice()}
            className={cn(
              'relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors duration-500',
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
          <span aria-hidden className="h-12 w-12 shrink-0" />
        )}
        <button type="button" onClick={() => controller?.runExample()} className="micro shrink-0 text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
          {CONCIERGE.letMeShowYou}
        </button>
      </div>
    </div>
  );
}
