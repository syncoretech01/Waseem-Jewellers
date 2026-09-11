'use client';

import { useConciergeStore } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { Orb } from '../orb/Orb';
import { CONCIERGE } from '../copy';
import { MicGlyph } from '@/components/ui/MicGlyph';
import { TravellingLight } from '@/components/ui/primitives';
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
function statusLine(v: { state: string; preparing: boolean; denied: boolean; recognition: boolean; voiced: boolean; error: string | null; toolLabel: string }) {
  const atRest = v.state === 'VOICE_READY' || v.state === 'CHAT' || v.state === 'ERROR';
  if (v.preparing) return CONCIERGE.voice.preparing;
  if (v.denied && atRest) return CONCIERGE.micDenied;
  if (v.error && v.state !== 'LISTENING') return v.error;
  if (!v.recognition && atRest) return CONCIERGE.voice.unavailable;
  if (v.state === 'EXECUTING_ACTION' && v.toolLabel) return v.toolLabel;
  if (v.state === 'SPEAKING' && !v.voiced) return CONCIERGE.voice.answering;
  return STATUS[v.state] ?? '';
}

/**
 * The voice stage: a well with its own ground, the jewel set inside the house's hairline ring,
 * and the state of the exchange written beneath it as a stage direction. Every one of the nine
 * voice conditions says what it is in words — the orb alone is never the only signal.
 */
export function VoiceStage({ size = 132 }: { size?: number }) {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const transcript = useConciergeStore((s) => s.transcript);
  const recognition = useConciergeStore((s) => s.voice.recognition);
  const adapter = useConciergeStore((s) => s.voice.adapter);
  const preparing = useConciergeStore((s) => s.voice.preparing);
  const denied = useConciergeStore((s) => s.voice.denied);
  const voiced = useConciergeStore((s) => s.voice.spokenReplies && s.voice.synthesis);
  const toolLabel = useConciergeStore((s) => s.activeTool?.label ?? '');
  const error = useConciergeStore((s) => s.error);
  const listening = state === 'LISTENING';
  const working = state === 'THINKING' || state === 'EXECUTING_ACTION';
  const heard = working && Boolean(transcript.final);
  const status = statusLine({ state, preparing, denied, recognition, voiced, error: error?.message ?? null, toolLabel });
  const micLabel = denied
    ? CONCIERGE.voice.deniedLabel
    : preparing
      ? CONCIERGE.voice.preparingLabel
      : listening
        ? CONCIERGE.voice.stop
        : CONCIERGE.voice.start;
  const ring = Math.round(size * 1.62);

  return (
    <div className="flex flex-col gap-5 border-b border-line px-6 py-7 md:px-7" style={{ background: 'var(--salon-well)' }}>
      <div className="flex flex-col items-center gap-4">
        <span className="relative inline-flex items-center justify-center" style={{ width: ring, height: ring }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="50" cy="50" r="49.5" fill="none" stroke="var(--line)" strokeWidth="0.4" />
            <circle
              cx="50"
              cy="50"
              r="49.5"
              fill="none"
              stroke="#e4cfa3"
              strokeWidth="0.4"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="12 88"
              className={listening || preparing ? 'wj-ring-light' : 'opacity-0'}
            />
          </svg>
          <Orb state={state} size={size} stage />
        </span>
        <p className={cn('micro flex items-center justify-center gap-3 text-center', denied ? 'text-fg-2' : 'text-fg-muted')} aria-live="polite">
          {(preparing || working) && <TravellingLight active className="w-8" />}
          <span>{status}</span>
        </p>
      </div>

      <div className="flex min-h-[3.25rem] items-start justify-center">
        {(transcript.interim || transcript.active || heard) && (
          <p className="max-w-[24em] text-center font-display italic text-[1.1875rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 18' }}>
            {heard ? (
              <span className="micro mr-2 not-italic text-fg-muted">{CONCIERGE.heard}</span>
            ) : (
              adapter === 'scripted' && transcript.interim && <span className="micro mr-2 not-italic text-fg-muted">{CONCIERGE.youMightSay}</span>
            )}
            {heard ? transcript.final : transcript.interim}
            {transcript.active && !heard && <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-gold-hi/70 align-middle" />}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4">
        {recognition ? (
          <button
            type="button"
            aria-pressed={listening}
            aria-label={micLabel}
            disabled={preparing || denied || working}
            onClick={() => (listening ? controller?.stopListening() : controller?.startListening())}
            className={cn(
              'relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-500 disabled:cursor-default',
              listening ? 'border-gold-hi text-gold-hi' : 'border-line-strong text-fg-2',
              !listening && !preparing && !denied && !working && 'hover:border-gold-hi hover:text-fg',
              (preparing || working) && 'opacity-45',
              denied && 'border-line text-fg-muted opacity-70',
            )}
          >
            <MicGlyph className="h-4 w-4" />
            {denied && <span aria-hidden className="absolute left-3 right-3 top-1/2 h-px -rotate-45 bg-line-strong" />}
          </button>
        ) : (
          <span aria-hidden />
        )}
        <button
          type="button"
          onClick={() => controller?.runExample()}
          className={cn(
            'underline-offset-4 transition-colors hover:text-fg hover:underline',
            recognition && !denied ? 'micro text-fg-muted' : 'font-display italic text-[1.0625rem] text-fg-2',
          )}
          style={recognition && !denied ? undefined : { fontVariationSettings: '"opsz" 16' }}
        >
          {CONCIERGE.letMeShowYou}
        </button>
      </div>
    </div>
  );
}
