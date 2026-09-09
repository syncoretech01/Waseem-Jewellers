'use client';

import { isKnownSlug } from '@/data/clientIndex';
import { validateToolCall } from '../tools/validate';
import { completeSentences, enforceBrandRegister } from '../register';
import type { ConciergeProvider, ProviderCapabilities, ProviderRuntime, ToolName } from '../types';
import type { TurnSource } from '@/state/conciergeStore';

/**
 * The model, reached through our own server.
 *
 * The key never comes near this file. The browser posts a sentence and receives NDJSON frames
 * that map one-to-one onto `ProviderEvent`, executes any tools it is asked for — in the
 * browser, because the tools *are* browser actions — and posts the results back with the
 * signed continuation the server issued.
 *
 * Every tool call is validated again here even though the server validated it already. The
 * duplication is the point: this same path will carry the realtime data channel, which does
 * not pass through the server at all, and a validator that guarded only one of two doors is
 * not a boundary.
 */
export class ServerConciergeProvider implements ConciergeProvider {
  readonly id = 'openai-realtime' as const;
  readonly capabilities: ProviderCapabilities = { streaming: true, voice: 'none', contextPush: false };

  private runtime: ProviderRuntime | null = null;
  private aborts = new Map<string, AbortController>();

  attach(runtime: ProviderRuntime) {
    this.runtime = runtime;
  }

  async detach() {
    for (const a of this.aborts.values()) a.abort();
    this.aborts.clear();
    this.runtime = null;
  }

  cancelTurn(turnId?: string) {
    if (turnId) this.aborts.get(turnId)?.abort();
    else for (const a of this.aborts.values()) a.abort();
  }

  async submitText(text: string, opts: { turnId: string; source: TurnSource }): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) return;
    const { turnId } = opts;
    const abort = new AbortController();
    this.aborts.set(turnId, abort);
    runtime.emit({ type: 'turn.start', turnId });

    let continuation: string | undefined;
    let toolResults: { callId: string; name: string; result: unknown }[] | undefined;
    let spoken = '';
    let buffered = '';

    try {
      for (let round = 0; round < 4; round++) {
        const res = await fetch('/api/concierge/turn', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ turnId, text, context: runtime.getCurrentContext(), continuation, toolResults }),
          signal: abort.signal,
        });
        if (!res.ok || !res.body) throw new ProviderFailure('UPSTREAM', `turn ${res.status}`, spoken.length === 0);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let awaiting: string | undefined;
        const calls: { callId: string; name: ToolName; args: Record<string, unknown> }[] = [];

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const raw of lines) {
            if (!raw.trim()) continue;
            const frame = JSON.parse(raw) as { type: string; [k: string]: unknown };
            switch (frame.type) {
              case 'text.delta': {
                /**
                 * Deltas arrive mid-word. The register filter counts sentences, so applying
                 * it to a fragment would truncate one that had not finished arriving — the
                 * buffer holds back the tail until a sentence closes, which also gives the
                 * voice a whole first sentence to speak rather than half of one.
                 */
                buffered += String(frame.delta ?? '');
                const { ready, rest } = completeSentences(buffered);
                if (ready) {
                  const clean = enforceBrandRegister(ready);
                  if (clean && clean !== spoken) {
                    const delta = clean.startsWith(spoken) ? clean.slice(spoken.length) : clean;
                    spoken = clean;
                    runtime.emit({ type: 'text.delta', turnId, delta });
                  }
                  buffered = rest;
                }
                break;
              }
              case 'text.done': {
                const clean = enforceBrandRegister(String(frame.text ?? ''));
                spoken = clean;
                buffered = '';
                runtime.emit({ type: 'text.done', turnId, text: clean });
                break;
              }
              case 'tool.call': {
                const verdict = validateToolCall(String(frame.name), frame.args, { isKnownSlug, callsSoFar: calls.length });
                // the server already refused what it could; this catches the path it cannot see
                if (verdict.ok) calls.push({ callId: String(frame.callId), name: verdict.name, args: verdict.args });
                else runtime.emit({ type: 'tool.error', turnId, callId: String(frame.callId), message: verdict.error.message });
                break;
              }
              case 'await.tools':
                awaiting = String(frame.continuation);
                break;
              case 'turn.error':
                throw new ProviderFailure(String(frame.code ?? 'UPSTREAM'), String(frame.message ?? 'failed'), Boolean(frame.recoverable));
              default:
                break;
            }
          }
        }

        for (const call of calls) {
          runtime.emit({ type: 'tool.call', turnId, callId: call.callId, name: call.name, args: call.args });
          try {
            const outcome = await runtime.executeTool(call.name, call.args, { turnId, callId: call.callId });
            runtime.emit({ type: 'tool.result', turnId, callId: call.callId, outcome });
          } catch (err) {
            runtime.emit({ type: 'tool.error', turnId, callId: call.callId, message: err instanceof Error ? err.message : 'tool failed' });
          }
        }

        if (!awaiting || !calls.length) break;
        continuation = awaiting;
        toolResults = calls.map((c) => ({ callId: c.callId, name: c.name, result: { ok: true } }));
      }

      runtime.emit({ type: 'turn.done', turnId });
    } catch (err) {
      if (abort.signal.aborted) return;
      const failure = err instanceof ProviderFailure ? err : new ProviderFailure('UPSTREAM', 'the concierge is unavailable', spoken.length === 0);
      runtime.emit({ type: 'turn.error', turnId, message: failure.message, recoverable: failure.recoverable });
      throw failure;
    } finally {
      this.aborts.delete(turnId);
    }
  }
}

/** Carries whether the keyless engine may still answer this sentence without the visitor noticing. */
export class ProviderFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly recoverable: boolean,
  ) {
    super(message);
    this.name = 'ProviderFailure';
  }
}
