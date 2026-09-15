/**
 * The barrel a browser may import.
 *
 * It carries the asset map, the site facts, the menu, the worlds and the labels — and
 * deliberately **not** the catalogue. `products.ts` is about a megabyte merged, and this file
 * re-exporting it meant every component that wanted `getImage` pulled 656 products and 1,464
 * image records into the client bundle. The ESLint rule guarding `generated/catalogue` never
 * saw it, because nothing imported that path directly.
 *
 * Server code takes `@/data/catalogue`; the browser takes `@/data/clientIndex`, which is
 * fetched on demand and a sixteenth of the size.
 */
import { IMAGES, VIDEOS } from './generated/asset-map';
import type { AssetRole, Collection, ImageAsset, VideoAsset, ImageRef } from './types';
import { COLLECTIONS, COLLECTION_BY_SLUG } from './collections';
import { WORLDS, WORLD_BY_SLUG } from './worlds';
import { HERITAGE } from './heritage';
import { MENU, MENU_SECONDARY, MENU_ALL } from './menu';
import { SITE } from './site';
export * from './labels';

export { COLLECTIONS, WORLDS, WORLD_BY_SLUG, HERITAGE, MENU, MENU_SECONDARY, MENU_ALL, SITE };

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
/**
 * The shop's CDN resizes on request. Asking it for a 2048 px source instead of the
 * 4000–4500 px original means the optimiser fetches a fifth of the bytes on every cache
 * miss and transforms a frame a quarter the size — the difference between a tile that
 * arrives and one that is still empty when the visitor scrolls on. Nothing displayed here
 * is wider than 2048 px, so no quality is given up.
 */
export const REMOTE_SOURCE_WIDTH = 2048;
export function sizedRemoteSource(src: string, width = REMOTE_SOURCE_WIDTH): string {
  if (!src.startsWith('https://cdn.shopify.com/')) return src;
  if (/[?&]width=/.test(src)) return src;
  return `${src}${src.includes('?') ? '&' : '?'}width=${width}`;
}

export function resolveImage(ref: ImageRef, alt?: string, role?: AssetRole): ImageAsset {
  if (ref.kind === 'local') {
    const asset = getImage(ref.id);
    return alt ? { ...asset, alt } : asset;
  }
  return {
    id: ref.src,
    src: sizedRemoteSource(ref.src),
    width: ref.width,
    height: ref.height,
    alt: alt ?? '',
    blurDataURL: '',
    focal: [0.5, 0.5],
    // a long-tail photograph is a studio cut-out unless the shop filed it under a campaign;
    // the difference decides whether it is mounted on pearl or shown full-bleed
    role: role ?? 'packshot',
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
