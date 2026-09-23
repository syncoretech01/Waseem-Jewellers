import type { ConciergeProvider, ProviderCapabilities, ProviderRuntime, ToolOutcome } from '../types';
import type { TurnSource } from '@/state/conciergeStore';
import { planFor, introFor, type Plan } from './mock/commands';
import { replies } from '../replies';
import { useQualityStore } from '@/state/qualityStore';

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
 *
 * The beat before the first tool is short: the arguments of a keyless plan are complete the
 * moment the sentence is read, and the action is what the visitor is waiting for. It used to
 * be half a second and more, spent for nothing but the look of thinking.
 */
export class MockConciergeProvider implements ConciergeProvider {
  readonly id = 'keyless' as const;
  /**
   * Deterministic, and named as such. It streams because the controller wants deltas either
   * way; it writes only and never owns browser audio.
   */
  readonly capabilities: ProviderCapabilities = { streaming: true, voice: 'none', contextPush: false, intelligence: 'deterministic' };
  private runtime: ProviderRuntime | null = null;
  private timers = new Set<number>();
  private cancelled = new Set<string>();
  /**
   * Consecutive sentences the engine did not understand. The first is answered with one
   * short question; the second with the offer to write instead — never the same question
   * twice in a row, and never a list of what the concierge can do.
   */
  private unknownStreak = 0;

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
    let plan: Plan = planFor(text, ctx);
    const lower = text.toLowerCase();
    const inView = ctx.currentProduct ?? ctx.focusedProduct;
    if (/tell me about this piece/.test(lower) && inView) {
      plan = { id: 'enquire', language: plan.language, tools: [], reply: () => introFor(inView.slug, plan.language) };
    }

    const unknown = plan.id === 'unknown' || plan.id === 'clarify';
    this.unknownStreak = unknown ? this.unknownStreak + 1 : 0;
    if (unknown && this.unknownStreak >= 2) {
      const R = replies(plan.language);
      // the second time: in the voice, the offer to write; in writing, the same question in other words
      plan = { ...plan, id: 'unknown.again', reply: () => (ctx.mode === 'voice' ? R.writeInstead : R.clarifyAgain) };
    }

    emit({ type: 'turn.trace', turnId, trace: { rung: 'keyless', language: plan.language, intent: plan.intent ?? plan.id, plan: plan.id, tool: plan.tools.map((t) => t.name).join(',') || undefined } });

    await this.wait(reduced ? 120 : 200 + (fnv1a(text) % 160));
    if (this.cancelled.has(turnId)) return;

    /**
     * The one word, said as the action starts. It is the first thing the voice speaks and the
     * first thing the exchange shows, and the page moves under it; for an action command it
     * is the whole reply.
     */
    const ack = plan.ack && plan.tools.length ? plan.ack : '';
    if (ack) {
      emit({ type: 'text.ready', turnId, text: ack });
      emit({ type: 'text.delta', turnId, delta: ack });
    }

    const outcomes: ToolOutcome[] = [];
    const run = async (calls: Plan['tools']) => {
      for (const call of calls) {
        const callId = `${turnId}-t${outcomes.length}`;
        emit({ type: 'tool.call', turnId, callId, name: call.name, args: call.args });
        try {
          const outcome = await rt.executeTool(call.name, call.args, { turnId, callId });
          outcomes.push(outcome);
          emit({ type: 'tool.result', turnId, callId, outcome });
        } catch (e) {
          emit({ type: 'tool.error', turnId, callId, message: e instanceof Error ? e.message : 'tool failed' });
          outcomes.push({ result: { error: true }, label: '' });
        }
        await this.wait(120);
        if (this.cancelled.has(turnId)) return false;
      }
      return true;
    };
    if (!(await run(plan.tools))) return;
    // the same request, widened, when the first brought nothing
    if (plan.retry && !outcomes.some((o) => o.ui?.kind === 'pieces' && o.ui.pieces.length > 0)) {
      if (!(await run(plan.retry))) return;
    }

    const rest = plan.reply(outcomes, rt.getCurrentContext());
    const reply = [ack, rest].filter(Boolean).join(' ');
    if (!ack && rest) emit({ type: 'text.ready', turnId, text: rest });

    if (rest) {
      if (reduced) {
        emit({ type: 'text.delta', turnId, delta: (ack ? ' ' : '') + rest });
      } else {
        const words = rest.split(' ');
        // the words arrive at reading pace: nothing on this path speaks them
        const cadence = 32;
        for (let i = 0; i < words.length; i++) {
          if (this.cancelled.has(turnId)) return;
          emit({ type: 'text.delta', turnId, delta: (i || ack ? ' ' : '') + words[i] });
          await this.wait(cadence);
        }
      }
    }
    emit({ type: 'text.done', turnId, text: reply });
    emit({ type: 'turn.done', turnId });
  }
}
