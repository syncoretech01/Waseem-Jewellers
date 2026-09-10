import type { Department, Karat, Material, StyleTag, WorldSlug, Category } from './types';

/**
 * The vocabulary the catalogue publishes, and the narrowing that turns an unknown value into
 * `undefined` rather than a filter that matches nothing.
 *
 * It lives apart from `search.ts` because `search.ts` imports the merged catalogue — about a
 * megabyte — and the browser needs these narrowings without it. Every one of them replaced an
 * `as never`, which silently turned an unrecognised value into a query that scored −100
 * against every product and returned an empty room.
 */
export type QueryCategory = Category | 'set' | 'choker';
export type QueryMaterial = Material | 'emerald' | 'pearl' | 'sapphire' | 'kundan' | 'ruby';

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
export const asCategory = (v: unknown): QueryCategory | undefined => (typeof v === 'string' && CATEGORIES.has(v) ? (v as QueryCategory) : undefined);
export const asMaterial = (v: unknown): QueryMaterial | undefined => (typeof v === 'string' && MATERIALS.has(v) ? (v as QueryMaterial) : undefined);
export const asDepartment = (v: unknown): Department | undefined => (typeof v === 'string' && DEPARTMENTS.has(v) ? (v as Department) : undefined);
export const asStyle = (v: unknown): StyleTag | undefined => (typeof v === 'string' && STYLES.has(v) ? (v as StyleTag) : undefined);
export const asWorld = (v: unknown): WorldSlug | undefined => (typeof v === 'string' && WORLDS_SET.has(v) ? (v as WorldSlug) : undefined);
export const asKarat = (v: unknown): Karat | undefined => (typeof v === 'string' && KARATS.has(v) ? (v as Karat) : undefined);

/**
 * The kind a query word means, in the vocabulary the catalogue stores.
 *
 * A visitor says "choker" and "set"; the shop classifies those pieces as 'necklace' and
 * 'bridal-set'. Comparing the visitor's word to the stored value directly returns nothing —
 * not an error, just an empty room and a concierge saying the shop has none. The server
 * search has carried this mapping since Stage 1; the browser index compared exactly.
 */
const CANONICAL: Record<string, Category> = {
  set: 'bridal-set',
  choker: 'necklace',
};

export const canonicalCategory = (v: unknown): Category | undefined => {
  const c = asCategory(v);
  return c === undefined ? undefined : ((CANONICAL[c] ?? c) as Category);
};

