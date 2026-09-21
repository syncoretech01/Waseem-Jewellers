import type { ConciergeProvider, ProviderCapabilities, ProviderRuntime } from '../types';
import type { TurnSource } from '@/state/conciergeStore';
import { planFor, introFor } from './mock/commands';
import { useQualityStore } from '@/state/qualityStore';
import { useConciergeStore } from '@/state/conciergeStore';
import { synthesisSupported } from '../voice/speech';

function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The keyless concierge: an ordered command table (≈ ten convincing commands),
 * deterministic latency so THINKING → EXECUTING → SPEAKING are visible, and the
 * same event stream a model provider would emit. Nothing here touches the DOM.
 */
export class MockConciergeProvider implements ConciergeProvider {
  readonly id = 'keyless' as const;
  /**
   * Deterministic, and named as such. It streams because the controller wants deltas either
   * way, and its speech is the browser's, exactly as the model path's is.
   */
  readonly capabilities: ProviderCapabilities = { streaming: true, voice: 'browser', contextPush: false, intelligence: 'deterministic' };
  private runtime: ProviderRuntime | null = null;
  private timers = new Set<number>();
  private cancelled = new Set<string>();

  attach(runtime: ProviderRuntime) {
    this.runtime = runtime;
  }

  async detach() {
    this.clearTimers();
    this.runtime = null;
  }

  cancelTurn(turnId?: string) {
    if (turnId) this.cancelled.add(turnId);
    this.clearTimers();
  }

  private clearTimers() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.clear();
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, ms);
      this.timers.add(id);
    });
  }

  async submitText(text: string, opts: { turnId: string; source: TurnSource }) {
    const rt = this.runtime;
    if (!rt) return;
    const { turnId } = opts;
    const reduced = useQualityStore.getState().tier === 'REDUCED';
    const ctx = rt.getCurrentContext();
    const emit = (e: Parameters<ProviderRuntime['emit']>[0]) => {
      if (!this.cancelled.has(turnId)) rt.emit(e);
    };

    emit({ type: 'turn.start', turnId });

    // a special opening: ENQUIRE on a product ("Tell me about this piece")
    let plan = planFor(text, ctx);
    const lower = text.toLowerCase();
    const inView = ctx.currentProduct ?? ctx.focusedProduct;
    if (/tell me about this piece/.test(lower) && inView) {
      plan = { id: 'enquire', tools: [], reply: () => introFor(inView.slug) };
    }

    await this.wait(reduced ? 300 : 520 + (fnv1a(text) % 320));
    if (this.cancelled.has(turnId)) return;

    const outcomes = [];
    for (let i = 0; i < plan.tools.length; i++) {
      const call = plan.tools[i]!;
      const callId = `${turnId}-t${i}`;
      emit({ type: 'tool.call', turnId, callId, name: call.name, args: call.args });
      try {
        const outcome = await rt.executeTool(call.name, call.args, { turnId, callId });
        outcomes.push(outcome);
        emit({ type: 'tool.result', turnId, callId, outcome });
      } catch (e) {
        emit({ type: 'tool.error', turnId, callId, message: e instanceof Error ? e.message : 'tool failed' });
        outcomes.push({ result: { error: true }, label: '' });
      }
      await this.wait(180);
      if (this.cancelled.has(turnId)) return;
    }

    const reply = plan.reply(outcomes, rt.getCurrentContext());
    emit({ type: 'text.ready', turnId, text: reply });

    if (reduced) {
      emit({ type: 'text.delta', turnId, delta: reply });
    } else {
      const words = reply.split(' ');
      // spoken pace only when the reply is actually being voiced; otherwise the words arrive at reading pace
      const voice = ctx.mode === 'voice' && useConciergeStore.getState().voice.spokenReplies && synthesisSupported();
      const cadence = voice ? Math.max(32, ((words.length / 2.6) * 1000) / words.length) : 32;
      for (let i = 0; i < words.length; i++) {
        if (this.cancelled.has(turnId)) return;
        emit({ type: 'text.delta', turnId, delta: (i ? ' ' : '') + words[i] });
        await this.wait(cadence);
      }
    }
    emit({ type: 'text.done', turnId, text: reply });
    emit({ type: 'turn.done', turnId });
  }
}
