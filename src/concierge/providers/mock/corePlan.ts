import { parse, type IntentFrame } from '../../nlu/parse';
import { carriedKeys, hasSubject, subjectOf, topicIsLive, topicLine, withStandingTopic } from '../../memory';
import { useConciergeStore } from '@/state/conciergeStore';
import { CONCIERGE } from '../../copy';
import { countInWords, capitalise } from '@/lib/format';
import type { SiteContext, ToolName, ToolOutcome } from '../../types';
import type { Plan } from './commands';

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
 */

const pieces = (outcomes: ToolOutcome[]) => {
  const o = outcomes.find((x) => x.ui?.kind === 'pieces' || x.ui?.kind === 'wishlist');
  return o?.ui && (o.ui.kind === 'pieces' || o.ui.kind === 'wishlist') ? o.ui.pieces : [];
};

/** What the visitor asked for, said back in their own terms. */
function subject(frame: IntentFrame): string {
  const s = frame.slots;
  const parts = [
    s.karat ? `${s.karat}K` : undefined,
    s.material,
    s.department && s.department !== 'bridal' ? `${s.department}'s` : s.department,
    s.category ? plural(s.category) : 'pieces',
  ].filter(Boolean);
  const line = parts.join(' ');
  const bound = s.maxWeightGrams !== undefined ? ` under ${Math.round(s.maxWeightGrams)} grams` : s.minWeightGrams !== undefined ? ` over ${Math.round(s.minWeightGrams)} grams` : '';
  return `${line}${bound}`;
}

const PLURAL: Record<string, string> = {
  'bridal-set': 'bridal sets',
  necklace: 'necklaces',
  earrings: 'earrings',
  ring: 'rings',
  bracelet: 'bracelets',
  bangle: 'bangles',
  pendant: 'pendants',
  chain: 'chains',
  'nose-pin': 'nose pins',
  cufflink: 'cufflinks',
  tikka: 'tikkas',
};
const plural = (c: string) => PLURAL[c] ?? c;

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
export function corePlan(text: string, ctx: SiteContext): Plan | null {
  const raw = parse(text);
  const store = useConciergeStore.getState();
  const now = Date.now();

  store.countTurn();
  if (raw.language !== 'en') store.rememberLanguage(raw.language);

  /**
   * The running topic fills in what this sentence left unsaid.
   *
   * Without it every second sentence has to repeat the first: "gold rings under 15 grams",
   * then "something lighter", and the second one means nothing on its own. The new words
   * always win; the topic only supplies what was not said again.
   */
  const carried = withStandingTopic(raw.slots, store.memory, store.turnCount, now);
  const frame: IntentFrame = { ...raw, slots: carried };
  // what the topic supplied, so the reply can name it rather than acting silently
  const fromTopic = topicIsLive(store.memory, store.turnCount, now) ? carriedKeys(raw.slots, carried) : {};
  if (hasSubject(raw.slots)) store.rememberTopic(subjectOf(carried));

  // below the floor, ask — and name the two readings rather than guessing between them
  if (frame.intent === 'unknown') {
    if (frame.confidence > 0 && frame.alternatives.length >= 2) {
      return { id: 'clarify', tools: [], reply: () => CONCIERGE.clarify(readable(frame.alternatives[0]!), readable(frame.alternatives[1]!)) };
    }
    return null;
  }

  const s = frame.slots;
  const tool = (name: ToolName, args: Record<string, unknown> = {}) => ({ name, args });

  switch (frame.intent) {
    case 'search': {
      // a budget with no priced match is carried into the enquiry rather than returning
      // nothing: 583 of 599 pieces have no published price, so "under four lakh" cannot be
      // answered by filtering and pretending otherwise would return an empty room
      const what = subject(frame);
      return {
        id: 'core_search',
        tools: [tool('searchProducts', searchArgs(frame))],
        reply: (o) => {
          const found = pieces(o);
          if (found.length === 0) return CONCIERGE.nothing;
          store.noteDiscussed(found.map((p) => p.slug));
          const line = CONCIERGE.searchResult(capitalise(countInWords(found.length)), what, []);
          // when the topic supplied the subject, name it: a visitor should be able to see
          // what is being carried, and say so if it is not what they meant
          const carriedLine = topicLine(fromTopic);
          const withTopic = carriedLine ? `${line} ${CONCIERGE.stillIn(carriedLine)}` : line;
          return s.maxPricePkr ? `${withTopic} ${CONCIERGE.budgetNoted}` : withTopic;
        },
      };
    }

    case 'open': {
      // `||`, not `??`: a tool that could not act returns an *empty* label, and answering a
      // visitor with an empty string is worse than answering them with a question
      const args = s.ordinal !== undefined ? { ordinal: s.ordinal } : {};
      return { id: 'core_open', tools: [tool('openProduct', args)], reply: (o) => o[0]?.label || CONCIERGE.whichPiece };
    }

    case 'similar':
      return {
        id: 'core_similar',
        tools: [tool('showSimilarPieces', {})],
        reply: (o) => {
          const found = pieces(o);
          if (!found.length) return CONCIERGE.nothing;
          // the honest answer to "something lighter": say which axis was used
          return s.comparative === 'lighter' || s.comparative === 'heavier' ? CONCIERGE.byWeight(found.length) : CONCIERGE.similarResult(found.length);
        },
      };

    case 'matching':
      return { id: 'core_matching', tools: [tool('showSimilarPieces', {})], reply: (o) => (pieces(o).length ? CONCIERGE.matchingResult(pieces(o).length) : CONCIERGE.nothing) };

    case 'save':
      return { id: 'core_save', tools: [tool('saveToWishlist', {})], reply: (o) => o[0]?.label || CONCIERGE.whichPiece };

    case 'remove':
      return { id: 'core_remove', tools: [tool('removeFromWishlist', {})], reply: (o) => o[0]?.label || CONCIERGE.whichPiece };

    case 'selection':
      return { id: 'core_selection', tools: [tool('openWishlist', {})], reply: (o) => (pieces(o).length ? CONCIERGE.selectionIntro(pieces(o).map((p) => p.name)) : CONCIERGE.wishlistEmpty) };

    case 'price': {
      const slug = ctx.currentProduct?.slug ?? ctx.focusedProduct?.slug;
      if (!slug) return null;
      const brief = ctx.currentProduct ?? ctx.focusedProduct!;
      return { id: 'core_price', tools: [], reply: () => CONCIERGE.priceOf(brief.name, brief.priceLabel) };
    }

    case 'consultation':
      return { id: 'core_consultation', tools: [tool('openPrivateConsultation', {})], reply: () => CONCIERGE.consultation };

    case 'restart':
      store.forgetTopic();
      return { id: 'core_restart', tools: [], reply: () => CONCIERGE.restart };

    case 'greet':
      return { id: 'core_greet', tools: [], reply: () => CONCIERGE.greeting(ctx.localHour) };

    case 'thanks':
      return { id: 'core_thanks', tools: [], reply: () => CONCIERGE.thanks };

    default:
      return null;
  }
}

/** The reading, in words a visitor would recognise. */
function readable(intent: string): string {
  const WORDS: Record<string, string> = {
    search: 'to see some pieces',
    open: 'to open one',
    similar: 'something similar',
    matching: 'something to wear with it',
    save: 'to keep a piece',
    remove: 'to remove one',
    selection: 'your selection',
    price: 'the price',
    consultation: 'to book an appointment',
    restart: 'to begin again',
  };
  return WORDS[intent] ?? 'something else';
}

