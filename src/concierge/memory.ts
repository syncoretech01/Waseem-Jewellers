import type { Slots } from './nlu/parse';
import type { Language } from './nlu/script';

/**
 * What the concierge is allowed to remember, and for how long.
 *
 * One explicit, bounded, typed structure rather than a growing bag of state. A private salon
 * does not remember what you asked last week, so none of this is persisted: it is
 * session-scoped and dies with the tab. The visitor's language is the single exception, and
 * only within the tab, so a reload does not make them start over in a language they did not
 * choose.
 *
 * The rule that makes it worth having: **a route change to a different piece replaces the
 * anchor but does not clear the standing topic.** "Show me something lighter" still means
 * "in bridal necklaces under four lakh" after the visitor has opened one and come back — and
 * without that, the second sentence in every conversation is a repetition of the first.
 */

/** Turns, and minutes, after which the running topic is no longer what is being discussed. */
export const TOPIC_TURNS = 6;
export const TOPIC_MS = 8 * 60_000;
/** The piece under discussion goes stale sooner than the subject does. */
export const ANCHOR_TURNS = 4;

/** At most a dozen slugs; a conversation this long is a different conversation. */
export const DISCUSSED_MAX = 12;

export interface ConversationMemory {
  /** The running topic: the subject slots of the last real request. */
  standingSlots: Slots;
  /** The turn index and wall time the topic was set, for decay. */
  topicTurn: number;
  topicAt: number;
  /** The piece being talked about, and when it became so. */
  anchor: string | null;
  anchorTurn: number;
  /** Pieces already brought up, so the same four are not offered twice. */
  discussed: string[];
  /** The language the visitor is writing in, so replies and voice can follow. */
  language: Language | null;
}

export const EMPTY_MEMORY: ConversationMemory = {
  standingSlots: {},
  topicTurn: -1,
  topicAt: 0,
  anchor: null,
  anchorTurn: -1,
  discussed: [],
  language: null,
};

/** The subject of a request, as opposed to how it was phrased. */
const SUBJECT_KEYS = ['category', 'material', 'department', 'occasion', 'style', 'karat', 'maxWeightGrams', 'minWeightGrams', 'maxPricePkr'] as const;

export const subjectOf = (slots: Slots): Slots =>
  Object.fromEntries(SUBJECT_KEYS.flatMap((k) => (slots[k] !== undefined ? [[k, slots[k]]] : []))) as Slots;

export const hasSubject = (slots: Slots) => SUBJECT_KEYS.some((k) => slots[k] !== undefined);

/**
 * What the topic supplied that this sentence did not.
 *
 * Memory that acts without saying so is not helpful, it is mysterious: a visitor who asks
 * for "bracelets" and is shown gold ones under fifteen grams should be able to see why, and
 * to say otherwise.
 */
export const carriedKeys = (raw: Slots, merged: Slots): Slots =>
  Object.fromEntries(SUBJECT_KEYS.flatMap((k) => (raw[k] === undefined && merged[k] !== undefined ? [[k, merged[k]]] : []))) as Slots;

export const topicIsLive = (m: ConversationMemory, turn: number, now: number) =>
  m.topicTurn >= 0 && turn - m.topicTurn <= TOPIC_TURNS && now - m.topicAt <= TOPIC_MS;

export const anchorIsLive = (m: ConversationMemory, turn: number) => m.anchor !== null && turn - m.anchorTurn <= ANCHOR_TURNS;

/**
 * The new request, read against the standing one.
 *
 * The new slots win outright; the standing topic only fills what was left unsaid. Saying
 * "rings" after "gold under 15 grams" means gold rings under 15 grams, and saying "diamond
 * rings" after it means diamond — not both metals, and not a silent argument between them.
 */
export function withStandingTopic(slots: Slots, memory: ConversationMemory, turn: number, now: number): Slots {
  if (!topicIsLive(memory, turn, now)) return slots;
  return { ...memory.standingSlots, ...subjectOf(slots), ...withoutSubject(slots) };
}

const withoutSubject = (slots: Slots): Slots => {
  const rest = { ...slots };
  for (const k of SUBJECT_KEYS) delete rest[k];
  return rest;
};

/** A line the UI can show so the visitor can see what is being carried, and drop it. */
export function topicLine(slots: Slots): string {
  const bits = [
    slots.karat ? `${slots.karat}K` : undefined,
    slots.material,
    slots.department,
    slots.category,
    slots.occasion,
    slots.style,
    slots.maxWeightGrams !== undefined ? `under ${Math.round(slots.maxWeightGrams)} g` : undefined,
    slots.maxPricePkr !== undefined ? `under ${Math.round(slots.maxPricePkr / 100_000)} lakh` : undefined,
  ].filter(Boolean);
  return bits.join(' · ');
}

// ── what the model is allowed to be told ────────────────────────────────────

/** Slugs a projection may carry. Small: this is a reminder, not a transcript. */
const PROJECTED_DISCUSSED = 8;

/**
 * The bounded, typed slice of memory that travels to the server with a model turn.
 *
 * Without it the model is *worse than the keyless engine* on the sentences that matter most —
 * "now bracelets", "something lighter", "open the second one" — because the keyless engine
 * carries a standing topic and the model was being handed only the current sentence and a
 * couple of slugs. Grounding then retrieved the wrong pieces and the model reasoned faithfully
 * about the wrong set.
 *
 * It is a *projection*, not the memory: no transcript, no timestamps, no free text, and a
 * hard cap on the slugs. And it is re-validated on arrival — the browser is where it comes
 * from, so it is evidence of what the visitor was shown, not authority about what exists.
 */
export interface MemoryProjection {
  standingSlots: Slots;
  anchor: string | null;
  language: Language | null;
  discussed: string[];
}

export function projectMemory(memory: ConversationMemory, turnCount: number, now: number): MemoryProjection {
  return {
    // a decayed topic is not sent at all: stale context is worse than none, because the model
    // has no way to know it is stale
    standingSlots: topicIsLive(memory, turnCount, now) ? subjectOf(memory.standingSlots) : {},
    anchor: anchorIsLive(memory, turnCount) ? memory.anchor : null,
    language: memory.language,
    discussed: memory.discussed.slice(0, PROJECTED_DISCUSSED),
  };
}
