'use client';

import { useSyncExternalStore } from 'react';
import type { TurnTrace } from './types';

/**
 * The hidden QA view of the voice: what was heard, written where only a tester looks.
 *
 * A visitor never sees a transcript of their own words — a wrong reading printed back is
 * worse than a wrong reading acted on and corrected in one breath. The words are still kept
 * (the session, the tools, the trace and the tests all read them), and a tester can show
 * them with `?qa=1` on the URL or `window.__wjConciergeQA = true` in the console. Off by
 * default on every build, including development.
 */
export function qaMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__wjConciergeQA) return true;
  try {
    return new URLSearchParams(window.location.search).get('qa') === '1';
  } catch {
    return false;
  }
}

// ── the turn trace: which engine answered, and why ───────────────────────────

/**
 * The last few turns' traces — the rung that answered, why a fallback happened, the
 * language read, the intent, the tool. Recorded on every build because it is a few bytes
 * and a harness reads it; shown only in the QA view. Never a customer-facing string.
 */
export interface QaEntry extends TurnTrace {
  turnId: string;
  at: number;
}

const MAX = 40;
let entries: QaEntry[] = [];
const listeners = new Set<() => void>();

export function recordTrace(turnId: string, trace: TurnTrace) {
  entries = [...entries, { ...trace, turnId, at: Date.now() }].slice(-MAX);
  for (const fn of listeners) fn();
}

export const qaTrace = (): readonly QaEntry[] => entries;

/** One line of the trace, for the stage and the exchange in QA mode. */
export function describeTrace(t: QaEntry | undefined): string {
  if (!t) return '';
  const bits = [`rung ${t.rung}`, t.fallback ? `fallback: ${t.fallback}` : null, t.language ? `language ${t.language}` : null, t.intent ? `intent ${t.intent}` : null, t.plan ? `plan ${t.plan}` : null, t.tool ? `tool ${t.tool}` : null, t.note ?? null];
  return bits.filter(Boolean).join(' · ');
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const empty: readonly QaEntry[] = [];

/** The trace, for a component in QA mode; the same empty list on the server and before any turn. */
export function useQaTrace(): readonly QaEntry[] {
  return useSyncExternalStore(subscribe, qaTrace, () => empty);
}

declare global {
  interface Window {
    __wjConciergeQA?: boolean;
  }
}
