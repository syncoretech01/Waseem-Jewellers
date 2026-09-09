'use client';

import { CATEGORY_LABEL, CATEGORY_PLURAL, METAL_COLOUR_LABEL } from './labels';
import type { Category, ImageRef, ProductImage } from './types';
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
 * Nothing here is available until it has been asked for. The two surfaces that need it are
 * the concierge and the selection ledger, both of which open on an interaction.
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
      // an index that failed to load must not become an index that answers wrongly: it stays
      // empty, every existence check says no, and nothing acts on a slug it cannot confirm
      inflight = null;
      if (process.env.NODE_ENV === 'development') console.warn('[catalogue] index unavailable', err);
      cache = { rows: [], bySlug: new Map(), generatedAt: '' };
      return cache;
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
  maxWeightGrams?: number;
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
      if (q.maxWeightGrams !== undefined && (row.w === undefined || row.w > q.maxWeightGrams)) return null;
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
