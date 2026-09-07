'use client';

import { useEffect, useRef } from 'react';
import { useConciergeStore, type ConciergeTurn, type TurnResult } from '@/state/conciergeStore';
import { TravellingLight } from '@/components/ui/primitives';
import { useController } from '../useConcierge';
import { CONCIERGE } from '../copy';
import { cn } from '@/lib/cn';

/** The transcript as an editorial script: stage directions for the visitor, serif lines for the concierge. */
export function ExchangeList({ latestOnly = false }: { latestOnly?: boolean }) {
  const allTurns = useConciergeStore((s) => s.turns);
  const turns = latestOnly ? latestExchange(allTurns) : allTurns;
  const error = useConciergeStore((s) => s.error);
  const state = useConciergeStore((s) => s.state);
  const controller = useController();
  const end = useRef<HTMLDivElement>(null);
  const lastText = turns[turns.length - 1]?.text;

  useEffect(() => {
    const scroller = end.current?.closest<HTMLElement>('[data-transcript]');
    if (scroller) scroller.scrollTop = latestOnly ? 0 : scroller.scrollHeight;
  }, [turns.length, lastText, error, latestOnly]);

  return (
    <div className="flex flex-col gap-7" aria-live="off">
      {turns.map((t, i) => (
        <Exchange key={t.id} turn={t} first={i === 0} />
      ))}
      {state === 'THINKING' && (
        <div className="flex items-center gap-4">
          <TravellingLight active />
          <span className="font-display italic text-[0.8125rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 12' }}>
            {CONCIERGE.voice.thinking}
          </span>
        </div>
      )}
      {error && state === 'ERROR' && (
        <p className="font-display text-[1.0625rem] leading-[1.55] text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
          {error.code === 'PROVIDER' || error.code === 'TOOL' ? (
            <>
              Forgive me —{' '}
              <button type="button" className="italic underline underline-offset-4 decoration-line-strong hover:decoration-gold-hi" onClick={() => controller?.retry()}>
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

function Exchange({ turn, first }: { turn: ConciergeTurn; first: boolean }) {
  if (turn.role === 'visitor') {
    return (
      <div className={cn('flex flex-col gap-3', !first && 'border-t border-line pt-6')}>
        <p className="flex items-baseline gap-2 text-fg-muted">
          <span className="micro text-fg-2">You —</span>
          <span className="text-[0.8125rem] leading-snug">{turn.text}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {turn.tools?.map((tool) => (
        <div key={tool.id} className="flex items-center gap-4">
          <TravellingLight active={tool.status === 'running'} className={cn(tool.status === 'done' && 'bg-gold-hi/70', tool.status === 'error' && 'bg-burgundy')} />
          {tool.label && (
            <span className={cn('font-display italic text-[0.8125rem]', tool.status === 'error' ? 'text-burgundy' : 'text-fg-muted')} style={{ fontVariationSettings: '"opsz" 12' }}>
              {tool.label}
            </span>
          )}
        </div>
      ))}
      {turn.text && (
        <p className="font-display text-[1.0625rem] leading-[1.55] text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
          {turn.text}
        </p>
      )}
      {turn.result && <Result result={turn.result} />}
    </div>
  );
}

function Result({ result }: { result: TurnResult }) {
  const controller = useController();
  if (result.kind === 'pieces' || result.kind === 'wishlist') {
    if (result.pieces.length === 0) return null;
    return (
      <ol className="mt-1 flex gap-3" aria-label={result.kind === 'pieces' ? result.title : 'Your selection'}>
        {result.pieces.slice(0, 4).map((p) => (
          <li key={p.slug}>
            <button
              type="button"
              onClick={() => controller?.tapCard(p.slug, p.name)}
              className="group/recap relative block h-14 w-11 overflow-hidden bg-bg-2 outline-none focus-visible:ring-1 focus-visible:ring-gold-hi"
              aria-label={`Open ${p.name}`}
              data-cursor="view"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover/recap:scale-105" loading="lazy" />
              <span className="absolute bottom-0.5 left-1 font-display text-[0.6875rem] text-ivory drop-shadow" style={{ fontVariationSettings: '"opsz" 12' }}>
                {String(p.ordinal).padStart(2, '0')}
              </span>
            </button>
          </li>
        ))}
      </ol>
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
      <ol className="mt-1 flex flex-col gap-1">
        {result.collections.map((c) => (
          <li key={c.slug} className="micro flex items-baseline gap-3 text-fg-muted">
            <span className="font-display text-[0.75rem] text-fg-2" style={{ fontVariationSettings: '"opsz" 12' }}>
              {String(c.ordinal).padStart(2, '0')}
            </span>
            <button type="button" className="text-left transition-colors hover:text-fg" onClick={() => controller?.submitText(`Show me ${c.name}`, 'card')}>
              {c.name}
            </button>
          </li>
        ))}
      </ol>
    );
  }
  if (result.kind === 'house') {
    return (
      <p className="display mt-1 text-[2.25rem] text-fg-2">1952</p>
    );
  }
  if (result.kind === 'consultation') {
    return <p className="micro text-fg-muted">The consultation form is open beside you.</p>;
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
