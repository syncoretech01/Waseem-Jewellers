import type { Category, Material, Product, StyleTag, WorldSlug } from './types';
import { PRODUCTS } from './products';

export interface SearchQuery {
  query?: string;
  category?: Category | 'set' | 'choker';
  material?: Material | 'emerald' | 'pearl' | 'sapphire' | 'kundan';
  collection?: string;
  world?: WorldSlug;
  style?: StyleTag;
  limit?: number;
}

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
    p.editorialTitle,
    p.house ?? '',
    p.world ?? '',
    p.category,
    p.material,
    ...p.tags,
    ...p.styleTags,
    ...(p.metadata.stones ?? []),
    ...(p.metadata.technique ?? []),
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

/** Scores the catalogue against a structured query; returns the best matches in featured order. */
export function searchCatalogue(q: SearchQuery): Product[] {
  const limit = q.limit ?? 4;
  const queryTokens = q.query ? tokens(q.query) : [];
  const scored = PRODUCTS.map((p) => {
    let score = 0;
    if (q.category) {
      if (!matchesCategory(p, q.category)) return { p, score: -1 };
      score += 4;
    }
    if (q.material) {
      if (!matchesMaterial(p, q.material)) return { p, score: -1 };
      score += 3;
    }
    if (q.world) score += p.world === q.world ? 4 : -100;
    if (q.style) score += p.styleTags.includes(q.style) ? 3 : -100;
    const hay = haystack(p);
    for (const t of queryTokens) {
      const alts = SYNONYMS[t] ?? [t];
      if (alts.some((a) => hay.includes(a))) score += 1;
    }
    return { p, score };
  })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || a.p.featuredRank - b.p.featuredRank);
  return scored.slice(0, limit).map((s) => s.p);
}

/** Pieces in the same spirit: same world → same material → same category → shared tags. */
export function similarTo(slug: string, limit = 4): Product[] {
  const anchor = PRODUCTS.find((p) => p.slug === slug);
  if (!anchor) return [];
  return PRODUCTS.filter((p) => p.slug !== slug)
    .map((p) => {
      let score = 0;
      if (anchor.world && p.world === anchor.world) score += 4;
      if (p.material === anchor.material) score += 3;
      if (p.category === anchor.category) score += 2;
      score += p.tags.filter((t) => anchor.tags.includes(t)).length;
      if (anchor.complementary.includes(p.slug)) score += 2;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || a.p.featuredRank - b.p.featuredRank)
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
  const raw = `${p.editorialTitle} ${p.title} ${p.metadata.itemCode ?? ''} ${p.world ?? ''} ${p.slug}`.toLowerCase();
  return raw
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !GENERIC_NAME_WORDS.has(w));
}

export function findByName(text: string): Product | undefined {
  const t = tokens(text).flatMap((w) => w.split('-')).filter((w) => w.length > 2);
  if (t.length === 0) return undefined;
  let best: { p: Product; score: number } | null = null;
  for (const p of PRODUCTS) {
    const names = nameTokens(p);
    const distinctive = t.filter((w) => names.includes(w)).length;
    if (distinctive === 0) continue;
    const generic = t.filter((w) => GENERIC_NAME_WORDS.has(w) && haystack(p).includes(w)).length;
    const score = distinctive * 3 + generic;
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p;
}
