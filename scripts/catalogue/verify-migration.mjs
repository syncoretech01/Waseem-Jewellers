/**
 * The migration's proof of correctness.
 *
 * The ten Stage 1 products were hand-authored, three of them with specifications
 * transcribed by a person from what Waseem publishes. Those specifications were NOT
 * carried into the editorial layer — the ingestion re-derives them. So if the parser is
 * right, it reproduces the hand transcription exactly; if it is wrong, this says so.
 *
 * Also checks that every authored entry still has a subject in the shop, because a product
 * deleted upstream should be reported by name rather than silently dropped.
 *
 *   node scripts/catalogue/verify-migration.mjs
 */
import path from 'node:path';
import { CACHE, GENERATED, readJson } from './lib.mjs';

/** As transcribed by hand in Stage 1, from the shop's own product pages. */
const EXPECTED = {
  'diamond-bridal-set-1': { purity: '21K', grossWeightGrams: 94.68, diamondColour: 'H', diamondClarity: 'VVS1', diamondCarat: 13.26 },
  'gold-earings-t06768': { purity: '21K', grossWeightGrams: 16.452, reference: 'T06768', pricePkr: 640000 },
  'gold-ring-r11912': { purity: '21K', grossWeightGrams: 9.444, reference: 'R11912', pricePkr: 380000 },
};

const { products } = await readJson(path.join(GENERATED, 'catalogue.json'));
const { products: lifted } = await readJson(path.join(CACHE, 'editorial-lift.json'));
const byHandle = new Map(products.map((p) => [p.sourceHandle, p]));

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  FAIL ${msg}`);
};

console.log('specifications re-derived by the parser, against the Stage 1 hand transcription:');
for (const [handle, want] of Object.entries(EXPECTED)) {
  const p = byHandle.get(handle);
  if (!p) {
    fail(`${handle}: not in the imported catalogue`);
    continue;
  }
  const got = { ...p.spec, reference: p.reference, pricePkr: p.price.kind === 'fixed' ? p.price.pkr : undefined };
  const parts = [];
  for (const [k, v] of Object.entries(want)) {
    const actual = got[k];
    const same = typeof v === 'number' ? Math.abs(Number(actual) - v) < 1e-9 : actual === v;
    parts.push(`${k}=${actual ?? '—'}${same ? '' : ` (expected ${v})`}`);
    if (!same) fail(`${handle}.${k}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(v)}`);
  }
  console.log(`  ${handle.padEnd(22)} ${parts.join('  ')}`);
}

console.log('\nauthored entries still resolving to a live product:');
const orphaned = lifted.filter((e) => !byHandle.has(e.handle));
if (orphaned.length) {
  for (const e of orphaned) fail(`${e.handle} ("${e.editorialTitle}") has no subject in the shop any more`);
} else {
  console.log(`  all ${lifted.length} resolve`);
}

console.log('\nauthored pieces are listable:');
for (const e of lifted) {
  const p = byHandle.get(e.handle);
  if (!p) continue;
  // the editorial layer supplies the name and category the generated view lacked
  const willList = Boolean(e.editorialTitle && (e.category ?? p.category));
  if (!willList) fail(`${e.handle}: still withheld after the editorial merge`);
}
if (!failures) console.log(`  all ${lifted.length} become listable through the editorial layer`);

console.log(failures ? `\n${failures} failure(s)` : '\nMigration verified: nothing authored was lost, and the parser reproduces every hand-transcribed figure.');
process.exit(failures ? 1 : 0);
