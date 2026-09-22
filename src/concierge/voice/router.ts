'use client';

import { planFor, readSentence, type Plan } from '../providers/mock/commands';
import { useConciergeStore } from '@/state/conciergeStore';
import { unknownWords, type ReplyLanguage } from '../replies';
import { factForOutcome, factForPlan } from './facts';
import type { IntentFrame } from '../nlu/parse';
import type { ProviderEvent, SiteContext, ToolName, ToolOutcome } from '../types';

/**
 * One router for the visitor's words, whichever way they arrived — spoken and delegated by
 * GPT-Live, or typed into the same conversation.
 *
 * Two rungs and nothing between them:
 *
 *   direct   the deterministic parser resolves the sentence with high confidence to an
 *            action the page can take at once — a department, an ordinal, back, a showroom
 *            while the form is open, compare, close — or to a fact it holds (the price is on
 *            request, the showrooms). No model is consulted; the site acts the moment the
 *            words are read, before any speech.
 *   complex  everything else — a natural sentence with qualifiers the lexicon does not
 *            carry ("elegant", "classy", "not too heavy"), a search of more than a few words,
 *            a sentence the parser cannot read — goes to the delegation model, grounded on
 *            the catalogue exactly as the typed concierge is.
 *
 * The lexicon is frozen; this file grows no vocabulary. What it decides is only which rung
 * answers, and the fact the voice model is told afterwards.
 */

export type Rung = 'direct' | 'astra';

export interface Route {
  rung: Rung;
  plan: Plan;
  frame: IntentFrame;
  language: ReplyLanguage;
  tokens: number;
  /** Words the parser did not know: the sign of a sentence with qualifiers. */
  unknown: string[];
  /** Why this rung, in a few words, for the QA trace. */
  why: string;
}

/** Plans that are an action on the page: always direct. */
const ACTIONS = new Set(['core_department', 'core_open', 'ordinal_open', 'named_open', 'named_fallback', 'deictic_open', 'back', 'compare', 'close', 'collection_named', 'bridal_route', 'gold_world', 'diamond_world', 'core_restart']);
/** Plans that answer from a fact the site holds: always direct. */
const FACTS = new Set(['greeting', 'core_greet', 'thanks', 'core_thanks', 'price', 'core_price', 'core_save', 'core_selection', 'saving_not_offered', 'selection_not_offered', 'showrooms', 'about_house', 'help', 'watches', 'out_of_scope', 'collections_overview', 'named_tell', 'deictic_tell', 'enquire']);
/** The appointment: direct while the sentence is a detail or a plain request; a long sentence carries more than the parser writes. */
const APPOINTMENT = new Set(['appointment_field', 'consultation', 'core_consultation']);
/** A search or a comparison: direct only when the sentence is plain — no unknown qualifier, a few words. */
const SEARCHES = new Set(['core_search', 'search', 'traditional', 'similar', 'core_similar', 'core_lighter', 'core_matching']);

const PLAIN_TOKENS = 6;
const APPOINTMENT_TOKENS = 8;

/**
 * GPT-Live may render one spoken Urdu conversation as Roman Urdu on one turn and Urdu script
 * on the next. Those are not a spoken language switch. Keep the established Urdu voice form
 * so a short follow-up cannot be reset by transcription orthography or by an English result.
 */
function stableSpokenLanguage(detected: ReplyLanguage, prior: ReplyLanguage | null): ReplyLanguage {
  const urduVoice = (language: ReplyLanguage | null) => language === 'ur' || language === 'ur-Latn';
  if (urduVoice(detected) && (prior === 'ur' || prior === 'ur-Latn')) return prior;
  return detected;
}

export function routeSentence(text: string, ctx: SiteContext): Route {
  const remembered = useConciergeStore.getState().memory.language;
  const prior = remembered === 'ur' || remembered === 'ur-Latn' ? remembered : null;
  const { frame, language: detectedLanguage, tokens } = readSentence(text);
  const language = stableSpokenLanguage(detectedLanguage, prior);
  const rawPlan = planFor(text, ctx);
  // `readSentence` remembers the script it just received. Restore the voice conversation's
  // established Urdu form after a transcript spelling change; the fact sent to Live remains
  // English data and must not decide this state.
  if (language !== useConciergeStore.getState().memory.language) useConciergeStore.getState().rememberLanguage(language);
  const plan = language === rawPlan.language ? rawPlan : { ...rawPlan, language };
  const unknown = unknownWords(frame);
  const n = tokens.length;
  const decide = (): { rung: Rung; why: string } => {
    // A deictic-led fragment is commonly the beginning of a natural thought: "Yeh bohat
    // heavy…". It must not open a piece if Live delegates before the transcript has settled.
    // A finished refinement remains direct; only an actual open verb earns a direct open.
    const hasOpenVerb = frame.intent === 'open' && frame.confidence >= 0.9;
    if (plan.id === 'core_open' && frame.slots.deictic && frame.slots.ordinal === undefined && !hasOpenVerb) {
      return { rung: 'astra', why: 'deictic-led natural sentence' };
    }
    if (ACTIONS.has(plan.id)) return { rung: 'direct', why: 'action' };
    if (FACTS.has(plan.id)) return { rung: 'direct', why: 'fact' };
    if (APPOINTMENT.has(plan.id)) return n <= APPOINTMENT_TOKENS ? { rung: 'direct', why: 'appointment' } : { rung: 'astra', why: 'appointment sentence with detail' };
    if (SEARCHES.has(plan.id)) {
      if (unknown.length) return { rung: 'astra', why: `qualifiers: ${unknown.join(' ')}` };
      if (n > PLAIN_TOKENS) return { rung: 'astra', why: `${n} words` };
      return { rung: 'direct', why: 'plain search' };
    }
    return { rung: 'astra', why: plan.id === 'clarify' ? 'below the floor' : 'not read' };
  };
  const { rung, why } = decide();
  return { rung, plan, frame, language, tokens: n, unknown, why };
}

export interface DirectDeps {
  executeTool(name: ToolName, args: Record<string, unknown>): Promise<ToolOutcome>;
  emit(event: ProviderEvent): void;
  context(): SiteContext;
  turnId: string;
}

export interface DirectResult {
  /** The English fact for the voice model. */
  fact: string;
  /** The keyless engine's own sentence, in the visitor's language, for the written exchange. */
  reply: string;
  tools: string[];
  outcomes: ToolOutcome[];
}

/**
 * The direct rung: the plan's tools through the validator and the page, in order, with the
 * events every provider emits — then the fact. A plan with a retry (the same search with the
 * standing topic set aside) runs it only when the first brought nothing.
 */
export async function runDirect(plan: Plan, deps: DirectDeps): Promise<DirectResult> {
  const outcomes: ToolOutcome[] = [];
  const facts: string[] = [];
  const tools: string[] = [];
  // "close" is a sentence in the keyless engine and a tool here: the panel closes after the goodbye
  const calls = plan.id === 'close' && plan.tools.length === 0 ? [{ name: 'closeConcierge' as ToolName, args: {} }] : plan.tools;
  const run = async (list: Plan['tools']) => {
    for (const call of list) {
      const callId = `${deps.turnId}-t${outcomes.length}`;
      tools.push(call.name);
      deps.emit({ type: 'tool.call', turnId: deps.turnId, callId, name: call.name, args: call.args });
      try {
        const outcome = await deps.executeTool(call.name, call.args);
        outcomes.push(outcome);
        deps.emit({ type: 'tool.result', turnId: deps.turnId, callId, outcome });
        facts.push(factForOutcome(call.name, call.args, outcome, deps.context()));
      } catch (e) {
        deps.emit({ type: 'tool.error', turnId: deps.turnId, callId, message: e instanceof Error ? e.message : 'tool failed' });
        outcomes.push({ result: { error: 'TOOL_FAILED' }, label: '' });
        facts.push('The page could not do that. Say in one short sentence what the visitor can do instead.');
      }
    }
  };
  await run(calls);
  if (plan.retry && !outcomes.some((o) => o.ui?.kind === 'pieces' && o.ui.pieces.length > 0)) {
    facts.length = 0;
    await run(plan.retry);
    if (facts.length) facts[facts.length - 1] = `${facts[facts.length - 1]} (The stricter conditions were set aside to find these; say so in a few words.)`;
  }
  const ctx = deps.context();
  const said = factForPlan(plan, ctx);
  const fact = facts.length ? facts.join(' ') : (said ?? 'Done.');
  const reply = plan.reply(outcomes, ctx);
  return { fact, reply, tools, outcomes };
}
