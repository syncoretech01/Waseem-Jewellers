#!/usr/bin/env node
/**
 * Warm the image optimiser's edge cache on a deployed build.
 *
 * The long tail of the catalogue is resized from the shop's CDN by /_next/image on first
 * request. A cache miss costs the platform a fetch of the source and a transform — measured
 * at 1.5–2.5 s per image from Lahore-facing regions — and a first visitor sees that as a
 * frame that stays empty. Run this once after every deploy and the first visitor sees the
 * cached result instead.
 *
 *   node scripts/dev/warm-images.mjs https://waseem-jewellers-two.vercel.app
 *   node scripts/dev/warm-images.mjs <base> --all        # every gallery frame, not just heroes
 *
 * It requests the widths the site actually asks for (the srcset candidates a 4:5 card or a
 * hero figure resolves to) at the two qualities the config allows. Local assets are warmed
 * too — they are cheap, and a cold function still has to encode them once.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = (process.argv[2] || '').replace(/\/$/, '');
const all = process.argv.includes('--all');
if (!/^https?:\/\//.test(base)) {
  console.error('usage: node scripts/dev/warm-images.mjs <https://deployed-base> [--all]');
  process.exit(2);
}

const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/generated/catalogue.json'), 'utf8'));
const products = catalogue.products ?? catalogue;

// the same rewrite resolveImage applies, so the cache key matches what the page requests
const SHOPIFY_WIDTH = 2048;
const sized = (src) => {
  try {
    const u = new URL(src);
    if (u.hostname === 'cdn.shopify.com' && !u.searchParams.has('width')) u.searchParams.set('width', String(SHOPIFY_WIDTH));
    return u.toString();
  } catch {
    return src;
  }
};

// widths a card (30vw / 46vw), a tray tile, a hero plate and a full-bleed figure resolve to
const WIDTHS = [256, 384, 512, 640, 828, 1080];
const QUALITY = 82;

const targets = new Set();
for (const p of products) {
  const refs = [p.media?.hero?.ref, ...(all ? (p.media?.gallery ?? []).map((g) => g.ref) : [])].filter(Boolean);
  for (const ref of refs) {
    if (ref.kind !== 'remote') continue;
    for (const w of WIDTHS) targets.add(`${base}/_next/image?url=${encodeURIComponent(sized(ref.src))}&w=${w}&q=${QUALITY}`);
  }
}

// localised assets: warm the widths the chapters request
try {
  const assetMap = fs.readFileSync(path.join(ROOT, 'src/data/generated/asset-map.ts'), 'utf8');
  for (const m of assetMap.matchAll(/"src":\s*"(\/assets\/waseem\/[^"]+\.(?:webp|jpg|png))"/g)) {
    for (const w of [640, 1080, 1600]) targets.add(`${base}/_next/image?url=${encodeURIComponent(m[1])}&w=${w}&q=${QUALITY}`);
  }
} catch {
  /* the asset map is optional here */
}

const list = [...targets];
console.log(`warming ${list.length} image variants on ${base}`);
const CONCURRENCY = 8;
let done = 0;
let failed = 0;
let slow = 0;
const started = Date.now();
async function worker() {
  while (list.length) {
    const url = list.shift();
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'GET', headers: { accept: 'image/webp,image/*' } });
      // drain so the connection is reused
      await r.arrayBuffer();
      const ms = Date.now() - t0;
      if (!r.ok) failed++;
      else if (ms > 2500) slow++;
    } catch {
      failed++;
    }
    done++;
    if (done % 100 === 0) console.log(`  ${done} done, ${failed} failed, ${slow} slow (>2.5 s)`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${done} requests, ${failed} failed, ${slow} slow, ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(failed > done * 0.02 ? 1 : 0);
