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

