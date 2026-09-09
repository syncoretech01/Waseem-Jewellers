import { IMAGES, VIDEOS } from './generated/asset-map';
import type { Collection, ImageAsset, Product, VideoAsset, ImageRef } from './types';
import { PRODUCTS, LISTABLE_PRODUCTS, ORPHANED_EDITORIAL, CATALOGUE_DATE } from './products';
import { COLLECTIONS, COLLECTION_BY_SLUG } from './collections';
import { WORLDS, WORLD_BY_SLUG } from './worlds';
import { HERITAGE } from './heritage';
import { MENU } from './menu';
import { SITE } from './site';
export * from './labels';

export { PRODUCTS, LISTABLE_PRODUCTS, ORPHANED_EDITORIAL, CATALOGUE_DATE, COLLECTIONS, WORLDS, WORLD_BY_SLUG, HERITAGE, MENU, SITE };

const PRODUCT_BY_SLUG = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p])) as Record<string, Product>;

export function getProduct(slug: string): Product | undefined {
  return PRODUCT_BY_SLUG[slug];
}

export function getCollection(slug: string): Collection | undefined {
  return COLLECTION_BY_SLUG[slug];
}

/**
 * Resolves either tier of photograph to one shape.
 *
 * A flagship image is an id in the generated asset map — localised, committed, with a real
 * blur placeholder. A long-tail image is a source the optimiser resizes for us, so it has
 * no placeholder and no focal point, and the caller must not pretend otherwise.
 */
export function resolveImage(ref: ImageRef, alt?: string): ImageAsset {
  if (ref.kind === 'local') {
    const asset = getImage(ref.id);
    return alt ? { ...asset, alt } : asset;
  }
  return {
    id: ref.src,
    src: ref.src,
    width: ref.width,
    height: ref.height,
    alt: alt ?? '',
    blurDataURL: '',
    focal: [0.5, 0.5],
    role: 'packshot',
    // half, as the localiser does for a packshot: a studio cut-out is never shown full-bleed
    maxDisplayWidth: Math.round(ref.width / 2),
  };
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
    if (p.title.trim().length === 0) problems.push(`${p.slug}: empty title`);
    for (const c of p.complementary) if (!PRODUCT_BY_SLUG[c]) problems.push(`${p.slug}: unknown complementary ${c}`);
    // only a localised image can be checked against the asset map; a remote one is
    // resolved by the optimiser and carries its dimensions with it
    for (const img of [p.media.hero, ...p.media.gallery]) {
      if (img.ref.kind !== 'local') continue;
      const asset = (IMAGES as Record<string, ImageAsset>)[img.ref.id];
      if (!asset) problems.push(`${p.slug}: unknown image ${img.ref.id}`);
      else if (!asset.alt && !img.alt) problems.push(`${p.slug}: missing alt for ${img.ref.id}`);
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
