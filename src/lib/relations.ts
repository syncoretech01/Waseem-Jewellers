import type { Category } from '@/data/types';

/**
 * What a piece is worn *with* — as opposed to what it resembles.
 *
 * The two are genuinely different questions and a visitor asks both. "Something like this"
 * wants another ring; "what would go with it" wants earrings. Answering the second with the
 * first is the single most common way a jewellery site sounds like a search engine.
 *
 * The table lives here rather than inside the repository because the browser asks the same
 * question of its slim rows that the server asks of full products. It was written once on
 * the server, and a second copy in the client index would have been free to disagree — which
 * is exactly the class of bug that gave a men's bracelet an answer of children's rings.
 *
 * No `nath` or `tikka` entry is missing by oversight: both are here because a bridal visitor
 * asks for them by name. `chain` complements only `pendant`, because that is the truth — a
 * chain is not worn with a ring, it is worn with something hung on it.
 */
export const COMPLEMENT: Partial<Record<Category, Category[]>> = {
  necklace: ['earrings', 'ring', 'bangle', 'tikka'],
  earrings: ['necklace', 'ring', 'pendant'],
  ring: ['earrings', 'pendant', 'bracelet'],
  bangle: ['necklace', 'earrings', 'ring'],
  bracelet: ['ring', 'pendant', 'earrings'],
  pendant: ['chain', 'earrings', 'ring'],
  chain: ['pendant'],
  'bridal-set': ['ring', 'bangle', 'tikka'],
  'nose-pin': ['earrings', 'ring', 'pendant'],
  cufflink: ['ring', 'bracelet'],
  tikka: ['necklace', 'earrings', 'nath'],
  nath: ['tikka', 'earrings', 'necklace'],
};

/** Empty when the kind is unknown or has no natural companion — never a guess. */
export const complementsOf = (category?: string): Set<string> => new Set(category ? (COMPLEMENT[category as Category] ?? []) : []);

/**
 * How light a kind tends to be, when no weight is published.
 *
 * This is the second rung of the honesty ladder and it is deliberately coarse. 583 of 599
 * listable pieces publish a gross weight, so the first rung — an actual numeric comparison —
 * answers almost every question. When the anchor publishes none, the honest fallback is the
 * *form*: a collar is lighter than a haar, and a jeweller would say so without reaching for
 * a scale. What must never happen is the third thing — producing a gram figure. `variants[]
 * .grams` is 0 on all 750 products upstream, so any number invented here would be a fiction
 * presented in the one register a customer would most trust.
 */
export const FORM_WEIGHT_RANK: Partial<Record<Category, number>> = {
  'nose-pin': 0,
  cufflink: 1,
  ring: 1,
  earrings: 2,
  pendant: 2,
  chain: 3,
  bracelet: 3,
  tikka: 3,
  nath: 3,
  bangle: 4,
  necklace: 5,
  'bridal-set': 6,
};

export const formRankOf = (category?: string): number | undefined => (category ? FORM_WEIGHT_RANK[category as Category] : undefined);
