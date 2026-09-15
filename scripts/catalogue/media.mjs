/**
 * Stage 4: decide how each product's photography is treated.
 *
 * Two tiers, because 656 products cannot be localised at the quality the current 48 assets
 * use (that would be 150 MB+ in git):
 *
 *   local   a curated flagship set, localised into public/assets and committed, exactly as
 *           Stage 1 did — full galleries, real blur placeholders
 *   remote  the long tail, resized by next/image from cdn.shopify.com. The browser still
 *           only ever talks to our own domain: the origin is /_next/image, and nothing is
 *           hotlinked into the page.
 *
 * Roles matter as much as tiers. `InspectImage.frameOf` already mounts a packshot on a
 * pearl plate with real margin, so getting the role right means the long tail lands on the
 * correct treatment without a single extra line of layout.
 *
 *   node scripts/catalogue/media.mjs
 */
import path from 'node:path';
import { CACHE, readJson, writeJson, rel } from './lib.mjs';

/** How many products get the full localised treatment. */
const FLAGSHIP_BUDGET = 150;
/** Below this a photograph cannot carry a full-bleed frame. */
const FLAGSHIP_MIN_WIDTH = 2200;
/** A single image this large can still lead a page on its own. */
const SINGLE_IMAGE_MIN_WIDTH = 2800;

/** The ten Stage 1 pieces, by the handle their editorial is keyed to. */
const CURATED = new Set([
  'royal-wedding', 'rukhe-jana', 'naqsh-e-gul', 'dewan-2', 'aks-e-noor-5',
  'gold-bridal-set-1', 'diamond-bridal-set-1', 'gold-earings-t06768', 'gold-ring-r11912', 'timeless-treasure',
]);

/**
 * Every image in this catalogue is square — 69 of 69 campaign frames and 587 of 587 others —
 * so dimensions carry no signal about what kind of photograph it is. The shop's own filing
 * does: a piece in a campaign collection was photographed as a scene, a piece in a category
 * collection was shot as a studio cut-out. That is a treatment decision, not a claim about
 * the jewellery.
 */
const widthOf = (p) => Math.max(0, ...p.images.map((i) => i.width ?? 0));

/**
 * One exception, found by looking rather than by rule: the bridal sets filed under category
 * collections were photographed worn — a bride in the whole suite, at 4000 px, one frame.
 * Mounted on a pearl plate with packshot margins those portraits read as a mistake (the
 * face is cropped by the plate, the multiply blend dulls the skin). A single frame of a
 * bridal set at 2800 px or more is a portrait and is filed as a scene. Every other product
 * keeps the shop's own filing.
 */
function roleOf(product) {
  if (product.campaign) return 'campaign';
  if (product.category === 'bridal-set' && product.images.length === 1 && widthOf(product) >= 2800) return 'campaign';
  return 'packshot';
}

const { products, stats: classifyStats, ...rest } = await readJson(path.join(CACHE, 'classified.json'));

// ── measure before deciding ─────────────────────────────────────────────────
const histogram = { '>=4000': 0, '2800-3999': 0, '2200-2799': 0, '1700-2199': 0, '1000-1699': 0, '<1000': 0, none: 0 };
for (const p of products) {
  const w = widthOf(p);
  if (!w) histogram.none++;
  else if (w >= 4000) histogram['>=4000']++;
  else if (w >= 2800) histogram['2800-3999']++;
  else if (w >= 2200) histogram['2200-2799']++;
  else if (w >= 1700) histogram['1700-2199']++;
  else if (w >= 1000) histogram['1000-1699']++;
  else histogram['<1000']++;
}
const imageCounts = products.reduce((m, p) => ({ ...m, [p.images.length]: (m[p.images.length] ?? 0) + 1 }), {});

// ── choose the flagship set, by rank ────────────────────────────────────────
const score = (p) => {
  let s = 0;
  if (CURATED.has(p.handle)) s += 1000;
  const w = widthOf(p);
  if (w >= FLAGSHIP_MIN_WIDTH && p.images.length >= 2) s += 500;
  if (w >= SINGLE_IMAGE_MIN_WIDTH) s += 200;
  s += Math.min(w, 4500) / 100;
  s += p.images.length * 20;
  if (p.reference) s += 15;
  if (p.spec.grossWeightGrams !== undefined) s += 15;
  if (p.price > 0) s += 25;
  if (!p.listable) s -= 400; // a piece nobody can reach does not deserve the budget
  return s;
};

/**
 * Two passes, in this order for a reason.
 *
 * First a floor, smallest department first, so none is served only by long-tail imagery.
 * Then the remaining places go to the best of what is left, wherever it sits — which is
 * what makes the allocation proportional in practice, since a department with 274 pieces
 * simply has more strong candidates than one with 51.
 *
 * A single proportional quota was tried and does not work here: 23 products belong to two
 * departments, so the chosen set grows faster than the quota arithmetic assumes and the
 * last department in the order is starved.
 */
const DEPT_ORDER = ['gold', 'diamond', 'men', 'kids', 'bridal'];
const FLOOR = 12;
const ranked = [...products].sort((a, b) => score(b) - score(a));
const listableIn = (d) => ranked.filter((p) => p.listable && p.departments.includes(d));
const chosen = new Set(ranked.filter((p) => CURATED.has(p.handle)).map((p) => p.handle));

const bySize = [...DEPT_ORDER].sort((a, b) => listableIn(a).length - listableIn(b).length);
for (const dept of bySize) {
  let taken = ranked.filter((p) => chosen.has(p.handle) && p.departments.includes(dept)).length;
  for (const p of listableIn(dept)) {
    if (taken >= FLOOR || chosen.size >= FLAGSHIP_BUDGET) break;
    if (chosen.has(p.handle)) continue;
    chosen.add(p.handle);
    taken++;
  }
}
for (const p of ranked) {
  if (chosen.size >= FLAGSHIP_BUDGET) break;
  if (!p.listable || chosen.has(p.handle)) continue;
  chosen.add(p.handle);
}

// ── apply ───────────────────────────────────────────────────────────────────
const withMedia = products.map((p) => {
  const tier = p.images.length === 0 ? 'none' : chosen.has(p.handle) ? 'local' : 'remote';
  const media = p.images
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((img, i) => ({
      role: roleOf(p),
      order: i,
      width: img.width,
      height: img.height,
      // the long tail keeps its source; the flagship set is localised by the asset pipeline
      remote: img.src,
    }));
  const maxWidth = widthOf(p);
  const gaps = [...p.gaps];
  if (maxWidth && maxWidth < 1000) gaps.push('low-resolution');
  if (p.images.length === 1) gaps.push('single-image');

  return {
    ...p,
    gaps: [...new Set(gaps)],
    media,
    imageTier: tier,
    maxImageWidth: maxWidth,
    // alt text is derived, and marked as such so a reviewer can tell it from an authored one
    altDerived: `${p.title} — ${[p.category, p.material, p.departments[0]].filter(Boolean).join(', ')}, Waseem Jewellers`.replace(/\s+/g, ' '),
  };
});

const tierCount = withMedia.reduce((m, p) => ({ ...m, [p.imageTier]: (m[p.imageTier] ?? 0) + 1 }), {});
const roleCount = withMedia.flatMap((p) => p.media).reduce((m, i) => ({ ...m, [i.role]: (m[i.role] ?? 0) + 1 }), {});
const flagshipByDept = Object.fromEntries(
  DEPT_ORDER.map((d) => [d, withMedia.filter((p) => p.imageTier === 'local' && p.departments.includes(d)).length]),
);

const stats = {
  ...classifyStats,
  resolution: histogram,
  imagesPerProduct: imageCounts,
  flagship: tierCount.local ?? 0,
  longTail: tierCount.remote ?? 0,
  noImage: tierCount.none ?? 0,
  flagshipByDept,
  roles: roleCount,
  singleImage: withMedia.filter((p) => p.images.length === 1).length,
  lowResolution: withMedia.filter((p) => p.gaps.includes('low-resolution')).length,
};

await writeJson(path.join(CACHE, 'media.json'), { ...rest, mediaAt: new Date().toISOString(), stats, products: withMedia });

console.log('largest image per product:', JSON.stringify(histogram));
console.log('images per product      :', JSON.stringify(imageCounts));
console.log(`\nflagship (localised) ${stats.flagship}   long tail (next/image) ${stats.longTail}   no image ${stats.noImage}`);
console.log('flagship by department  :', JSON.stringify(flagshipByDept));
console.log('roles                   :', JSON.stringify(roleCount));
console.log(`single-image products ${stats.singleImage}, under 1000px ${stats.lowResolution}`);
console.log('\nlistable per department (what a visitor can actually reach):');
for (const d of DEPT_ORDER) {
  const total = products.filter((x) => x.departments.includes(d)).length;
  const live = products.filter((x) => x.departments.includes(d) && x.listable).length;
  const flag = live < total * 0.4 ? '   <- most of this department is withheld' : '';
  console.log(`  ${d.padEnd(8)} ${String(live).padStart(3)} of ${String(total).padStart(3)}${flag}`);
}
console.log(`\n→ ${rel(path.join(CACHE, 'media.json'))}`);
