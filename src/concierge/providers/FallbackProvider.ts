'use client';

import { MockConciergeProvider } from './MockConciergeProvider';
import { ProviderFailure, ServerConciergeProvider } from './ServerConciergeProvider';
import type { ConciergeProvider, ProviderCapabilities, ProviderRuntime } from '../types';
import type { TurnSource } from '@/state/conciergeStore';

/**
 * All the fallback logic, in one place, so nothing else has to know there are two engines.
 *
 * **The rule that makes shipping the model dark safe:** any recoverable failure *before the
 * first word has been shown* re-runs the same sentence through the keyless engine, under
 * the same outward `turnId`. `CONCIERGE_OFFLINE`, `RATE_LIMITED`, `UPSTREAM` and `TIMEOUT`
 * are all invisible to the visitor — they get an answer, from the engine that could give
 * one.
 *
 * Invisible to the visitor, never to the record. Every fallback is announced on the turn's
 * trace with the code and message that caused it, so the QA view and the harnesses can say
 * which engine answered and why — a fallback nobody can see is a fault nobody can find.
 *
 * Once a word has been shown the fallback stops, because two engines finishing the same
 * sentence differently is worse than one engine stopping. That is what `recoverable` carries.
 *
 * The keyless engine is not a degraded mode here. It owns twelve actions outright and answers
 * them identically either way; what the model adds is phrasing and judgement outside those
 * twelve. So a fallback changes how an answer reads, not what happens in the room.
 */
export class FallbackProvider implements ConciergeProvider {
  /**
   * It reports whichever engine is actually answering. Until the first turn resolves that is
   * the model, because that is what will be tried; once the server says there is no key it
   * latches to the keyless engine and says so.
   */
  get id() {
    return this.modelOffline ? ('keyless' as const) : ('server-model' as const);
  }

  get capabilities(): ProviderCapabilities {
    return this.modelOffline ? this.keyless.capabilities : this.model.capabilities;
  }

  private readonly model = new ServerConciergeProvider();
  private readonly keyless = new MockConciergeProvider();
  private runtime: ProviderRuntime | null = null;
  /** Latched for the session once the server says there is no model: no point asking again. */
  private modelOffline = false;
  /**
   * An upstream refusal — the account out of credit, a rate limit — is not asked again for a
   * while. Each attempt costs the visitor a round trip before the keyless engine answers, and
   * the answer will not change in the next minute. The pause is recorded on every turn it
   * covers, with the failure that began it.
   */
  private pausedUntil = 0;
  private pausedWhy = '';
  private static readonly PAUSE_MS = 90_000;

  attach(runtime: ProviderRuntime) {
    this.runtime = runtime;
    this.model.attach(runtime);
    this.keyless.attach(runtime);
  }

  async detach() {
    await Promise.all([this.model.detach(), this.keyless.detach()]);
  }

  cancelTurn(turnId?: string) {
    this.model.cancelTurn(turnId);
    this.keyless.cancelTurn(turnId);
  }

  async submitText(text: string, opts: { turnId: string; source: TurnSource }): Promise<void> {
    const trace = (fallback: string) => this.runtime?.emit({ type: 'turn.trace', turnId: opts.turnId, trace: { rung: 'keyless', fallback } });
    if (this.modelOffline) {
      trace('CONCIERGE_OFFLINE: no model configured on this deployment');
      return this.keyless.submitText(text, opts);
    }
    if (Date.now() < this.pausedUntil) {
      trace(`model paused after ${this.pausedWhy} (${Math.round((this.pausedUntil - Date.now()) / 1000)} s left)`);
      return this.keyless.submitText(text, opts);
    }
    try {
      await this.model.submitText(text, opts);
    } catch (err) {
      const failure = err instanceof ProviderFailure ? err : null;
      if (failure?.code === 'CONCIERGE_OFFLINE') this.modelOffline = true;
      if (failure && (failure.code === 'UPSTREAM' || failure.code === 'RATE_LIMITED')) {
        this.pausedUntil = Date.now() + FallbackProvider.PAUSE_MS;
        this.pausedWhy = `${failure.code}: ${failure.message}`;
      }
      if (!failure || !failure.recoverable) throw err;
      // the same sentence, the same turn: the visitor never learns this happened — the trace does
      trace(`${failure.code}: ${failure.message}`);
      await this.keyless.submitText(text, opts);
    }
  }
}
