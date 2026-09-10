import 'server-only';

import { asCategory, asDepartment, asKarat, asMaterial } from '@/data/vocabulary';
import type { MemoryProjection } from '@/concierge/memory';
import type { Slots } from '@/concierge/nlu/parse';
import type { Language } from '@/concierge/nlu/script';

/**
 * Everything the browser sends, treated as evidence rather than authority.
 *
 * The memory projection and the tool results are both produced by our own code — and both
 * arrive over a network the visitor controls. So the rule here is not "is this plausible" but
 * "would acting on it be safe if a visitor had written it by hand". Slugs are checked against
 * the listable set, slot values are re-narrowed through the same vocabulary the catalogue
 * publishes, numbers are clamped, and everything else is dropped.
 *
 * Nothing here throws. A malformed field becomes an absent field, because refusing a whole
 * turn over one bad number would hand a visitor a way to break their own conversation.
 */

const LANGUAGES: Language[] = ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru', 'mixed'];

/** Grams and rupees, bounded to what this catalogue could plausibly contain. */
const clampNumber = (v: unknown, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, max) : undefined;

const OCCASIONS = new Set(['wedding', 'mehndi', 'baraat', 'walima', 'engagement', 'everyday', 'gift']);

/**
 * The standing topic, rebuilt field by field from the published vocabulary.
 *
 * A category the shop does not have, a karat it does not sell, a negative weight: each simply
 * does not survive. What comes out is a `Slots` that could have been produced by the parser.
 */
export function sanitiseSlots(raw: unknown): Slots {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const slots: Slots = {};

  const category = asCategory(r.category);
  if (category) slots.category = category;
  const material = asMaterial(r.material);
  if (material) slots.material = material;
  const department = asDepartment(r.department);
  if (department) slots.department = department;
  if (typeof r.occasion === 'string' && OCCASIONS.has(r.occasion)) slots.occasion = r.occasion;

  const karat = asKarat(typeof r.karat === 'number' ? `${r.karat}K` : r.karat);
  if (karat) slots.karat = Number(karat.replace('K', ''));

  const maxW = clampNumber(r.maxWeightGrams, 5000);
  if (maxW !== undefined) slots.maxWeightGrams = maxW;
  const minW = clampNumber(r.minWeightGrams, 5000);
  if (minW !== undefined) slots.minWeightGrams = minW;
  const maxP = clampNumber(r.maxPricePkr, 1_000_000_000);
  if (maxP !== undefined) slots.maxPricePkr = maxP;

  return slots;
}

export interface SanitiseOptions {
  isKnownSlug: (slug: string) => boolean;
}

const MAX_DISCUSSED = 8;

export function sanitiseMemory(raw: unknown, { isKnownSlug }: SanitiseOptions): MemoryProjection {
  const empty: MemoryProjection = { standingSlots: {}, anchor: null, language: null, discussed: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  const r = raw as Record<string, unknown>;

  const anchor = typeof r.anchor === 'string' && isKnownSlug(r.anchor) ? r.anchor : null;
  const discussed = Array.isArray(r.discussed)
    ? [...new Set(r.discussed.filter((s): s is string => typeof s === 'string' && isKnownSlug(s)))].slice(0, MAX_DISCUSSED)
    : [];
  const language = typeof r.language === 'string' && (LANGUAGES as string[]).includes(r.language) ? (r.language as Language) : null;

  return { standingSlots: sanitiseSlots(r.standingSlots), anchor, language, discussed };
}

// ── tool results coming back from the browser ───────────────────────────────

/** Deep enough for `{count, items:[{slug,name}]}`; anything deeper is not a tool result. */
const MAX_DEPTH = 4;
const MAX_ARRAY = 12;
const MAX_STRING = 400;
const MAX_KEYS = 24;

/**
 * A tool result, reduced to something safe to hand a model.
 *
 * These are produced by our own `executeTool` — and they reach the server by way of the
 * browser, which means a visitor could substitute anything at all. The risks are not equal:
 * an inflated payload costs tokens, but an **invented slug** in a result would be read by the
 * model as a real piece and named to the visitor, which is the one failure this whole
 * architecture exists to prevent.
 *
 * So every value under a slug-shaped key is checked against the listable set and dropped if
 * it is not real, strings are clipped, arrays and depth are bounded, and functions, symbols
 * and prototypes cannot survive a structural rebuild.
 */
export function sanitiseToolResult(raw: unknown, { isKnownSlug }: SanitiseOptions): unknown {
  const walk = (value: unknown, depth: number, key?: string): unknown => {
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string') {
      const isSlugKey = key === 'slug' || key === 'anchor' || key === 'href';
      // a slug-shaped field that names nothing listable is removed rather than corrected
      if (isSlugKey && key !== 'href' && !isKnownSlug(value)) return undefined;
      return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
    }
    if (depth >= MAX_DEPTH) return undefined;
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY).map((v) => walk(v, depth + 1));
      return items.filter((v) => v !== undefined);
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      let n = 0;
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (n >= MAX_KEYS) break;
        const walked = walk(v, depth + 1, k);
        if (walked === undefined) continue;
        out[k] = walked;
        n++;
      }
      return out;
    }
    // functions, symbols, bigints and undefined never belong in a tool result
    return undefined;
  };
  const result = walk(raw, 0);
  return result === undefined ? { ok: true } : result;
}
