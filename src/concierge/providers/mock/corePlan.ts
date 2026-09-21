import type { IntentFrame } from '../../nlu/parse';
import { carriedKeys, hasSubject, subjectOf, topicIsLive, withStandingTopic } from '../../memory';
import { useConciergeStore } from '@/state/conciergeStore';
import { nextAck, replies, subjectIn, unknownWords, type ReplyLanguage } from '../../replies';
import { appointmentReply } from './commands';
import type { SiteContext, ToolName, ToolOutcome } from '../../types';
import type { Plan } from './commands';
import { resolveOrdinal } from '../../ordinals';

/**
 * The twelve actions the keyless engine owns, and owns reliably.
 *
 * The table this sits in front of is ordered, and first match wins — which is how the bare
 * word "watch" once pre-empted every command written after it. Nothing here is ordered:
 * `parse` scores every reading and the best one wins only if it clears the floor. Below the
 * floor the engine asks which of its two best guesses was meant rather than acting on one,
 * because acting wrongly is worse than admitting confusion.
 *
 * Anything outside these twelve falls through to the ordered table, and from there to the
 * model when a key is present. That division is deliberate: a confident answer on the twelve
 * beats a vague answer on everything.
 *
 * Every reply reads the visitor's language column of the reply table. The frame and the
 * language arrive resolved: one parse per sentence, one language per sentence, remembered
 * before any plan is made.
 */

const pieces = (outcomes: ToolOutcome[]) => {
  const o = outcomes.find((x) => x.ui?.kind === 'pieces');
  return o?.ui && o.ui.kind === 'pieces' ? o.ui.pieces : [];
};

const searchArgs = (frame: IntentFrame): Record<string, unknown> => {
  const s = frame.slots;
  return {
    category: s.category,
    material: s.material,
    department: s.department,
    purity: s.karat ? `${s.karat}K` : undefined,
    // parsed and then carried: reading "under 15 grams" and dropping it is worse than not
    // reading it, because the visitor is shown pieces that do not answer what they asked
    maxWeightGrams: s.maxWeightGrams,
    limit: 4,
  };
};

/**
 * A plan for one of the twelve, or `null` to let the ordered table answer.
 *
 * `null` is returned freely. This engine is not trying to be the whole concierge; it is
 * trying to be right about the things a jewellery visitor asks for most.
 */
export function corePlan(raw: IntentFrame, language: ReplyLanguage, ctx: SiteContext): Plan | null {
  const store = useConciergeStore.getState();
  const now = Date.now();
  const R = replies(language);

  store.countTurn();

  /**
   * The running topic fills in what this sentence left unsaid.
   *
   * Without it every second sentence has to repeat the first: "gold rings under 15 grams",
   * then "something lighter", and the second one means nothing on its own. The new words
   * always win; the topic only supplies what was not said again.
   */
  const carried = withStandingTopic(raw.slots, store.memory, store.turnCount, now);
  const frame: IntentFrame = { ...raw, slots: carried };
  // what the topic supplied, so a widened second search can set exactly that aside
  const fromTopic = topicIsLive(store.memory, store.turnCount, now) ? carriedKeys(raw.slots, carried) : {};
  if (hasSubject(raw.slots)) store.rememberTopic(subjectOf(carried));

  // below the floor, ask — and name the two readings rather than guessing between them
  if (frame.intent === 'unknown') {
    if (frame.confidence > 0 && frame.alternatives.length >= 2) {
      return { id: 'clarify', language, tools: [], reply: () => R.clarifyBetween(readable(R, frame.alternatives[0]!), readable(R, frame.alternatives[1]!)) };
    }
    return null;
  }

  const s = frame.slots;
  const tool = (name: ToolName, args: Record<string, unknown> = {}) => ({ name, args });
  const action = (id: string, tools: Plan['tools'], reply: Plan['reply'] = () => ''): Plan => ({ id, language, tools, ack: nextAck(language), reply });
  const anyShown = ctx.recentResults.length > 0 || ctx.visibleProducts.length > 0;

  switch (frame.intent) {
    case 'search': {
      /**
       * A department named on its own — "Gold.", "Diamond.", "Bridal.", "Sona.", "Show me
       * bridal" — opens the department rather than bringing four of its pieces to the tray:
       * the page is the department, and a one-word command is a movement, not a query.
       */
      const rawKeys = Object.keys(subjectOf(raw.slots));
      const onlyDepartment = (rawKeys.length === 1 && ((raw.slots.material === 'gold' || raw.slots.material === 'diamond') || raw.slots.department === 'bridal')) && unknownWords(raw).length === 0;
      if (onlyDepartment) {
        const department = raw.slots.department === 'bridal' ? 'bridal' : raw.slots.material!;
        return action('core_department', [tool('showDepartment', { department })]);
      }
      /**
       * A sentence with no subject of its own and words the engine does not know — "kal shaam
       * ka time dekhna" — is not a search. Bringing four arbitrary pieces would be pretending
       * to have understood; the honest answer is to ask once, in the visitor's language.
       */
      const unknown = unknownWords(raw);
      if (!hasSubject(raw.slots) && unknown.length > 0) return { id: 'unknown', language, tools: [], reply: () => R.clarify };
      // a budget with no priced match is carried into the enquiry rather than returning
      // nothing: 583 of 599 pieces have no published price, so "under four lakh" cannot be
      // answered by filtering and pretending otherwise would return an empty room
      const widened = Object.keys(fromTopic).length > 0 && hasSubject(raw.slots);
      return {
        id: 'core_search',
        language,
        tools: [tool('searchProducts', searchArgs(frame))],
        // the same request with the topic's conditions set aside, only if the first brings nothing
        retry: widened ? [tool('searchProducts', searchArgs({ ...raw, slots: raw.slots }))] : undefined,
        reply: (o) => {
          const found = pieces(o);
          if (found.length === 0) return R.nothing;
          store.noteDiscussed(found.map((p) => p.slug));
          // the second search answered: say which conditions were set aside
          const fromRetry = widened && o.length > 1 && o[0]?.ui?.kind !== 'pieces';
          const subject = fromRetry ? raw.slots : s;
          const line = fromRetry ? R.searchWidened(found.length, subjectIn(language, subject, found.length)) : R.searchResult(found.length, subjectIn(language, subject, found.length));
          return s.maxPricePkr ? `${line.replace(/[.۔।]$/, '')} — ${R.budgetNoted}.` : line;
        },
      };
    }

    case 'open': {
      /**
       * An ordinal is resolved here, against what was just shown, and the tool is given the
       * slug — `openProduct` takes a slug and nothing else, and the validator rejects any
       * other argument. Passing the ordinal through once meant every "doosra kholo" after a
       * set of results was refused and answered with a question.
       *
       * A tool that could not act returns an *empty* label, and answering a visitor with an
       * empty string is worse than answering them with a question.
       */
      const target = s.ordinal !== undefined ? resolveOrdinal(s.ordinal, ctx) : null;
      if (s.ordinal !== undefined && !target) return { id: 'core_open', language, tools: [], reply: () => R.whichPiece(anyShown) };
      if (target?.kind === 'collection') return action('core_open', [tool('showCollection', { slug: target.slug })], (o) => (o[0]?.label ? '' : R.whichPiece(anyShown)));
      /**
       * "Open it" / "yeh kholo" / "eh wala kholo": the piece in view, else the one just spoken
       * about, else the first of the pieces just shown — resolved here, because the tool
       * takes a slug and refuses a call without one. Nothing to open at all is a question,
       * never a refused call.
       */
      // "what time do you open" carries the verb and nothing this engine can open: asked, not acted on
      if (!target && !s.deictic && unknownWords(raw).length > 0) return { id: 'unknown', language, tools: [], reply: () => R.clarify };
      const slug = target?.slug ?? ctx.currentProduct?.slug ?? ctx.focusedProduct?.slug ?? ctx.recentResults[0]?.slug;
      if (!slug) return { id: 'core_open', language, tools: [], reply: () => R.whichPiece(false) };
      return action('core_open', [tool('openProduct', { slug })], (o) => (o[0]?.label ? '' : R.whichPiece(anyShown)));
    }

    /**
     * "Something lighter" is a comparison of weight, and the honest tool for it is the one
     * that compares weights: `refineResults` says whether it used published grams or only the
     * form of the piece, and the reply says the same. This once called the similar-pieces
     * tool and described its answer as "ordered by the weight Waseem publishes", which it was
     * not.
     */
    case 'similar': {
      const comparative = s.comparative === 'lighter' || s.comparative === 'heavier' ? s.comparative : undefined;
      if (comparative) {
        return {
          id: 'core_lighter',
          language,
          tools: [tool('refineResults', { weight: comparative, limit: 4 })],
          reply: (o) => {
            const out = o[0];
            const result = (out?.result ?? {}) as { basis?: string; needsPiece?: boolean };
            if (!out || out.label === '' || result.needsPiece) return R.whichPieceSimilar;
            const found = pieces(o);
            if (result.basis === 'none' || !found.length) return R.weightUnknown;
            return result.basis === 'published' ? R.lighter(found.length, comparative === 'heavier') : R.lighterByForm(found.length, comparative === 'heavier');
          },
        };
      }
      return {
        id: 'core_similar',
        language,
        tools: [tool('showSimilarPieces', {})],
        reply: (o) => {
          const out = o[0];
          if (!out || out.label === '') return R.whichPieceSimilar;
          const found = pieces(o);
          return found.length ? R.similar(found.length) : R.nothing;
        },
      };
    }

    /**
     * "What goes with this" is the complement, not more of the same: earrings for a choker,
     * a ring for a bangle. This once called the similar-pieces tool and answered "worn with
     * it" over four more necklaces. A named kind narrows the companions to that kind.
     */
    case 'matching':
      return {
        id: 'core_matching',
        language,
        tools: [tool('showMatchingPieces', s.category ? { category: s.category } : {})],
        reply: (o) => {
          const out = o[0];
          if (!out || out.label === '') return R.whichPieceSimilar;
          return pieces(o).length ? R.matching(pieces(o).length) : R.matchingNone;
        },
      };

    /**
     * Saving is not offered on this build. The intents stay in the lexicon — the fixture set
     * is frozen — and each is answered with what the concierge can do instead, so the sentence
     * never ends in silence or in an action nobody asked for.
     */
    case 'save':
    case 'remove':
      return { id: 'core_save', language, tools: [], reply: () => R.savingNotOffered };

    case 'selection':
      return { id: 'core_selection', language, tools: [], reply: () => R.selectionNotOffered };

    case 'price': {
      const brief = ctx.currentProduct ?? ctx.focusedProduct;
      if (!brief) return null;
      // a published price is said off the homepage only, where the pages themselves carry it
      const priced = ctx.routeKind !== 'home' && !/request/i.test(brief.priceLabel);
      return { id: 'core_price', language, tools: [], reply: () => (priced ? R.priceKnown(brief.priceLabel) : R.priceOnRequest) };
    }

    /**
     * The appointment: the form opens, and the reply asks for the first thing it still needs
     * — one field, never a list. A showroom named in the sentence is written into the form
     * by the table's own consultation command, which is asked before this one.
     */
    case 'consultation':
      return action('core_consultation', [tool('fillAppointment', {})], (o) => appointmentReply(R, undefined, o[0]));

    case 'restart':
      store.forgetTopic();
      return { id: 'core_restart', language, tools: [], reply: () => R.restart };

    case 'greet':
      return { id: 'core_greet', language, tools: [], reply: () => R.greeting(ctx.localHour) };

    case 'thanks':
      return { id: 'core_thanks', language, tools: [], reply: () => R.thanks };

    default:
      return null;
  }
}

/** The reading, in words a visitor would recognise. */
function readable(R: ReturnType<typeof replies>, intent: string): string {
  return R.reading[intent] ?? R.reading.search!;
}
