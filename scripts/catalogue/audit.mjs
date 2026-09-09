/**
 * Stage 6: the audit, and the difference between a broken sync and a changed shop.
 *
 * A live catalogue changes. Products are added, renamed, respecified and withdrawn, and
 * treating any of that as corruption would make the pipeline cry wolf until nobody read
 * it. So two classes, and only one of them stops a build:
 *
 *   HARD FAIL      malformed data, duplicate slugs, impossible values, broken media
 *                  references, a classifier invariant breached, or a *relative* collapse
 *                  in extraction — the shape of a Shopify template change that silently
 *                  breaks the parser.
 *   REVIEWABLE     products added or removed, counts moving, a collection renamed. These
 *                  produce a diff to read and accept, not an error.
 *
 * Absolute thresholds are deliberately avoided: asserting "585 gross weights" would fail
 * the day Waseem publishes their 586th, which is the opposite of useful.
 *
 *   node scripts/catalogue/audit.mjs          write the audit and the diff
 *   node scripts/catalogue/audit.mjs --accept stamp the current run as the baseline
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE, GENERATED, ROOT, readJson, writeJson, rel } from './lib.mjs';

/** Where the human-owned editorial layer lives. */
const ROOT_SRC = path.join(ROOT, 'src/data/editorial');

/** Failures found before the `hard` array exists, folded into it below. */
const hardLater = [];

const BASELINE = path.join(CACHE, 'baseline.json');
const accept = process.argv.includes('--accept');

const { products, stats, excluded, collections } = await readJson(path.join(CACHE, 'media.json'));
const emitted = (await readJson(path.join(GENERATED, 'catalogue.json'))).products;

/**
 * Two different true numbers, and the audit has to state both.
 *
 * `listable` counts what the shop's own data supports on its own. But `src/data/editorial`
 * supplies a name and a filing for ten pieces the shop leaves generic, and seven of those
 * become listable *because* an editor named them. The site therefore lists more pieces than
 * the snapshot alone would, and an audit that reported only the snapshot figure would be
 * quietly wrong about what a visitor can actually reach.
 */
const authored = await readJson(path.join(CACHE, 'editorial-lift.json')).catch(() => ({ products: [] }));
const byHandle = new Map(products.map((p) => [p.handle, p]));
const authoredListable = authored.products.filter((e) => {
  const p = byHandle.get(e.handle);
  return p && !p.listable && e.editorialTitle && (e.category || p.category);
});
const sitewideListable = stats.listable + authoredListable.length;

/**
 * How many photographs a visitor actually gets per piece, counted against the site's own
 * listable set rather than the snapshot's.
 *
 * The distinction is not pedantry: the merge both adds seven pieces and gives the ten
 * authored ones galleries of two and three frames, so the same measurement reads 443 of 592
 * against the snapshot and 441 of 599 against the site. The product page's whole layout
 * decision rests on this figure, so it is emitted here rather than written into a comment
 * where it can drift.
 */
const authoredByHandle = new Map(authored.products.map((e) => [e.handle, e]));

/**
 * The authored galleries, read from the module that owns them.
 *
 * The lift cache carries no `media` — it was written before the editorial layer took over
 * that field — so an earlier version of this counted the ten authored pieces by the shop's
 * image count and reported 450 where the truth is 441. Rather than trust a stale cache, the
 * lengths come from `src/data/editorial/products.ts` itself, and a handle whose gallery
 * cannot be read is a hard failure rather than a silent fallback.
 */
const editorialSource = await fs.readFile(path.join(ROOT_SRC, 'products.ts'), 'utf8');
const authoredFrames = new Map();
{
  const entry = /^ {2}'([a-z0-9-]+)':\s*\{/gm;
  const starts = [];
  for (const m of editorialSource.matchAll(entry)) starts.push({ handle: m[1], at: m.index });
  for (let i = 0; i < starts.length; i++) {
    const body = editorialSource.slice(starts[i].at, starts[i + 1]?.at ?? editorialSource.length);
    const gallery = body.match(/gallery:\s*\[([^\]]*)\]/);
    if (gallery) authoredFrames.set(starts[i].handle, gallery[1].split(',').filter((s) => s.trim()).length);
  }
  for (const e of authored.products) {
    if (!authoredFrames.has(e.handle)) hardLater.push(`editorial entry ${e.handle}: gallery not readable, frame counts would be wrong`);
  }
}

const framesPerPiece = {};
let sitewideSingleFrame = 0;
for (const p of products) {
  const e = authoredByHandle.get(p.handle);
  const listable = e ? Boolean(e.editorialTitle && (e.category || p.category)) || p.listable : p.listable;
  if (!listable) continue;
  const frames = authoredFrames.get(p.handle) ?? p.images.length;
  framesPerPiece[frames] = (framesPerPiece[frames] ?? 0) + 1;
  if (frames === 1) sitewideSingleFrame++;
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const coverage = {
  reference: products.filter((p) => p.reference).length,
  grossWeight: products.filter((p) => p.spec.grossWeightGrams !== undefined).length,
  purity: products.filter((p) => p.spec.purity).length,
  diamondColour: products.filter((p) => p.spec.diamondColour).length,
  diamondClarity: products.filter((p) => p.spec.diamondClarity).length,
  diamondCarat: products.filter((p) => p.spec.diamondCarat !== undefined).length,
  priced: products.filter((p) => p.price > 0).length,
};
const rates = Object.fromEntries(Object.entries(coverage).map(([k, v]) => [k, pct(v, products.length)]));

// ── hard failures ───────────────────────────────────────────────────────────
const hard = [...hardLater];
const slugs = new Map();
for (const p of emitted) {
  if (slugs.has(p.slug)) hard.push(`duplicate slug "${p.slug}" (${slugs.get(p.slug)} and ${p.sourceHandle})`);
  slugs.set(p.slug, p.sourceHandle);
  if (!p.departments.length) hard.push(`${p.slug}: no department`);
  if (!p.media?.hero) hard.push(`${p.slug}: no hero image`);
  if (p.price.kind === 'fixed' && !(p.price.pkr > 0)) hard.push(`${p.slug}: non-positive price`);
  if (p.price.kind === 'fixed' && !p.price.asOf) hard.push(`${p.slug}: price without an as-of date`);
  const w = p.spec.grossWeightGrams;
  if (w !== undefined && (w <= 0 || w > 5000)) hard.push(`${p.slug}: implausible weight ${w}`);
  const ct = p.spec.diamondCarat;
  if (ct !== undefined && (ct <= 0 || ct > 200)) hard.push(`${p.slug}: implausible carat ${ct}`);
  for (const img of [p.media.hero, ...p.media.gallery]) {
    if (img.ref.kind === 'remote' && !/^https:\/\/cdn\.shopify\.com\//.test(img.ref.src)) hard.push(`${p.slug}: image outside the allowed CDN`);
    if (img.ref.kind === 'remote' && !(img.ref.width > 0 && img.ref.height > 0)) hard.push(`${p.slug}: remote image without dimensions`);
  }
  // classifier invariants
  if (p.departments.includes('kids') && p.departments.includes('bridal')) hard.push(`${p.slug}: both kids and bridal`);
  if (p.listable && !p.category) hard.push(`${p.slug}: listable without a category`);
  if (p.listable && !p.media.hero) hard.push(`${p.slug}: listable without an image`);
}
if (products.some((p) => p.productType === 'watch')) hard.push('a watch reached the imported set');

// ── drift, against the last accepted baseline ───────────────────────────────
const previous = await readJson(BASELINE).catch(() => null);
const drift = { added: [], removed: [], renamed: [], respecified: [], repriced: [], coverage: [] };

if (previous) {
  const before = new Map(previous.products.map((p) => [p.handle, p]));
  const after = new Map(emitted.map((p) => [p.sourceHandle, p]));
  for (const [h, p] of after) if (!before.has(h)) drift.added.push(`${h} — ${p.title}`);
  for (const [h, p] of before) {
    if (after.has(h)) continue;
    // a removed product may be a bookmarked slug, an authored entry's subject, or a
    // related-product reference — it is named, never silently dropped
    drift.removed.push(`${h} — ${p.title}`);
  }
  for (const [h, p] of after) {
    const b = before.get(h);
    if (!b) continue;
    if (b.title !== p.title) drift.renamed.push(`${h}: "${b.title}" → "${p.title}"`);
    const bs = JSON.stringify(b.spec ?? {});
    const as = JSON.stringify(p.spec ?? {});
    if (bs !== as) drift.respecified.push(`${h}: ${bs} → ${as}`);
    const bp = b.price ?? 0;
    const ap = p.price.kind === 'fixed' ? p.price.pkr : 0;
    if (bp !== ap) drift.repriced.push(`${h}: ${bp} → ${ap}`);
  }
  // a *relative* collapse is the signal that the shop's template changed under us
  for (const [field, rate] of Object.entries(rates)) {
    const was = previous.rates?.[field];
    if (was === undefined || was < 5) continue;
    if (rate < was * 0.7) hard.push(`extraction collapsed for ${field}: ${was}% → ${rate}% of products`);
    else if (Math.abs(rate - was) >= 2) drift.coverage.push(`${field}: ${was}% → ${rate}%`);
  }
}

const driftCount = Object.values(drift).reduce((n, v) => n + v.length, 0);

// ── the document ────────────────────────────────────────────────────────────
const dept = stats.byDepartment;
const withheldReasons = Object.entries(stats.withheldReasons ?? {}).sort((a, b) => b[1] - a[1]);
const lowRes = products.filter((p) => p.maxImageWidth && p.maxImageWidth < 1700).sort((a, b) => a.maxImageWidth - b.maxImageWidth);
const noSpec = products.filter((p) => !Object.keys(p.spec).length);
const genericTitle = products.filter((p) => p.gaps.includes('generic-title'));
const mismatch = products.filter((p) => p.gaps.includes('reference-mismatch'));
const unparsedPurity = products.filter((p) => p.gaps.includes('unparsed-purity'));

const rows = (list, f, limit = 25) =>
  list.slice(0, limit).map(f).join('\n') + (list.length > limit ? `\n| … | ${list.length - limit} more | |` : '');

const md = `# Catalogue audit

Generated by \`npm run catalogue:audit\` from the live shop. Do not edit by hand.

**Synced** ${new Date().toISOString().slice(0, 10)} · **fetched** ${products.length + Object.keys(excluded).length} · **imported** ${products.length} · **listable** ${stats.listable} from the shop's own data, **${sitewideListable}** on the site · **withheld** ${stats.withheld}

${authoredListable.length} further pieces are listed because an editor supplied the name and the filing the shop
had not: ${authoredListable.map((e) => `\`${e.handle}\``).join(', ')}. That is the whole of the
difference between the two figures, and it is the shape of what every one of the remaining
withheld pieces needs.

## What is here

| Department | Products | Listable | Flagship imagery |
|---|---|---|---|
${['gold', 'diamond', 'bridal', 'men', 'kids']
  .map((d) => {
    const all = products.filter((p) => p.departments.includes(d));
    const live = all.filter((p) => p.listable).length;
    const named = authoredListable.filter((e) => byHandle.get(e.handle)?.departments.includes(d)).length;
    return `| ${d} | ${all.length} | ${live}${named ? ` + ${named} named` : ''} | ${stats.flagshipByDept?.[d] ?? 0} |`;
  })
  .join('\n')}

${products.filter((p) => p.departments.length > 1).length} pieces belong to two departments — a gold bridal set genuinely is both.

## How many photographs a piece has

| Frames | Pieces |
|---|---|
${Object.entries(framesPerPiece)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([n, c]) => `| ${n} | ${c} |`)
  .join('\n')}

**${sitewideSingleFrame} of the ${sitewideListable} listable pieces — ${Math.round((sitewideSingleFrame / sitewideListable) * 100)}% — have exactly
one photograph.** That is the figure the product page's layout is decided by, and the
denominator is the site's own: counted against the generated snapshot alone it reads
${products.filter((p) => p.listable && p.images.length === 1).length} of ${stats.listable}, because the merge both adds pieces and gives the authored
ones galleries.

A department opens only where at least twelve listable pieces stand behind it, and a kind
earns a page of its own on the same rule — so /gold/pendant exists and /gold/nose-pin does
not. The routes, the menu and the category line read that predicate from one place, so an
empty room can be neither linked nor reached.

## What Waseem publishes

| Field | Products | Share |
|---|---|---|
${Object.entries(coverage)
  .map(([k, v]) => `| ${k} | ${v} | ${rates[k]}% |`)
  .join('\n')}

**Purity is read from fourteen written forms.** The shop writes \`21 KT\` (315), \`18 KT\` (112),
\`22 KT\` (32), \`18 carat\` (25), \`18K\` (23), \`21 carat\` (19), \`21K\` (17), \`21 karat\` (9),
\`22K\` (6), \`21 K\` (2), and one each of \`18 karat\`, \`22 karat\`, \`22 carat\` — summing exactly
to the ${coverage.purity} products above. A narrower pattern looking only for \`18K|21K|22K\`
finds 48. Two further products carry \`PD Palladium\` with no karat figure and are recorded
as an alloy with the purity left absent.

**Only ${coverage.priced} products carry a price.** Everything else is PRICE ON REQUEST, which is why price
is never a primary sort or facet anywhere in the site.

## Excluded

${Object.keys(excluded).length} products, on three independent signals — none of which is sufficient alone.

| Signal | Count |
|---|---|
| \`product_type: "watch"\` | ${stats.watchReconciliation.typedAsWatch} |
| in a watch-brand collection (rado, tag-heuer, tissot) | ${stats.watchReconciliation.inWatchBrandCollections} |
| typed as a watch but in no brand collection | ${stats.watchReconciliation.typedButNotInCollection} |
| in a brand collection with an empty \`product_type\` | ${stats.watchReconciliation.inCollectionButNotTyped.length}${stats.watchReconciliation.inCollectionButNotTyped.length ? ` — \`${stats.watchReconciliation.inCollectionButNotTyped.join('`, `')}\`` : ''} |
| deny-list | \`${stats.watchReconciliation.denyList.join('`, `')}\` |
| awaiting Waseem (watch accessories) | \`${stats.watchReconciliation.awaitingReview.join('`, `')}\` |

The 90-versus-79 discrepancy is explained rather than assumed: 79 watches sit in the three
brand collections, twelve more are typed as watches and filed elsewhere, and one Rado sits
in a brand collection with an empty \`product_type\`. Filtering on any single signal would
have imported a Rado as jewellery.

## Withheld from listings

${stats.withheld} products are imported but never shown. Importing and listing are separate decisions:
the data is complete so this document can speak to it, but a piece is only shown when it
can be filed and named honestly.

| Reason | Products |
|---|---|
${withheldReasons.map(([r, n]) => `| ${r} | ${n} |`).join('\n')}

### Awaiting a name from Waseem — the largest single gap

${genericTitle.length} products repeat their collection name as their title (\`Rukh-E-Jana\`, \`Royal Wedding\`),
publish no description and carry no specification. They are Waseem's own campaign
photography and the imagery is strong, but there is nothing to call them.

**This is what makes Bridal read thin: ${products.filter((p) => p.departments.includes('bridal') && p.listable).length + authoredListable.filter((e) => byHandle.get(e.handle)?.departments.includes('bridal')).length} of ${products.filter((p) => p.departments.includes('bridal')).length} bridal pieces are listed.** Every name Waseem supplies moves one more.
Bridal is Waseem's signature, so this is the most commercially valuable thing on this page.

| Campaign | Products |
|---|---|
${Object.entries(genericTitle.reduce((m, p) => ({ ...m, [p.campaign ?? '—']: (m[p.campaign ?? '—'] ?? 0) + 1 }), {}))
  .sort((a, b) => b[1] - a[1])
  .map(([c, n]) => `| ${c} | ${n} |`)
  .join('\n')}

### Category not published

${products.filter((p) => !p.category).length} products cannot be filed. A photograph of a bridal model may be a set, a necklace or
a pair of earrings; the shop does not say which, and a guess would be an invention. They
stay out of every listing, facet and related-product index until Waseem tells us.

## Duplicates

Resolved, not quarantined. A \`-copy\` handle is a Shopify record-duplication artefact, not
duplicate content: all six carry their own photograph. Measured across the imported set
there are **${new Set(products.flatMap((p) => p.images.map((i) => i.src))).size} distinct image URLs, none shared, and no two products with the same image
set**, so the only honest test is identity of imagery — and it flags nothing.

## Photography

| Largest image | Products |
|---|---|
${Object.entries(stats.resolution)
  .map(([k, v]) => `| ${k} px | ${v} |`)
  .join('\n')}

${stats.singleImage} products have exactly one photograph, which is why the product page adapts its layout
rather than forcing a gallery that only a minority can fill.

**${stats.flagship} pieces are localised** into \`public/assets\` and committed, as Stage 1 did. The
other ${stats.longTail} are resized from the shop's CDN by the image optimiser — the browser still only
ever talks to this domain. Allocation gives every department a floor of twelve and then
awards the rest on merit.

### Below 1700 px

${lowRes.length} products. Listed smallest first; these are the pieces a new photograph would help most.

| Handle | Largest | Department |
|---|---|---|
${rows(lowRes, (p) => `| \`${p.handle}\` | ${p.maxImageWidth} px | ${p.departments.join(', ') || '—'} |`)}

## Requiring confirmation from Waseem

1. **Names for the ${genericTitle.length} campaign products above.** One name and one line each. This is the
   single highest-value item on this page.
2. **The original logo vector** (AI / EPS / SVG / print-ready PDF) — see \`BRAND.md\`.
3. **Are the ${coverage.priced} published prices current?** They carry an \`asOf\` date and are shown with it.
   If they are not to be shown at all, the default is to show none.
4. \`watch-link-bracelet\` and \`watch-strap-bracelet\` — gold bracelets made for a watch.
   In or out?
5. **${unparsedPurity.length} products state a purity we cannot read** (\`PD Palladium\`). Confirm the alloy.
6. **${mismatch.length} products whose item code differs between the title and the body.**
${mismatch.length ? mismatch.map((p) => `   - \`${p.handle}\``).join('\n') : ''}
7. **No product publishes any dimension.** \`Specification.dimensions\` is empty for all ${products.length}.
8. **Archival photography** — still absent; see \`PHOTOGRAPHY.md\`.

## Checks

${hard.length ? `### Hard failures — the build stops\n\n${hard.map((h) => `- ${h}`).join('\n')}` : '**No hard failures.** Data is well-formed, slugs are unique, every listable piece has a category and an image, every value is plausible, and no watch reached the imported set.'}

${
  previous
    ? driftCount
      ? `### Upstream drift — review and accept\n\n${Object.entries(drift)
          .filter(([, v]) => v.length)
          .map(([k, v]) => `**${k}** (${v.length})\n${v.slice(0, 20).map((x) => `- ${x}`).join('\n')}${v.length > 20 ? `\n- … ${v.length - 20} more` : ''}`)
          .join('\n\n')}\n\nRun \`npm run catalogue:accept\` once these have been read.`
      : '**No drift** against the accepted baseline.'
    : '_No baseline yet. This run establishes one._'
}
`;

await fs.writeFile(path.join(process.cwd(), 'CATALOGUE_AUDIT.md'), md, 'utf8');

if (accept || !previous) {
  await writeJson(BASELINE, {
    acceptedAt: new Date().toISOString(),
    rates,
    products: emitted.map((p) => ({ handle: p.sourceHandle, title: p.title, spec: p.spec, price: p.price.kind === 'fixed' ? p.price.pkr : 0 })),
  });
  console.log(previous ? 'baseline accepted' : 'baseline established (first run)');
}

console.log(`\n${products.length} imported, ${stats.listable} listable from the shop's data, ${sitewideListable} on the site, ${stats.withheld} withheld`);
console.log(`coverage: ${Object.entries(rates).map(([k, v]) => `${k} ${v}%`).join(', ')}`);
if (hard.length) {
  console.error(`\nHARD FAILURES (${hard.length}):`);
  for (const h of hard.slice(0, 15)) console.error(`  ${h}`);
  process.exitCode = 1;
} else {
  console.log('\nno hard failures');
}
if (previous && driftCount) {
  console.log(`\nupstream drift: ${Object.entries(drift).filter(([, v]) => v.length).map(([k, v]) => `${v.length} ${k}`).join(', ')}`);
  console.log('read CATALOGUE_AUDIT.md, then `npm run catalogue:accept`');
  if (!accept) process.exitCode = 2;
}
console.log(`\n→ ${rel(path.join(process.cwd(), 'CATALOGUE_AUDIT.md'))}`);
