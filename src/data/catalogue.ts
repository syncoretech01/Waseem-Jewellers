import { IMAGES } from './generated/asset-map';
import { PRODUCTS, LISTABLE_PRODUCTS, ORPHANED_EDITORIAL, CATALOGUE_DATE } from './products';
import { COLLECTIONS } from './collections';
import { WORLDS } from './worlds';
import type { ImageAsset, Product } from './types';

/**
 * The merged catalogue, for the server and the build.
 *
 * About a megabyte. It used to live in `@/data`, which meant every client component that
 * wanted `getImage` dragged 656 products along with it — a 1.14 MB chunk in the browser that
 * the ESLint rule never caught, because the offending import was transitive.
 *
 * Pages reach this through `@/data/repository`; the browser reaches a projection of it
 * through `@/data/clientIndex`, fetched on demand. Nothing in `src/components`,
 * `src/concierge`, `src/state` or `src/motion` may import this file, and ESLint says so.
 */
export { PRODUCTS, LISTABLE_PRODUCTS, ORPHANED_EDITORIAL, CATALOGUE_DATE };

const PRODUCT_BY_SLUG = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p])) as Record<string, Product>;

export function getProduct(slug: string): Product | undefined {
  return PRODUCT_BY_SLUG[slug];
}

export function productsBySlugs(slugs: readonly string[]): Product[] {
  return slugs.map((s) => PRODUCT_BY_SLUG[s]).filter((p): p is Product => Boolean(p));
}

/**
 * Light development assertion.
 *
 * It runs on the server now rather than in the browser: it needs the whole catalogue, and
 * the whole catalogue is precisely what the browser must not be given.
 */
export function assertCatalogue() {
  if (process.env.NODE_ENV !== 'development') return;
  const slugs = new Set<string>();
  const problems: string[] = [];
  for (const p of PRODUCTS) {
    if (slugs.has(p.slug)) problems.push(`duplicate slug ${p.slug}`);
    slugs.add(p.slug);
    if (p.price.kind === 'fixed' && p.price.pkr <= 0) problems.push(`${p.slug}: non-positive price`);
    if (p.title.trim().length === 0) problems.push(`${p.slug}: empty title`);
    for (const c of p.complementary) if (!PRODUCT_BY_SLUG[c]) problems.push(`${p.slug}: unknown complementary ${c}`);
    // only a localised image can be checked against the asset map; a remote one is resolved
    // by the optimiser and carries its dimensions with it
    for (const img of [p.media.hero, ...p.media.gallery]) {
      if (img.ref.kind !== 'local') continue;
      const asset = (IMAGES as Record<string, ImageAsset>)[img.ref.id];
      if (!asset) problems.push(`${p.slug}: unknown image ${img.ref.id}`);
      else if (!asset.alt && !img.alt) problems.push(`${p.slug}: missing alt for ${img.ref.id}`);
    }
  }
  for (const c of COLLECTIONS) {
    for (const s of [...c.pieces, ...c.wornTogether]) {
      if (!PRODUCT_BY_SLUG[s]) problems.push(`collection ${c.slug}: unknown piece ${s}`);
    }
  }
  for (const w of WORLDS) {
    for (const id of [...w.imagery.column, w.imagery.hero]) {
      if (!(IMAGES as Record<string, ImageAsset>)[id]) problems.push(`world ${w.slug}: unknown image ${id}`);
    }
  }
  if (problems.length) console.warn('[catalogue]', problems);
}
