'use client';

import { MockConciergeProvider } from './MockConciergeProvider';
import { ProviderFailure, ServerConciergeProvider } from './ServerConciergeProvider';
import type { ConciergeProvider, ProviderCapabilities, ProviderRuntime } from '../types';
import type { TurnSource } from '@/state/conciergeStore';

/**
 * All the fallback logic, in one place, so nothing else has to know there are two engines.
 *
 * **The rule that makes shipping the model dark safe:** any recoverable failure *before the
 * first word has been shown* silently re-runs the same sentence through the keyless engine,
 * under the same outward `turnId`. `CONCIERGE_OFFLINE`, `RATE_LIMITED`, `UPSTREAM` and
 * `TIMEOUT` are all invisible to the visitor — they get an answer, from the engine that could
 * give one.
 *
 * Once a word has been shown the fallback stops, because two engines finishing the same
 * sentence differently is worse than one engine stopping. That is what `recoverable` carries.
 *
 * The keyless engine is not a degraded mode here. It owns twelve actions outright and answers
 * them identically either way; what the model adds is phrasing and judgement outside those
 * twelve. So a fallback changes how an answer reads, not what happens in the room.
 */
export class FallbackProvider implements ConciergeProvider {
  readonly id = 'mock' as const;
  readonly capabilities: ProviderCapabilities = { streaming: true, voice: 'none', contextPush: false };

  private readonly model = new ServerConciergeProvider();
  private readonly keyless = new MockConciergeProvider();
  /** Latched for the session once the server says there is no model: no point asking again. */
  private modelOffline = false;

  attach(runtime: ProviderRuntime) {
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
    if (this.modelOffline) return this.keyless.submitText(text, opts);
    try {
      await this.model.submitText(text, opts);
    } catch (err) {
      const failure = err instanceof ProviderFailure ? err : null;
      if (failure?.code === 'CONCIERGE_OFFLINE') this.modelOffline = true;
      if (!failure || !failure.recoverable) throw err;
      // the same sentence, the same turn: the controller never learns this happened
      await this.keyless.submitText(text, opts);
    }
  }
}
