import type { Category, Department, Karat, Material, Product, StyleTag, WorldSlug } from './types';
import { PRODUCTS, LISTABLE_PRODUCTS } from './products';
import { nameOf } from './labels';

/**
 * Search reads `LISTABLE_PRODUCTS`, never the whole catalogue.
 *
 * A withheld piece has no page. Surfacing one — in a result tray, a rail, or a concierge
 * answer — offers a visitor a door that leads to a 404, so the withholding rule has to hold
 * here as firmly as it does in the routes.
 */
export interface SearchQuery {
  query?: string;
  category?: Category | 'set' | 'choker';
  material?: Material | 'emerald' | 'pearl' | 'sapphire' | 'kundan';
  department?: Department;
  /** A campaign slug. Declared and *read* — the field this replaces was neither. */
  campaign?: string;
  world?: WorldSlug;
  style?: StyleTag;
  purity?: Karat;
  /** Inclusive. Only pieces that publish a weight can satisfy it; the rest are not "light". */
  maxWeightGrams?: number;
  limit?: number;
}

const CATEGORIES = new Set<string>([
  'bridal-set', 'necklace', 'earrings', 'ring', 'bracelet', 'bangle', 'pendant', 'chain', 'nose-pin', 'cufflink', 'tikka', 'nath', 'set', 'choker',
]);
const MATERIALS = new Set<string>(['gold', 'diamond', 'polki', 'gold-diamond', 'emerald', 'pearl', 'sapphire', 'kundan']);
const DEPARTMENTS = new Set<string>(['gold', 'diamond', 'bridal', 'men', 'kids']);
const STYLES = new Set<string>(['bridal', 'traditional', 'contemporary', 'statement', 'everyday']);
const WORLDS_SET = new Set<string>(['rukh-e-jana', 'aks-e-noor', 'rang-e-jamal', 'dewan', 'royal-wedding']);
const KARATS = new Set<string>(['18K', '21K', '22K', '24K']);

/**
 * Narrowing, not casting. Every one of these replaced an `as never`, which silently turned
 * an unrecognised value into a filter that matched nothing at all.
 */
export const asCategory = (v: unknown): SearchQuery['category'] => (typeof v === 'string' && CATEGORIES.has(v) ? (v as SearchQuery['category']) : undefined);
export const asMaterial = (v: unknown): SearchQuery['material'] => (typeof v === 'string' && MATERIALS.has(v) ? (v as SearchQuery['material']) : undefined);
export const asDepartment = (v: unknown): Department | undefined => (typeof v === 'string' && DEPARTMENTS.has(v) ? (v as Department) : undefined);
export const asStyle = (v: unknown): StyleTag | undefined => (typeof v === 'string' && STYLES.has(v) ? (v as StyleTag) : undefined);
export const asWorld = (v: unknown): WorldSlug | undefined => (typeof v === 'string' && WORLDS_SET.has(v) ? (v as WorldSlug) : undefined);
export const asKarat = (v: unknown): Karat | undefined => (typeof v === 'string' && KARATS.has(v) ? (v as Karat) : undefined);

const SYNONYMS: Record<string, string[]> = {
  necklace: ['necklace', 'choker', 'haar', 'collar', 'satlada', 'raani'],
  choker: ['choker', 'collar', 'necklace'],
  set: ['bridal-set', 'suite', 'set'],
  earrings: ['earrings', 'jhumki', 'chandbali', 'tassel'],
  ring: ['ring', 'halo', 'cluster'],
  traditional: ['polki', 'kundan', 'gold', 'satlada', 'raani', 'filigree', 'antique'],
  diamond: ['diamond', 'pavé', 'pave', 'cluster', 'sapphire', 'white'],
  gold: ['gold', 'pleated', 'filigree', 'kundan', 'polki'],
};

function tokens(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function haystack(p: Product) {
  return [
    p.title,
    nameOf(p),
    p.campaign ?? '',
    p.world ?? '',
    p.category,
    p.material,
    ...p.tags,
    ...p.styleTags,
    ...(p.spec.stones ?? []),
    ...(p.spec.technique ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function matchesCategory(p: Product, c: SearchQuery['category']) {
  if (!c) return true;
  if (c === 'set') return p.category === 'bridal-set';
  if (c === 'choker') return p.category === 'necklace' || p.category === 'bridal-set';
  if (c === 'necklace') return p.category === 'necklace' || p.category === 'bridal-set';
  return p.category === c;
}

function matchesMaterial(p: Product, m: SearchQuery['material']) {
  if (!m) return true;
  const hay = haystack(p);
  if (m === 'gold') return p.material === 'gold' || p.material === 'gold-diamond' || p.material === 'polki';
  if (m === 'diamond') return p.material === 'diamond' || p.material === 'gold-diamond';
  if (m === 'polki') return p.material === 'polki' || hay.includes('polki') || hay.includes('kundan');
  return hay.includes(m);
}

/**
 * Scores the listable catalogue against a structured query, best matches first.
 *
 * Every structured field is a *filter* rather than a penalty. The version this replaces
 * scored a non-match at −100 and then kept it, which meant an unrecognised value produced a
 * result set of things that did not match at all rather than an empty one.
 */
export function searchCatalogue(q: SearchQuery): Product[] {
  const limit = q.limit ?? 4;
  const queryTokens = q.query ? tokens(q.query) : [];
  const scored = LISTABLE_PRODUCTS.map((p) => {
    let score = 0;
    if (q.category) {
      if (!matchesCategory(p, q.category)) return { p, score: -1 };
      score += 4;
    }
    if (q.material) {
      if (!matchesMaterial(p, q.material)) return { p, score: -1 };
      score += 3;
    }
    if (q.department) {
      if (!p.departments.includes(q.department)) return { p, score: -1 };
      score += 3;
    }
    if (q.campaign) {
      if (p.campaignSlug !== q.campaign) return { p, score: -1 };
      score += 4;
    }
    if (q.purity) {
      if (p.spec.purity !== q.purity) return { p, score: -1 };
      score += 2;
    }
    if (q.maxWeightGrams !== undefined) {
      const g = p.spec.grossWeightGrams;
      if (g === undefined || g > q.maxWeightGrams) return { p, score: -1 };
      score += 2;
    }
    if (q.world) {
      if (p.world !== q.world) return { p, score: -1 };
      score += 4;
    }
    if (q.style) {
      if (!p.styleTags.includes(q.style)) return { p, score: -1 };
      score += 3;
    }
    const hay = haystack(p);
    for (const t of queryTokens) {
      const alts = SYNONYMS[t] ?? [t];
      if (alts.some((a) => hay.includes(a))) score += 1;
    }
    // a piece the site knows more about leads, all else equal
    if (p.completeness.tier === 'flagship') score += 1;
    return { p, score };
  })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || (a.p.featuredRank ?? 999) - (b.p.featuredRank ?? 999));
  return scored.slice(0, limit).map((s) => s.p);
}

/**
 * Pieces in the same spirit: same department → same kind → same material → shared tags.
 *
 * Every comparison is guarded against both sides being absent. `p.material === anchor.material`
 * is true for two pieces that each publish no material, which is not a similarity — it is two
 * silences, and rewarding it filled these rails with whatever happened to be first.
 */
export function similarTo(slug: string, limit = 4): Product[] {
  const anchor = PRODUCTS.find((p) => p.slug === slug);
  if (!anchor) return [];
  const both = <T>(a: T | undefined, b: T | undefined) => a !== undefined && a === b;
  // the anchor may be any piece; what is offered back must be a piece with a page
  return LISTABLE_PRODUCTS.filter((p) => p.slug !== slug)
    .map((p) => {
      let score = 0;
      if (both(anchor.world, p.world)) score += 4;
      if (p.departments.some((d) => anchor.departments.includes(d))) score += 4;
      if (both(anchor.material, p.material)) score += 3;
      if (both(anchor.category, p.category)) score += 3;
      if (both(anchor.spec.purity, p.spec.purity)) score += 1;
      score += p.tags.filter((t) => anchor.tags.includes(t)).length;
      if (anchor.complementary.includes(p.slug)) score += 2;
      return { p, score };
    })
    // a piece with nothing in common is not "similar"; it is simply another piece
    .filter((s) => s.score >= 4)
    .sort((a, b) => b.score - a.score || (a.p.featuredRank ?? 999) - (b.p.featuredRank ?? 999))
    .slice(0, limit)
    .map((s) => s.p);
}

/** Finds a product by a spoken or typed name fragment ("naqsh", "sapphire suite", "lavender ring"). */
const GENERIC_NAME_WORDS = new Set([
  'the', 'and', 'with', 'set', 'suite', 'bridal', 'necklace', 'necklaces', 'choker', 'collar', 'ring', 'rings', 'earring', 'earrings',
  'gold', 'diamond', 'diamonds', 'piece', 'pieces', 'jewellery', 'jewelry', 'haar', 'polki', 'kundan', 'pearl', 'emerald', 'sapphire',
]);

/** Distinctive words of a product's name: world names and proper descriptors, never generic jewellery words. */
function nameTokens(p: Product): string[] {
  const raw = `${nameOf(p)} ${p.title} ${p.reference ?? ''} ${p.world ?? ''} ${p.slug}`.toLowerCase();
  return raw
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !GENERIC_NAME_WORDS.has(w));
}

export function findByName(text: string): Product | undefined {
  const t = tokens(text).flatMap((w) => w.split('-')).filter((w) => w.length > 2);
  if (t.length === 0) return undefined;
  let best: { p: Product; score: number } | null = null;
  for (const p of LISTABLE_PRODUCTS) {
    const names = nameTokens(p);
    const distinctive = t.filter((w) => names.includes(w)).length;
    if (distinctive === 0) continue;
    const generic = t.filter((w) => GENERIC_NAME_WORDS.has(w) && haystack(p).includes(w)).length;
    const score = distinctive * 3 + generic;
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p;
}
