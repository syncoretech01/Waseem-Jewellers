'use client';

import { useConciergeStore } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { Orb } from '../orb/Orb';
import { CONCIERGE } from '../copy';
import { MicGlyph } from '@/components/collection/CollectionExperience';
import { cn } from '@/lib/cn';

const STATUS: Partial<Record<string, string>> = {
  VOICE_READY: CONCIERGE.voice.ready,
  LISTENING: CONCIERGE.voice.listening,
  THINKING: CONCIERGE.voice.thinking,
  EXECUTING_ACTION: CONCIERGE.voice.executing,
  SPEAKING: CONCIERGE.voice.speaking,
  RESULT: '',
};

/** The voice stage: the orb, the live transcript beneath it, the mic ring, "Let me show you". */
export function VoiceStage({ size = 168 }: { size?: number }) {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const transcript = useConciergeStore((s) => s.transcript);
  const recognition = useConciergeStore((s) => s.voice.recognition);
  const adapter = useConciergeStore((s) => s.voice.adapter);
  const error = useConciergeStore((s) => s.error);
  const listening = state === 'LISTENING';
  const status = error && state !== 'LISTENING' ? error.message : STATUS[state] ?? '';

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <Orb state={state} size={size} stage />
      <div className="flex min-h-[3.25rem] flex-col items-center gap-2 text-center">
        <p className="micro text-fg-muted" aria-live="polite">
          {status}
        </p>
        {(transcript.interim || transcript.active) && (
          <p className="max-w-[26em] font-display italic text-[1.0625rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
            {adapter === 'scripted' && transcript.interim && <span className="micro mr-2 not-italic text-fg-muted">{CONCIERGE.youMightSay}</span>}
            {transcript.interim}
            {transcript.active && <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-gold-hi/70 align-middle" />}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-pressed={listening}
        aria-label={listening ? CONCIERGE.voice.stop : recognition ? CONCIERGE.voice.start : CONCIERGE.letMeShowYou}
        onClick={() => (listening ? controller?.stopListening() : recognition ? controller?.startListening() : controller?.runExample())}
        className={cn(
          'inline-flex h-14 w-14 items-center justify-center rounded-full border transition-colors duration-500 md:h-12 md:w-12',
          listening ? 'border-gold-hi text-gold-hi' : 'border-line-strong text-fg-2 hover:border-gold-hi hover:text-fg',
        )}
      >
        <MicGlyph className="h-4 w-4" />
      </button>
      {recognition ? (
        <button type="button" onClick={() => controller?.runExample()} className="micro text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
          {CONCIERGE.letMeShowYou}
        </button>
      ) : (
        <p className="micro text-fg-muted">{CONCIERGE.letMeShowYou}</p>
      )}
    </div>
  );
}
