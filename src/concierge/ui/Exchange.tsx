'use client';

import { useEffect, useRef } from 'react';
import { useConciergeStore, type ConciergeTurn, type TurnResult } from '@/state/conciergeStore';
import { TravellingLight } from '@/components/ui/primitives';
import { getRow } from '@/data/clientIndex';
import { useController } from '../useConcierge';
import { CONCIERGE } from '../copy';
import { factsOf } from './cards/PieceTile';
import { cn } from '@/lib/cn';

/** The `lang` a line should carry so Urdu takes its Nastaliq face and a screen reader its voice. */
export function langOf(language: string | null): string | undefined {
  switch (language) {
    case 'ur':
      return 'ur';
    case 'ur-Latn':
      return 'ur-Latn';
    case 'pa-Arab':
      return 'pa-Arab';
    case 'pa-Guru':
      return 'pa';
    case 'en':
      return 'en';
    default:
      return undefined;
  }
}

/** The transcript as an editorial script: the visitor's lines set small, the concierge's set large. */
export function ExchangeList({ latestOnly = false }: { latestOnly?: boolean }) {
  const allTurns = useConciergeStore((s) => s.turns);
  // a reply the visitor spoke over before it had a word — nothing said, nothing done — leaves no empty line
  const settled = allTurns.filter((t) => t.role === 'visitor' || t.streaming || t.text || t.tools?.length || t.result);
  const turns = latestOnly ? latestExchange(settled) : settled;
  const error = useConciergeStore((s) => s.error);
  const state = useConciergeStore((s) => s.state);
  const language = useConciergeStore((s) => s.memory.language);
  // the tray opening inside the sheet shortens this scroller; the end must stay in view
  const trayOpen = useConciergeStore((s) => s.trayOpen);
  const controller = useController();
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef(0);
  const lastText = turns[turns.length - 1]?.text;
  const lang = langOf(language);

  /**
   * Follow the newest line — but not against the visitor. A new turn always brings the end
   * into view; a reply that streams for a few seconds used to drag a reader who had scrolled
   * up back to the bottom on every word, so streamed words follow only while the reader is
   * already within a line of the end.
   */
  useEffect(() => {
    const scroller = end.current?.closest<HTMLElement>('[data-transcript]');
    if (!scroller) return;
    if (latestOnly) {
      scroller.scrollTop = 0;
      return;
    }
    const newTurn = turns.length !== seen.current;
    seen.current = turns.length;
    const nearEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
    if (newTurn || nearEnd || error || trayOpen) scroller.scrollTop = scroller.scrollHeight;
  }, [turns.length, lastText, error, latestOnly, trayOpen]);

  return (
    <div className="flex flex-col gap-10">
      {turns.map((t, i) => (
        <Exchange key={t.id} turn={t} first={i === 0} live={i === turns.length - 1 && t.role === 'concierge'} lang={lang} />
      ))}
      {state === 'THINKING' && (
        <div className="flex items-center gap-4">
          <TravellingLight active />
          <span className="font-display italic text-[0.9375rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 14' }}>
            {CONCIERGE.voice.thinking}
          </span>
        </div>
      )}
      {error && state === 'ERROR' && (
        <p className="font-display text-[1.25rem] leading-[1.45] text-fg" style={{ fontVariationSettings: '"opsz" 20' }}>
          {error.code === 'PROVIDER' || error.code === 'TOOL' ? (
            <>
              Forgive me —{' '}
              <button type="button" className="italic underline decoration-line-strong underline-offset-4 hover:decoration-gold-hi" onClick={() => controller?.retry()}>
                shall we try that once more?
              </button>
            </>
          ) : (
            error.message
          )}
        </p>
      )}
      <div ref={end} />
    </div>
  );
}

/** The last visitor line and everything the concierge said after it (or the greeting alone). */
function latestExchange(turns: ConciergeTurn[]): ConciergeTurn[] {
  let i = turns.length - 1;
  while (i > 0 && turns[i]?.role !== 'visitor') i--;
  return turns.slice(Math.max(0, i));
}

function Exchange({ turn, first, live, lang }: { turn: ConciergeTurn; first: boolean; live?: boolean; lang?: string }) {
  if (turn.role === 'visitor') {
    return (
      <p className={cn('flex items-baseline gap-3', !first && 'pt-1')}>
        <span className="micro shrink-0 text-fg-muted">You</span>
        {/* the visitor may have written in any of five languages; the browser decides which way it runs */}
        <span dir="auto" lang={lang} className="text-[0.9375rem] leading-snug text-fg-2">
          {turn.text}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {turn.tools?.filter((t) => t.status !== 'done').map((tool) => (
        <div key={tool.id} className="flex items-center gap-4">
          <TravellingLight active={tool.status === 'running'} className={cn(tool.status === 'error' && 'bg-burgundy')} />
          {tool.label && (
            <span className={cn('font-display italic text-[0.9375rem]', tool.status === 'error' ? 'text-burgundy' : 'text-fg-muted')} style={{ fontVariationSettings: '"opsz" 14' }}>
              {tool.label}
            </span>
          )}
        </div>
      ))}
      {turn.text && (
        <p
          dir="auto"
          lang={lang}
          {...(live ? { role: 'status' as const, 'aria-live': 'polite' as const } : {})}
          className="font-display text-[1.25rem] leading-[1.45] text-fg"
          style={{ fontVariationSettings: '"opsz" 20' }}
        >
          {turn.text}
        </p>
      )}
      {turn.result && <Result result={turn.result} />}
    </div>
  );
}

/**
 * The rail names the pieces; the vitrine shows them. The ordinals stay because "open the
 * second one" needs something to count, and each name opens its piece — but nothing here
 * competes with the jewellery on the tray.
 */
function Result({ result }: { result: TurnResult }) {
  const controller = useController();
  if (result.kind === 'pieces' || result.kind === 'wishlist') {
    if (result.pieces.length === 0) return null;
    return (
      <ol className="mt-1 flex flex-col gap-2" aria-label={result.kind === 'pieces' ? result.title : 'Your selection'}>
        {result.pieces.slice(0, 6).map((p) => {
          const row = getRow(p.slug);
          const facts = factsOf(row);
          const priced = row ? row.p > 0 : false;
          return (
            <li key={p.slug} className="flex items-baseline gap-3">
              <span className="font-display text-[0.75rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
                {String(p.ordinal).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => controller?.tapCard(p.slug, p.name)}
                className="flex flex-1 items-baseline justify-between gap-4 text-left outline-none transition-colors hover:text-fg focus-visible:underline focus-visible:decoration-gold-hi"
                aria-label={`Open ${p.name}${priced ? `, ${p.priceLabel.toLowerCase()}` : ''}`}
                data-cursor="view"
              >
                <span dir="auto" className="font-display text-[1.0625rem] leading-snug text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
                  {p.name}
                </span>
                <span className="shrink-0 text-[0.8125rem] text-fg-muted">{priced ? p.priceLabel : facts}</span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  }
  if (result.kind === 'compare') {
    return (
      <p className="micro text-fg-muted">
        {CONCIERGE.labels.compareDone} · <span className="text-fg-2">{result.pieces.map((p) => p.name).join(' · ')}</span>
      </p>
    );
  }
  if (result.kind === 'collection') {
    return (
      <p className="micro text-fg-muted">
        Now viewing · <span className="text-fg-2">{result.collection.name}</span>
      </p>
    );
  }
  if (result.kind === 'collections') {
    return (
      <ol className="mt-1 flex flex-col gap-1.5">
        {result.collections.map((c) => (
          <li key={c.slug} className="flex items-baseline gap-3">
            <span className="font-display text-[0.75rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
              {String(c.ordinal).padStart(2, '0')}
            </span>
            <button type="button" className="text-left font-display text-[1.0625rem] text-fg transition-colors hover:text-fg-2" style={{ fontVariationSettings: '"opsz" 16' }} onClick={() => controller?.submitText(`Show me ${c.name}`, 'card')} data-cursor="explore">
              {c.name}
            </button>
          </li>
        ))}
      </ol>
    );
  }
  if (result.kind === 'house') {
    return <p className="display mt-1 text-[2.25rem] text-fg-2">1952</p>;
  }
  if (result.kind === 'consultation') {
    return <p className="micro text-fg-muted">The appointment form is open beside you.</p>;
  }
  if (result.kind === 'piece') {
    const verb = result.verb === 'saved' ? 'Kept' : result.verb === 'removed' ? 'Set aside' : result.verb === 'opened' ? 'Now viewing' : 'In view';
    return (
      <p className="micro text-fg-muted">
        {verb} · <span className="text-fg-2">{result.piece.name}</span>
      </p>
    );
  }
  return null;
}
