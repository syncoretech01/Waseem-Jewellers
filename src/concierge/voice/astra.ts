'use client';

import { isKnownSlug } from '@/data/clientIndex';
import { useConciergeStore } from '@/state/conciergeStore';
import { projectMemory } from '../memory';
import { validateToolCall } from '../tools/validate';
import type { ProviderEvent, SiteContext, ToolName, ToolOutcome } from '../types';

/**
 * The complex rung: the delegation model, reached through our own server.
 *
 * The browser posts the visitor's words, the page state, the bounded memory projection and
 * the last few spoken lines; the server grounds the sentence on the catalogue exactly as it
 * does for a typed one, and the model acts with the one tool registry. Browser tools come
 * back as frames and are executed here — validated again, because this side of the wire has
 * its own gate — and their real outcomes go back with the signed continuation. What returns
 * is one English line of facts for the voice model.
 */

export interface AstraDeps {
  executeTool(name: ToolName, args: Record<string, unknown>): Promise<ToolOutcome>;
  emit(event: ProviderEvent): void;
  context(): SiteContext;
  turnId: string;
  /** The recent spoken exchange, oldest first. */
  history: { role: 'visitor' | 'concierge'; text: string }[];
  signal?: AbortSignal;
}

export interface AstraResult {
  ok: boolean;
  fact: string;
  tools: string[];
  outcomes: ToolOutcome[];
  /** The server's note: model, effort, tier. */
  note: string;
  /** The failure, verbatim, when `ok` is false. */
  error?: string;
}

const MAX_ROUNDS = 4;

export async function runAstra(text: string, deps: AstraDeps): Promise<AstraResult> {
  let continuation: string | undefined;
  let toolResults: { callId: string; name: string; result: unknown }[] | undefined;
  const tools: string[] = [];
  const outcomes: ToolOutcome[] = [];
  const notes: string[] = [];
  let fact = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let res: Response;
    try {
      res = await fetch('/api/concierge/delegate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          turnId: deps.turnId,
          text,
          mode: 'voice',
          context: deps.context(),
          memory: projectMemory(useConciergeStore.getState().memory, useConciergeStore.getState().turnCount, Date.now()),
          history: deps.history,
          continuation,
          toolResults,
        }),
        signal: deps.signal ?? AbortSignal.timeout(40_000),
      });
    } catch (e) {
      return { ok: false, fact: '', tools, outcomes, note: notes.join(' · '), error: e instanceof Error ? e.message : 'fetch failed' };
    }
    if (!res.ok || !res.body) return { ok: false, fact: '', tools, outcomes, note: notes.join(' · '), error: `delegate ${res.status}` };

    const frames = (await res.text())
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as { type: string; [k: string]: unknown });
    let awaiting: string | undefined;
    const calls: { callId: string; name: ToolName; args: Record<string, unknown> }[] = [];
    for (const frame of frames) {
      switch (frame.type) {
        case 'text.done':
          fact = String(frame.text ?? '');
          break;
        case 'turn.trace':
          notes.push(String(frame.note ?? ''));
          break;
        case 'tool.call': {
          const verdict = validateToolCall(String(frame.name), frame.args, { isKnownSlug, callsSoFar: calls.length });
          if (verdict.ok) calls.push({ callId: String(frame.callId), name: verdict.name, args: verdict.args });
          else deps.emit({ type: 'tool.error', turnId: deps.turnId, callId: String(frame.callId), message: verdict.error.message });
          break;
        }
        case 'await.tools':
          awaiting = String(frame.continuation);
          break;
        case 'turn.error':
          return { ok: false, fact: '', tools, outcomes, note: notes.join(' · '), error: `${String(frame.code ?? 'UPSTREAM')}: ${String(frame.message ?? '')}` };
        default:
          break;
      }
    }

    const results: { callId: string; name: ToolName; result: unknown }[] = [];
    for (const call of calls) {
      tools.push(call.name);
      deps.emit({ type: 'tool.call', turnId: deps.turnId, callId: call.callId, name: call.name, args: call.args });
      try {
        const outcome = await deps.executeTool(call.name, call.args);
        outcomes.push(outcome);
        deps.emit({ type: 'tool.result', turnId: deps.turnId, callId: call.callId, outcome });
        results.push({ callId: call.callId, name: call.name, result: outcome.result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'tool failed';
        deps.emit({ type: 'tool.error', turnId: deps.turnId, callId: call.callId, message });
        results.push({ callId: call.callId, name: call.name, result: { error: 'TOOL_FAILED', message } });
      }
    }
    if (!awaiting) break;
    continuation = awaiting;
    toolResults = results;
  }
  return { ok: true, fact, tools, outcomes, note: notes.join(' · ') };
}
