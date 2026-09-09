/**
 * Stage 5: write the generated catalogue.
 *
 * JSON plus a thin typed loader, not a 656-entry TypeScript literal — a literal that size
 * measurably slows `tsc --noEmit` and every Turbopack refresh, for no benefit.
 *
 * Everything written here is machine-owned and is clobbered on the next sync. Authored
 * copy lives in src/data/editorial/* and is never touched by this script; the two merge at
 * module load in src/data/products.ts.
 *
 *   node scripts/catalogue/emit.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE, GENERATED, readJson, writeJson, rel, PRODUCT_URL } from './lib.mjs';

const OCCASION_BY_DEPT = { bridal: ['wedding', 'baraat', 'walima', 'mehndi'] };

/** Only what the shop's own filing supports; never inferred from a photograph. */
function occasionsOf(p) {
  const out = new Set();
  for (const d of p.departments) for (const o of OCCASION_BY_DEPT[d] ?? []) out.add(o);
  if (p.category === 'ring' && /engagement/i.test(p.collections.join(' '))) out.add('engagement');
  return [...out];
}

function completenessOf(p) {
  const hasSpec = Object.keys(p.spec).length > 0;
  const tier = p.imageTier === 'local' && hasSpec && p.reference ? 'flagship' : p.listable && p.images.length ? 'catalogue' : 'thin';
  return {
    tier,
    hasSpec,
    hasReference: Boolean(p.reference),
    hasEditorial: false, // the merge sets this where an editorial entry exists
    imageCount: p.images.length,
    maxImageWidth: p.maxImageWidth,
    gaps: p.gaps,
  };
}

const { products, stats, fetchedAt, ...rest } = await readJson(path.join(CACHE, 'media.json'));
const syncedAt = new Date().toISOString();

const emitted = products.map((p) => {
  const images = p.media.map((m, i) => ({
    // every image starts remote; scripts/assets localises the flagship set and rewrites
    // these to { kind: 'local' } on its next run
    ref: { kind: 'remote', src: m.remote, width: m.width, height: m.height },
    role: m.role,
    order: i,
    alt: p.altDerived,
    altDerived: true,
  }));

  return {
    id: `s${p.shopifyId}`,
    slug: p.handle,
    sourceHandle: p.handle,
    reference: p.reference,
    sku: p.sku,
    title: p.title,
    departments: p.departments,
    category: p.category,
    gender: p.gender,
    material: p.material,
    tags: p.tags,
    styleTags: [],
    occasions: occasionsOf(p),
    campaign: p.campaign,
    campaignSlug: p.campaignSlug,
    spec: p.spec,
    provenance: Object.fromEntries(Object.keys(p.spec).map((k) => [k, 'parsed-body'])),
    price: p.price > 0 ? { kind: 'fixed', pkr: p.price, asOf: syncedAt.slice(0, 10) } : { kind: 'onRequest' },
    media: { hero: images[0], gallery: images },
    complementary: [],
    listable: p.listable,
    withheld: p.withheld,
    completeness: completenessOf(p),
    source: { handle: p.handle, url: PRODUCT_URL(p.handle), syncedAt },
  };
});

/**
 * There is deliberately no generated facet index here.
 *
 * A row built from this file alone would be wrong in the one place it matters: the ten
 * authored pieces carry an editor's slug and an editor's name, and seven of them are
 * listable only because an editor supplied the name the shop had not. The index the browser
 * receives is projected from the *merged* catalogue by `CatalogueRepository.rows()`, and
 * arrives with the page that needs it — one department at a time, not the whole shop.
 */

// ── taxonomy, derived from the data rather than hand-maintained ─────────────
const tally = (get) => {
  const m = {};
  for (const p of emitted) if (p.listable) for (const v of [get(p)].flat().filter(Boolean)) m[v] = (m[v] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const WEIGHT_BANDS = [
  ['<5', 0, 5],
  ['5-15', 5, 15],
  ['15-30', 15, 30],
  ['30-60', 30, 60],
  ['60+', 60, Infinity],
];
const weightBands = Object.fromEntries(
  WEIGHT_BANDS.map(([label, lo, hi]) => [
    label,
    emitted.filter((p) => p.listable && p.spec.grossWeightGrams !== undefined && p.spec.grossWeightGrams >= lo && p.spec.grossWeightGrams < hi).length,
  ]),
);

const taxonomy = {
  syncedAt,
  departments: tally((p) => p.departments),
  categories: tally((p) => p.category),
  materials: tally((p) => p.material),
  purities: tally((p) => p.spec.purity),
  campaigns: tally((p) => p.campaignSlug),
  occasions: tally((p) => p.occasions),
  diamondClarity: tally((p) => p.spec.diamondClarity),
  diamondColour: tally((p) => p.spec.diamondColour),
  weightBands,
  // said out loud so no facet UI ever offers price as a primary axis
  pricedProducts: emitted.filter((p) => p.price.kind === 'fixed').length,
  listable: emitted.filter((p) => p.listable).length,
  imported: emitted.length,
};

await fs.mkdir(GENERATED, { recursive: true });
await writeJson(path.join(GENERATED, 'catalogue.json'), { syncedAt, fetchedAt, count: emitted.length, products: emitted });
await writeJson(path.join(GENERATED, 'taxonomy.json'), taxonomy);

const loader = `/* Generated by scripts/catalogue — do not edit. Run \`npm run catalogue\`. */
import type { Product } from '../types';
import data from './catalogue.json';

/**
 * The whole imported catalogue, straight from the shop and untouched by hand.
 *
 * Authored copy is layered on top in src/data/products.ts; nothing in this file survives a
 * re-sync. Server and build only — the eslint rule in eslint.config.mjs keeps it out of
 * the client, where it would cost about a megabyte. The browser is sent rows, by the
 * repository, one department at a time.
 */
export const GENERATED_PRODUCTS = data.products as unknown as Product[];
export const CATALOGUE_SYNCED_AT = data.syncedAt;
export const CATALOGUE_COUNT = data.count;
`;
await fs.writeFile(path.join(GENERATED, 'catalogue.ts'), loader, 'utf8');

const size = (f) => Math.round(JSON.stringify(f).length / 1024);
console.log(`catalogue      ${emitted.length} products   ${size({ products: emitted })} kB`);
console.log(`taxonomy       ${Object.keys(taxonomy.categories).length} categories, ${Object.keys(taxonomy.purities).length} purities`);
console.log('\ncategories:', JSON.stringify(taxonomy.categories));
console.log('weight bands:', JSON.stringify(taxonomy.weightBands));
console.log(`\n→ ${rel(GENERATED)}/catalogue.{json,ts}, taxonomy.json`);
