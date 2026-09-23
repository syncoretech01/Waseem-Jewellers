'use client';

import { useEffect, useRef, useState } from 'react';
import { useConciergeStore, BUSY_STATES } from '@/state/conciergeStore';
import { useController } from '../useConcierge';
import { CONCIERGE } from '../copy';
import { MicGlyph } from '@/components/ui/MicGlyph';
import { cn } from '@/lib/cn';

/** A single hairline-underlined serif field with the mic ring as the only glyph. */
export function Composer({ autoFocus = false }: { autoFocus?: boolean }) {
  const controller = useController();
  const state = useConciergeStore((s) => s.state);
  const micAvailable = useConciergeStore((s) => s.voice.recognition && !s.voice.denied);
  const busy = BUSY_STATES.includes(state);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!controller) return;
    return controller.onDraft((d) => {
      setDraft(d);
      input.current?.focus();
    });
  }, [controller]);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const send = () => {
    if (!draft.trim() || !controller) return;
    controller.submitText(draft, 'text');
    setDraft('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-end gap-5 pt-2"
    >
      <label className="flex-1">
        <span className="sr-only">Your message to the concierge</span>
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={CONCIERGE.composerPlaceholder}
          /* Urdu and Shahmukhi run right to left; the field follows what is typed into it */
          dir="auto"
          className="w-full border-b border-line-strong bg-transparent py-2.5 font-display text-[1.125rem] text-fg placeholder:text-fg-muted/70 focus:border-b-2 focus:border-gold-hi focus:outline-none"
          style={{ fontVariationSettings: '"opsz" 18' }}
          autoComplete="off"
          enterKeyHint="send"
        />
      </label>
      {draft.trim() ? (
        <button type="submit" disabled={busy} aria-label="Send" className="pb-3 font-display text-[1.125rem] text-fg-2 transition-colors hover:text-fg disabled:opacity-40">
          →
        </button>
      ) : !micAvailable ? (
        <button
          type="button"
          onClick={() => controller?.runExample()}
          className="mb-2 whitespace-nowrap font-display italic text-[1.0625rem] text-fg-2 underline-offset-4 transition-colors hover:text-fg hover:underline"
          style={{ fontVariationSettings: '"opsz" 16' }}
        >
          {CONCIERGE.letMeShowYou}
        </button>
      ) : (
        <button
          type="button"
          aria-label={CONCIERGE.voice.start}
          onClick={() => {
            controller?.setMode('voice');
            controller?.startListening();
          }}
          className={cn('mb-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-fg-2 transition-colors hover:border-gold-hi hover:text-fg')}
          data-cursor="listen"
        >
          <MicGlyph className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
