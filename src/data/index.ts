import { IMAGES, VIDEOS } from './generated/asset-map';
import type { Collection, ImageAsset, Product, VideoAsset } from './types';
import { PRODUCTS } from './products';
import { COLLECTIONS, COLLECTION_BY_SLUG } from './collections';
import { WORLDS, WORLD_BY_SLUG } from './worlds';
import { HERITAGE } from './heritage';
import { MENU } from './menu';
import { SITE } from './site';

export { PRODUCTS, COLLECTIONS, WORLDS, WORLD_BY_SLUG, HERITAGE, MENU, SITE };

const PRODUCT_BY_SLUG = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p])) as Record<string, Product>;

export function getProduct(slug: string): Product | undefined {
  return PRODUCT_BY_SLUG[slug];
}

export function getCollection(slug: string): Collection | undefined {
  return COLLECTION_BY_SLUG[slug];
}

export function getImage(id: string): ImageAsset {
  const asset = (IMAGES as Record<string, ImageAsset>)[id];
  if (!asset) {
    if (process.env.NODE_ENV === 'development') console.warn(`[assets] unknown image id "${id}"`);
    return {
      id,
      src: '',
      width: 4,
      height: 5,
      alt: '',
      blurDataURL: '',
      focal: [0.5, 0.5],
      role: 'campaign',
      maxDisplayWidth: 0,
    };
  }
  return asset;
}

export function getVideo(id: string): VideoAsset | undefined {
  return (VIDEOS as Record<string, VideoAsset>)[id];
}

export function productsBySlugs(slugs: readonly string[]): Product[] {
  return slugs.map((s) => PRODUCT_BY_SLUG[s]).filter((p): p is Product => Boolean(p));
}

/** Light development assertion — runs once on the client in development. */
export function assertCatalogue() {
  if (process.env.NODE_ENV !== 'development') return;
  const slugs = new Set<string>();
  const problems: string[] = [];
  for (const p of PRODUCTS) {
    if (slugs.has(p.slug)) problems.push(`duplicate slug ${p.slug}`);
    slugs.add(p.slug);
    if (p.price.kind === 'fixed' && p.price.pkr <= 0) problems.push(`${p.slug}: non-positive price`);
    if ((p.house ?? p.title) === p.title && p.title.trim().length === 0) problems.push(`${p.slug}: empty title`);
    for (const c of p.complementary) if (!PRODUCT_BY_SLUG[c]) problems.push(`${p.slug}: unknown complementary ${c}`);
    for (const id of [p.media.hero, ...p.media.gallery, p.media.macro, p.media.campaign]) {
      if (id && !(IMAGES as Record<string, ImageAsset>)[id]) problems.push(`${p.slug}: unknown image ${id}`);
      if (id && !(IMAGES as Record<string, ImageAsset>)[id]?.alt) problems.push(`${p.slug}: missing alt for ${id}`);
    }
  }
  for (const c of COLLECTIONS) {
    for (const s of [...c.pieces, ...c.edits.gold, ...c.edits.diamond, ...c.wornTogether]) {
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
