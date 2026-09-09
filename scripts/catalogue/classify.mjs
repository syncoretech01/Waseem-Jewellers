/**
 * Stage 3: decide what each product *is*, and what does not belong here at all.
 *
 * Collection membership is the shop's own answer and is used in preference to tags, which
 * disagree with it (the tag "Gold pendants" covers 47 products; the collection
 * gold-pendants covers 49).
 *
 *   node scripts/catalogue/classify.mjs
 */
import path from 'node:path';
import { CACHE, readJson, writeJson, rel, WATCH_COLLECTIONS, DENY_HANDLES, REVIEW_HANDLES } from './lib.mjs';

const RAW = path.join(CACHE, 'raw');

/** The five departments Stage 2 builds. Watches are Waseem's business but not this site's. */
const DEPARTMENTS = ['gold', 'diamond', 'bridal', 'men', 'kids'];

/** Collection handle → category. The handle is more reliable than any title or tag. */
const CATEGORY_BY_SUFFIX = [
  [/-?bridal-sets$|-?polki-sets$/, 'bridal-set'],
  [/-?nosepins$|-?nose-pins$/, 'nose-pin'],
  [/-?cufflinks$/, 'cufflink'],
  [/-?necklace$|-?necklaces$/, 'necklace'],
  [/-?pendants$/, 'pendant'],
  [/-?chains$/, 'chain'],
  [/-?bangles$/, 'bangle'],
  [/-?bracelets$/, 'bracelet'],
  [/-?earrings$|-?earings$/, 'earrings'],
  [/-?rings$/, 'ring'],
];

/** Falls back to the product's own title when no collection settles it. */
const CATEGORY_BY_TITLE = [
  [/\bbridal\s*set\b|\bpolki\s*set\b|\bsuite\b/i, 'bridal-set'],
  [/\bnose\s*pin\b/i, 'nose-pin'],
  [/\bcuff\s*link/i, 'cufflink'],
  [/\bnecklace\b|\bhaar\b|\bcollar\b|\bchoker\b/i, 'necklace'],
  [/\bpendant\b/i, 'pendant'],
  [/\bchain\b/i, 'chain'],
  [/\bbangle/i, 'bangle'],
  [/\bbracelet\b/i, 'bracelet'],
  [/\bear(?:ring|ing)/i, 'earrings'],
  [/\bring\b/i, 'ring'],
  [/\btikka\b|\bjhoomar\b/i, 'tikka'],
  [/\bnath\b/i, 'nath'],
];

/** Campaign lines: the shop's own named collections of photographed pieces. */
const CAMPAIGNS = {
  'royal-wedding': 'Royal Wedding',
  rukhe_jana: 'Rukh-e-Jana',
  'rukhe-jana': 'Rukh-e-Jana',
  'naqsh-e-gul': 'Naqsh-e-Gul',
  'dewan-final': 'Dewan',
  'aks-e-noor': 'Aks-e-Noor',
  'range-jamal': 'Rang-e-Jamal',
  'timeless-treasures': 'Timeless Treasures',
  'bespoke-elegance': 'Bespoke Elegance',
  'bridal-collection': 'Bridal Collection',
};

const BRIDAL_COLLECTIONS = new Set([
  'gold-bridal-sets', 'diamond-bridal-sets', 'diamond-polki-sets', 'bridal-collection',
  ...Object.keys(CAMPAIGNS),
]);

const { products } = await readJson(path.join(CACHE, 'parsed.json'));
const { membership } = await readJson(path.join(RAW, 'membership.json'));
const { collections } = await readJson(path.join(RAW, 'collections.json'));

/** handle → collection handles it belongs to */
const inCollections = new Map();
for (const [handle, info] of Object.entries(membership)) {
  for (const h of info.handles ?? []) {
    if (!inCollections.has(h)) inCollections.set(h, []);
    inCollections.get(h).push(handle);
  }
}

// ── exclusions ──────────────────────────────────────────────────────────────
// Three independent signals, because none alone is sufficient: product_type misses a Rado
// with an empty type, and the watch-brand collections miss watches filed nowhere.
const typedWatch = new Set(products.filter((p) => p.productType === 'watch').map((p) => p.handle));
const inWatchCollection = new Set();
for (const [h, cols] of inCollections) if (cols.some((c) => WATCH_COLLECTIONS.has(c))) inWatchCollection.add(h);

const excluded = new Map();
const note = (h, why) => excluded.set(h, [...(excluded.get(h) ?? []), why]);
for (const h of typedWatch) note(h, 'product_type=watch');
for (const h of inWatchCollection) note(h, 'watch-brand collection');
for (const p of products) {
  if (DENY_HANDLES.has(p.handle)) note(p.handle, 'deny-list');
  if (REVIEW_HANDLES.has(p.handle)) note(p.handle, 'awaiting Waseem: watch accessory');
}

const watchReconciliation = {
  typedAsWatch: typedWatch.size,
  inWatchBrandCollections: inWatchCollection.size,
  typedButNotInCollection: [...typedWatch].filter((h) => !inWatchCollection.has(h)).length,
  inCollectionButNotTyped: [...inWatchCollection].filter((h) => !typedWatch.has(h)),
  denyList: [...DENY_HANDLES],
  awaitingReview: [...REVIEW_HANDLES].filter((h) => products.some((p) => p.handle === h)),
  totalExcluded: excluded.size,
};

// ── classification ──────────────────────────────────────────────────────────
function departmentsOf(cols, tags, title) {
  const d = new Set();
  const all = [...cols, ...tags.map((t) => t.toLowerCase().replace(/\s+/g, '-'))];
  for (const c of all) {
    if (/^men\b|^men-/.test(c)) d.add('men');
    if (/^kid/.test(c)) d.add('kids');
    if (/^diamond/.test(c)) d.add('diamond');
    if (/^gold/.test(c)) d.add('gold');
    if (BRIDAL_COLLECTIONS.has(c)) d.add('bridal');
    if (c === 'online-experience') d.add('gold');
  }
  // a gold bridal set is genuinely in both; a bridal set with no material signal is bridal
  if (!d.size && /bridal|polki/i.test(title)) d.add('bridal');
  return [...d].filter((x) => DEPARTMENTS.includes(x));
}

/**
 * A last resort for a piece the shop has filed in no material collection — three of them,
 * all well specified. A published 21K purity puts a piece in Gold and a published diamond
 * carat puts it in Diamond: that is reading Waseem's own specification, not guessing, and
 * it is the same standard already applied to category via the title.
 */
function departmentsFromSpec(spec, title) {
  const d = new Set();
  if (spec.diamondCarat !== undefined || spec.diamondClarity || /diamond/i.test(title)) d.add('diamond');
  if (spec.purity || /gold/i.test(title)) d.add('gold');
  return [...d];
}

function categoryOf(cols, title) {
  for (const c of cols) for (const [re, cat] of CATEGORY_BY_SUFFIX) if (re.test(c)) return cat;
  for (const [re, cat] of CATEGORY_BY_TITLE) if (re.test(title)) return cat;
  return undefined;
}

function materialOf(depts, cols, spec, title) {
  const polki = cols.some((c) => /polki/.test(c)) || /polki|kundan/i.test(title);
  if (polki) return 'polki';
  const diamond = depts.includes('diamond') || spec.diamondCarat !== undefined || spec.diamondClarity !== undefined;
  const gold = depts.includes('gold') || spec.purity !== undefined;
  if (diamond && gold) return 'gold-diamond';
  if (diamond) return 'diamond';
  if (gold) return 'gold';
  return undefined;
}

const classified = [];
for (const p of products) {
  if (excluded.has(p.handle)) continue;
  const cols = inCollections.get(p.handle) ?? [];
  const gaps = [...p.gaps];
  const category = categoryOf(cols, p.rawTitle);
  const filed = departmentsOf(cols, p.tags, p.rawTitle);
  const material = materialOf(filed, cols, p.spec, p.rawTitle);
  const departments = filed.length ? filed : departmentsFromSpec(p.spec, p.rawTitle);
  const campaignKey = cols.find((c) => CAMPAIGNS[c]);
  const gender = departments.includes('men') ? 'men' : departments.includes('kids') ? 'kids' : 'women';

  if (!departments.length) gaps.push('no-department');
  if (!category) gaps.push('no-category');
  if (!material) gaps.push('no-material');
  if (!p.images.length) gaps.push('no-image');
  // the campaign lines repeat the collection name as the title and publish no body at all
  if (!p.hasDetails && !Object.keys(p.spec).length) gaps.push('no-specification');
  if (campaignKey && !p.hasDetails) gaps.push('generic-title');

  classified.push({
    ...p,
    collections: cols,
    departments,
    category,
    material,
    gender,
    campaign: campaignKey ? CAMPAIGNS[campaignKey] : undefined,
    campaignSlug: campaignKey,
    gaps: [...new Set(gaps)],
  });
}

// ── duplicates, by evidence rather than by handle ───────────────────────────
// A `-copy` suffix is a Shopify record-duplication artefact, not duplicate content: all six
// carry their own photograph. Measured across the imported set there are 808 distinct image
// URLs, none shared and no two products with the same image set. So the only honest test is
// identity of imagery, and it currently flags nothing.
const bySignature = new Map();
for (const p of classified) {
  const sig = p.images.map((i) => i.src).sort().join('|');
  if (!sig) continue;
  if (!bySignature.has(sig)) bySignature.set(sig, []);
  bySignature.get(sig).push(p.handle);
}
const duplicateSets = [...bySignature.values()].filter((v) => v.length > 1);
const duplicateHandles = new Set(duplicateSets.flat().slice(1));
for (const p of classified) if (duplicateHandles.has(p.handle)) p.gaps.push('duplicate-imagery');

// ── what may appear in front of a visitor ───────────────────────────────────
// Importing a product and listing it are different decisions. Everything is imported so the
// data is complete and the audit can speak to it; a product is only *listed* when it can be
// filed and named honestly. Nothing here is guessed to make a product listable.
for (const p of classified) {
  const withheld = [];
  if (!p.images.length) withheld.push('no image');
  if (!p.departments.length) withheld.push('no department');
  // a photograph of a bridal model could be a set, a necklace or earrings; the shop does not
  // say which, and a guess would be an invention
  if (!p.category) withheld.push('category not published');
  // the campaign lines repeat their collection name as the title, so there is no name to show
  if (p.gaps.includes('generic-title')) withheld.push('awaiting a name from Waseem');
  if (p.gaps.includes('duplicate-imagery')) withheld.push('duplicate imagery');
  p.withheld = withheld;
  // the editorial layer can lift a product out of this by supplying a name and a category
  p.listable = withheld.length === 0;
}

const count = (fn) => classified.filter(fn).length;
const stats = {
  fetched: products.length,
  excluded: excluded.size,
  imported: classified.length,
  byDepartment: Object.fromEntries(DEPARTMENTS.map((d) => [d, count((p) => p.departments.includes(d))])),
  multiDepartment: count((p) => p.departments.length > 1),
  noDepartment: count((p) => !p.departments.length),
  noCategory: count((p) => !p.category),
  noMaterial: count((p) => !p.material),
  noSpecification: count((p) => p.gaps.includes('no-specification')),
  genericTitle: count((p) => p.gaps.includes('generic-title')),
  duplicateImagery: duplicateSets.length,
  listable: count((p) => p.listable),
  withheld: count((p) => !p.listable),
  withheldReasons: classified.flatMap((p) => p.withheld).reduce((m, r) => ({ ...m, [r]: (m[r] ?? 0) + 1 }), {}),
  withCampaign: count((p) => p.campaign),
  watchReconciliation,
};

await writeJson(path.join(CACHE, 'classified.json'), {
  classifiedAt: new Date().toISOString(),
  stats,
  excluded: Object.fromEntries(excluded),
  collections: collections.map((c) => ({ handle: c.handle, title: c.title, count: c.products_count, fetched: membership[c.handle]?.handles?.length ?? 0 })),
  products: classified,
});

console.log(`fetched ${stats.fetched}  excluded ${stats.excluded}  imported ${stats.imported}`);
console.log('\nwatches — three signals reconciled:');
console.log(`  typed product_type=watch        ${watchReconciliation.typedAsWatch}`);
console.log(`  in a watch-brand collection     ${watchReconciliation.inWatchBrandCollections}`);
console.log(`  typed but in no brand collection ${watchReconciliation.typedButNotInCollection}`);
console.log(`  in a brand collection, untyped  ${watchReconciliation.inCollectionButNotTyped.length}${watchReconciliation.inCollectionButNotTyped.length ? ' → ' + watchReconciliation.inCollectionButNotTyped.join(', ') : ''}`);
console.log(`  deny-list                        ${watchReconciliation.denyList.join(', ')}`);
console.log(`  awaiting Waseem                   ${watchReconciliation.awaitingReview.join(', ') || 'none'}`);
console.log(`  → excluded in total              ${watchReconciliation.totalExcluded}`);
console.log('\ndepartments:', JSON.stringify(stats.byDepartment), ` multi ${stats.multiDepartment}`);
console.log(`gaps: no-department ${stats.noDepartment}, no-category ${stats.noCategory}, no-material ${stats.noMaterial}, no-spec ${stats.noSpecification}, generic-title ${stats.genericTitle}`);
console.log(`
duplicate imagery (identical image sets): ${stats.duplicateImagery}`);
console.log(`listable ${stats.listable} of ${stats.imported}; withheld ${stats.withheld}`);
for (const [r, n] of Object.entries(stats.withheldReasons).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${r}`);
console.log(`\n→ ${rel(path.join(CACHE, 'classified.json'))}`);
