'use client';

import { CATEGORY_LABEL, CATEGORY_PLURAL, METAL_COLOUR_LABEL } from './labels';
import type { Category, ImageRef, ProductImage } from './types';
import { complementsOf, formRankOf } from '@/lib/relations';
import type { PieceRow } from '@/lib/facets';

/**
 * The catalogue, as much of it as a browser should ever hold.
 *
 * The full merged catalogue is about a megabyte. It was reaching the client bundle
 * transitively — `@/data` re-exports the product modules, so any component importing
 * `getImage` from it pulled 656 products with 1,464 image records along for the ride, and the
 * ESLint rule guarding `generated/catalogue` never saw it because nothing imported that path
 * directly.
 *
 * So the browser gets rows instead, fetched once from a prerendered route and memoised for
 * the session: name, kind, purity, weight, price, hero. Enough to search, to name a piece, to
 * say what is published about it, and — the reason this exists at all — to answer whether a
 * slug is real before anything acts on it.
 *
 * Nothing here is available until it has been asked for. The surfaces that need it — the
 * concierge, the department index — open on an interaction.
 */

export interface ClientIndex {
  rows: PieceRow[];
  bySlug: Map<string, PieceRow>;
  generatedAt: string;
}

let cache: ClientIndex | null = null;
let inflight: Promise<ClientIndex> | null = null;

export function loadedIndex(): ClientIndex | null {
  return cache;
}

export function loadIndex(): Promise<ClientIndex> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch('/api/catalogue', { cache: 'force-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalogue ${r.status}`))))
    .then((data: { rows: PieceRow[]; generatedAt: string }) => {
      cache = { rows: data.rows, bySlug: new Map(data.rows.map((r) => [r.s, r])), generatedAt: data.generatedAt };
      return cache;
    })
    .catch((err) => {
      /**
       * A failed fetch leaves the index *unloaded*, not empty.
       *
       * Failing closed is right — every existence check says no, and nothing acts on a slug
       * it cannot confirm. Caching that emptiness was not: one dropped request and the
       * refusal became permanent, so every tool call for the rest of the session was
       * rejected as an invented slug and the concierge could not open a single piece.
       * Leaving `cache` null keeps the same safe answer and lets the next ask try again.
       */
      inflight = null;
      if (process.env.NODE_ENV === 'development') console.warn('[catalogue] index unavailable', err);
      return { rows: [], bySlug: new Map<string, PieceRow>(), generatedAt: '' };
    });
  return inflight;
}

/** The existence check the tool validator runs on every slug, on every path. */
export const isKnownSlug = (slug: string): boolean => Boolean(cache?.bySlug.has(slug));

export const getRow = (slug: string): PieceRow | undefined => cache?.bySlug.get(slug);
export const getRows = (slugs: readonly string[]): PieceRow[] => slugs.map(getRow).filter((r): r is PieceRow => Boolean(r));

// ── the shapes the UI already speaks ────────────────────────────────────────

export const refOf = (r: PieceRow): ImageRef =>
  r.hw !== undefined && r.hh !== undefined ? { kind: 'remote', src: r.h, width: r.hw, height: r.hh } : { kind: 'local', id: r.h };

export const heroOf = (r: PieceRow): ProductImage => ({
  ref: refOf(r),
  role: r.r,
  order: 0,
  alt: `${r.t}${r.c ? ` — ${CATEGORY_LABEL[r.c as Category].toLowerCase()}` : ''}, Waseem Jewellers`,
  altDerived: true,
});

export const pieceRefOf = (r: PieceRow) => ({ slug: r.s, media: { hero: heroOf(r) } });

export const priceLabelOf = (r: PieceRow): string => (r.p > 0 ? `Rs. ${new Intl.NumberFormat('en-US').format(r.p)}` : 'PRICE ON REQUEST');

/** The published facts, in the order a jeweller would say them. */
export function specLineOf(r: PieceRow): string {
  return [r.k, r.w !== undefined ? `${r.w.toFixed(3)} g` : undefined, r.ct !== undefined ? `${r.ct} ct` : undefined, r.rf].filter(Boolean).join(', ');
}

/** A sentence assembled only from what Waseem publishes — the same rule `describe` follows. */
export function describeRow(r: PieceRow): string {
  const noun = r.c ? CATEGORY_LABEL[r.c as Category].toLowerCase() : 'piece';
  const metal = r.m === 'polki' ? 'gold' : undefined;
  const opening = [r.k, metal].filter(Boolean).join(' ');
  const facts = [
    r.ct !== undefined ? `set with ${r.ct} ct of diamonds` : r.m === 'polki' ? 'set with uncut stones' : undefined,
    r.w !== undefined ? `${r.w} grams` : undefined,
  ].filter(Boolean);
  return `${opening ? `A ${opening} ${noun}` : `A ${noun}`}${facts.length ? `, ${facts.join(', ')}` : ''} from Waseem Jewellers, Lahore.`;
}

// ── lookups ─────────────────────────────────────────────────────────────────

const GENERIC = new Set([
  'the', 'and', 'with', 'set', 'suite', 'bridal', 'necklace', 'necklaces', 'choker', 'collar', 'ring', 'rings', 'earring', 'earrings',
  'gold', 'diamond', 'diamonds', 'piece', 'pieces', 'jewellery', 'jewelry', 'haar', 'polki', 'kundan', 'pearl', 'emerald', 'sapphire',
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** A piece named by a fragment a visitor spoke or typed. Distinctive words only. */
export function byName(text: string): PieceRow | undefined {
  if (!cache) return undefined;
  const asked = words(text).filter((w) => w.length > 2);
  if (!asked.length) return undefined;
  let best: { row: PieceRow; score: number } | null = null;
  for (const row of cache.rows) {
    const names = words(`${row.t} ${row.rf ?? ''} ${row.s}`).filter((w) => w.length > 2 && !GENERIC.has(w));
    const distinctive = asked.filter((w) => names.includes(w)).length;
    if (!distinctive) continue;
    const score = distinctive * 3 + asked.filter((w) => GENERIC.has(w) && row.t.toLowerCase().includes(w)).length;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row;
}

export interface RowQuery {
  category?: string;
  material?: string;
  department?: string;
  occasion?: string;
  purity?: string;
  /** A campaign slug. Declared *and read* — the field this replaces was silently discarded. */
  campaign?: string;
  maxWeightGrams?: number;
  minWeightGrams?: number;
  limit?: number;
}

/** Structured fields filter; free words only rank. Nothing scores a non-match into the answer. */
export function searchRows(q: RowQuery & { query?: string }): PieceRow[] {
  if (!cache) return [];
  const asked = q.query ? words(q.query) : [];
  return cache.rows
    .map((row) => {
      if (q.category && row.c !== q.category) return null;
      if (q.department && !row.d.includes(q.department)) return null;
      if (q.purity && row.k !== q.purity) return null;
      if (q.occasion && !row.o.includes(q.occasion)) return null;
      if (q.material && !matchesMaterial(row, q.material)) return null;
      if (q.campaign && row.cp !== q.campaign) return null;
      if (q.maxWeightGrams !== undefined && (row.w === undefined || row.w > q.maxWeightGrams)) return null;
      if (q.minWeightGrams !== undefined && (row.w === undefined || row.w < q.minWeightGrams)) return null;
      let score = 1;
      const hay = `${row.t} ${row.c ?? ''} ${row.m ?? ''} ${row.cp ?? ''}`.toLowerCase();
      for (const w of asked) if (hay.includes(w)) score += 1;
      return { row, score };
    })
    .filter((x): x is { row: PieceRow; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, q.limit ?? 4)
    .map((x) => x.row);
}

const matchesMaterial = (row: PieceRow, m: string) => {
  if (m === 'gold') return row.m === 'gold' || row.m === 'gold-diamond' || row.m === 'polki';
  if (m === 'diamond') return row.m === 'diamond' || row.m === 'gold-diamond';
  if (m === 'polki') return row.m === 'polki';
  // emerald, pearl, sapphire and the rest are not fields the shop publishes; they can only be
  // looked for in a name, and saying so is better than filtering on a guess
  return row.t.toLowerCase().includes(m);
};

/**
 * Pieces in the same spirit. Every comparison is guarded against both sides being absent —
 * two pieces that each publish no material are not similar, they are two silences.
 */
export function similarRows(slug: string, limit = 4): PieceRow[] {
  const anchor = getRow(slug);
  if (!anchor || !cache) return [];
  const both = <T>(a: T | undefined, b: T | undefined) => a !== undefined && a === b;
  return cache.rows
    .filter((r) => r.s !== slug)
    .map((row) => {
      let score = 0;
      if (row.d.some((d) => anchor.d.includes(d))) score += 4;
      if (both(anchor.c, row.c)) score += 3;
      if (both(anchor.m, row.m)) score += 3;
      if (both(anchor.k, row.k)) score += 1;
      if (both(anchor.cp, row.cp)) score += 4;
      return { row, score };
    })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.row);
}

export const categoryPlural = (c?: string) => (c ? CATEGORY_PLURAL[c as Category] ?? c : 'Pieces');
export const metalColourLabel = METAL_COLOUR_LABEL;

/**
 * What would be worn *with* this piece — the complement of `similarRows`, which finds more
 * of the same kind. The table is shared with the repository, so the tray and the page cannot
 * answer the same question differently.
 */
export function matchingRows(slug: string, limit = 4): PieceRow[] {
  const anchor = getRow(slug);
  if (!anchor || !cache) return [];
  const wanted = complementsOf(anchor.c);
  if (!wanted.size) return [];
  // both being campaign-less is not a shared campaign: 640 pieces carry none, and testing it
  // with `===` once made every one of them a match for every other
  const sameCampaign = (r: PieceRow) => anchor.cp !== undefined && r.cp === anchor.cp;
  const sameDepartment = (r: PieceRow) => r.d.some((d) => anchor.d.includes(d));
  return cache.rows
    .filter((r) => r.s !== slug && r.c && wanted.has(r.c) && (sameCampaign(r) || sameDepartment(r)))
    .map((r) => ({ r, rank: (sameCampaign(r) ? 0 : 2) + (sameDepartment(r) ? 0 : 4) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.r);
}

/** Which rung of the honesty ladder a "something lighter" question can be answered on. */
export type WeightBasis = 'published' | 'form' | 'none';

export interface LighterResult {
  basis: WeightBasis;
  rows: PieceRow[];
  /** The anchor's published weight, when it has one. Never a figure derived from anything else. */
  anchorWeight?: number;
}

/**
 * "Something lighter than this" — answered three ways, in descending order of honesty.
 *
 * 1. The anchor publishes a gross weight (583 of 599 do): a true numeric comparison.
 * 2. It publishes none: fall back to *form* — a ring is lighter than a bangle — and the
 *    caller is told, so the reply can say "lighter in form" rather than implying a figure.
 * 3. Neither the anchor nor its kind is known: return nothing and let the reply say so.
 *
 * There is no fourth branch that estimates grams. Upstream publishes `variants[].grams` as 0
 * on every one of 750 products, so a number produced here would be invention wearing the
 * costume of a specification.
 */
export function lighterRows(slug: string, direction: 'lighter' | 'heavier', limit = 4): LighterResult {
  const anchor = getRow(slug);
  if (!anchor || !cache) return { basis: 'none', rows: [] };
  const pool = cache.rows.filter((r) => r.s !== slug && (r.c === anchor.c || r.d.some((d) => anchor.d.includes(d))));

  if (anchor.w !== undefined) {
    const rows = pool
      .filter((r) => r.w !== undefined && (direction === 'lighter' ? r.w < anchor.w! : r.w > anchor.w!))
      .sort((a, b) => (direction === 'lighter' ? b.w! - a.w! : a.w! - b.w!))
      .slice(0, limit);
    if (rows.length) return { basis: 'published', rows, anchorWeight: anchor.w };
  }

  const rank = formRankOf(anchor.c);
  if (rank === undefined) return { basis: 'none', rows: [] };
  const rows = pool
    .filter((r) => {
      const other = formRankOf(r.c);
      return other !== undefined && (direction === 'lighter' ? other < rank : other > rank);
    })
    .slice(0, limit);
  return rows.length ? { basis: 'form', rows } : { basis: 'none', rows: [] };
}
