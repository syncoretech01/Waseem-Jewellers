/**
 * One-time migration: lift the ten hand-authored products into the editorial layer.
 *
 * Every authored word moves across verbatim — names, ledes, craft and care copy, style
 * tags, the stones and techniques read off the photographs, the image ids and the
 * complementary graph. Nothing is retyped, so nothing can drift.
 *
 * The hard specifications are deliberately NOT lifted: the ingestion re-derives them from
 * what Waseem publishes, and a diff test asserts the three specced pieces come out
 * identical. That diff is the migration's proof of correctness.
 *
 *   node scripts/catalogue/lift-editorial.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE, writeJson, rel } from './lib.mjs';

const SRC = path.join(process.cwd(), 'src/data/products.ts');
const src = await fs.readFile(SRC, 'utf8');

const one = (block, re) => {
  const m = block.match(re);
  return m ? m[1] : undefined;
};

/** Pulls a string-array literal, honouring escaped apostrophes. */
const list = (block, re) => {
  const m = block.match(re);
  if (!m) return undefined;
  const out = [];
  const item = /'((?:[^'\\]|\\.)*)'/g;
  let hit;
  while ((hit = item.exec(m[1])) !== null) out.push(hit[1].replace(/\\'/g, "'"));
  return out;
};

const blocks = src.split(/\n {2}\{\n/).slice(1);
const lifted = [];

for (const b of blocks) {
  const handle = one(b, /source: \{ handle: '([^']+)'/);
  if (!handle) continue;

  const storyBlock = b.match(/story: \{([\s\S]*?)\n {4}\},/);
  const story = {};
  if (storyBlock) {
    for (const key of ['lede', 'craft', 'care']) {
      const m = storyBlock[1].match(new RegExp(`${key}: '((?:[^'\\\\]|\\\\.)*)'`));
      if (m) story[key] = m[1].replace(/\\'/g, "'");
    }
  }

  lifted.push({
    handle,
    slug: one(b, /slug: '([^']+)'/),
    editorialTitle: one(b, /editorialTitle: '([^']+)'/),
    campaign: one(b, /house: '([^']+)'/),
    world: one(b, /world: '([^']+)'/),
    category: one(b, /category: '([^']+)'/),
    material: one(b, /material: '([^']+)'/),
    tags: list(b, /tags: \[([^\]]*)\]/),
    styleTags: list(b, /styleTags: \[([^\]]*)\]/),
    stones: list(b, /stones: \[([^\]]*)\]/),
    technique: list(b, /technique: \[([^\]]*)\]/),
    hero: one(b, /hero: '([^']+)'/),
    gallery: list(b, /gallery: \[([^\]]*)\]/),
    macro: one(b, /macro: '([^']+)'/),
    campaignImage: one(b, /campaign: '([^']+)'/),
    complementary: list(b, /complementary: \[([^\]]*)\]/),
    featuredRank: Number(one(b, /featuredRank: (\d+)/)),
    story: Object.keys(story).length ? story : undefined,
    // recorded so the diff test can assert the ingestion reproduces them
    liftedSpec: {
      karat: one(b, /karat: '([^']+)'/),
      grossWeightGrams: one(b, /grossWeightGrams: ([\d.]+)/),
      diamondColour: one(b, /diamondColour: '([^']+)'/),
      clarity: one(b, /clarity: '([^']+)'/),
      carat: one(b, /carat: ([\d.]+)/),
      itemCode: one(b, /itemCode: '([^']+)'/),
    },
    pricePkr: Number(one(b, /pkr: (\d+)/)) || undefined,
  });
}

if (lifted.length !== 10) throw new Error(`expected 10 authored products, lifted ${lifted.length}`);
for (const p of lifted) {
  if (!p.slug || !p.editorialTitle || !p.hero || !p.gallery?.length) throw new Error(`incomplete lift for ${p.handle}`);
}

await writeJson(path.join(CACHE, 'editorial-lift.json'), { liftedAt: new Date().toISOString(), products: lifted });
console.log(`lifted ${lifted.length} authored products`);
for (const p of lifted) {
  const specced = Object.values(p.liftedSpec).filter(Boolean).length;
  console.log(`  ${p.handle.padEnd(24)} ${p.slug.padEnd(34)} ${p.gallery.length} images, ${specced} spec fields${p.pricePkr ? `, PKR ${p.pricePkr.toLocaleString()}` : ''}`);
}
console.log(`\n→ ${rel(path.join(CACHE, 'editorial-lift.json'))}`);
