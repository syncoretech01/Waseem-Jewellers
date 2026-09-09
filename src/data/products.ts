import type { Product, ProductImage } from './types';
import { GENERATED_PRODUCTS, CATALOGUE_SYNCED_AT } from './generated/catalogue';
import { EDITORIAL, type ProductEditorial } from './editorial/products';

/**
 * The catalogue: what Waseem publishes, with what a person wrote layered on top.
 *
 * Generated data is machine-owned and replaced wholesale on every sync. Authored data is
 * human-owned and never touched by a script. They meet here, keyed by the shop's own
 * product handle, so a re-sync can add, remove or respecify a piece without destroying a
 * word anyone wrote — and if Waseem deletes a product upstream, the build says which
 * authored entry just lost its subject rather than dropping it silently.
 *
 * Server and build only. `eslint.config.mjs` keeps this out of the client, where the full
 * catalogue would cost about a megabyte; client code takes `generated/catalogue.slim`.
 */

/** An authored image id resolves against the asset map; anything else stays remote. */
function editorialImage(id: string, order: number, role: ProductImage['role'], alt: string): ProductImage {
  return { ref: { kind: 'local', id }, role, order, alt };
}

function merge(base: Product, e: ProductEditorial | undefined): Product {
  if (!e) return base;

  const media = e.media?.gallery?.length
    ? {
        hero: editorialImage(e.media.hero ?? e.media.gallery[0]!, 0, 'campaign', e.editorialTitle ?? base.title),
        gallery: e.media.gallery.map((id, i) =>
          editorialImage(id, i, id === e.media?.macro ? 'macro' : i === 0 ? 'campaign' : 'detail', e.editorialTitle ?? base.title),
        ),
        video: e.media.video,
      }
    : base.media;

  const spec = { ...base.spec };
  // stones and techniques are read off the photograph by a person; they are editorial,
  // never a specification Waseem published
  if (e.stones?.length) spec.stones = e.stones.map((kind) => ({ kind }));
  if (e.technique?.length) spec.technique = e.technique;

  return {
    ...base,
    slug: e.slug ?? base.slug,
    editorialTitle: e.editorialTitle,
    urdu: e.urdu,
    campaign: e.campaign ?? base.campaign,
    world: e.world,
    category: e.category ?? base.category,
    subcategory: e.subcategory,
    material: e.material ?? base.material,
    tags: e.tags ?? base.tags,
    styleTags: e.styleTags ?? base.styleTags,
    setId: e.setId,
    setRole: e.setRole,
    spec,
    provenance: {
      ...base.provenance,
      ...(e.stones?.length ? { stones: 'curated' as const } : {}),
      ...(e.technique?.length ? { technique: 'curated' as const } : {}),
    },
    media,
    story: e.story?.lede ? { lede: e.story.lede, craft: e.story.craft ?? '', care: e.story.care ?? '' } : base.story,
    complementary: e.complementary ?? base.complementary,
    featuredRank: e.featuredRank ?? base.featuredRank,
    // a name and a category are exactly what the withholding rule was waiting for
    listable: Boolean(e.editorialTitle && (e.category ?? base.category)) || base.listable,
    withheld: e.editorialTitle && (e.category ?? base.category) ? [] : base.withheld,
    completeness: { ...base.completeness, hasEditorial: true },
  };
}

const byHandle = new Map(GENERATED_PRODUCTS.map((p) => [p.sourceHandle, p]));

/** An authored entry whose subject has left the shop is a fact worth surfacing, not hiding. */
export const ORPHANED_EDITORIAL = Object.keys(EDITORIAL).filter((h) => !byHandle.has(h));

export const PRODUCTS: Product[] = GENERATED_PRODUCTS.map((p) => merge(p, EDITORIAL[p.sourceHandle]));

/** Everything a visitor may meet: named, filed, and photographed. */
export const LISTABLE_PRODUCTS: Product[] = PRODUCTS.filter((p) => p.listable);

export const CATALOGUE_DATE = CATALOGUE_SYNCED_AT;
