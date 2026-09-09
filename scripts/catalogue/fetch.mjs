/**
 * Stage 1: pull the shop's own JSON.
 *
 * Collection membership is fetched, not inferred from tags — the two disagree (the tag
 * "Gold pendants" covers 47 products, the collection gold-pendants covers 49), and the
 * collection is the shop's own answer.
 *
 *   node scripts/catalogue/fetch.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE, SHOP, getJson, writeJson, rel, WATCH_COLLECTIONS } from './lib.mjs';

const RAW = path.join(CACHE, 'raw');

const products = [];
for (let page = 1; page <= 12; page++) {
  const batch = await getJson(`${SHOP}/products.json?limit=250&page=${page}`);
  const got = batch.products ?? [];
  if (!got.length) break;
  products.push(...got);
  process.stdout.write(`  products page ${page}: ${got.length}\n`);
}

const collectionsRes = await getJson(`${SHOP}/collections.json?limit=250`);
const collections = collectionsRes.collections ?? [];
console.log(`  collections: ${collections.length}`);

// membership per collection, skipping the empty ones and the watch brands
const membership = {};
for (const c of collections) {
  if (!c.products_count) continue;
  // watch brands are fetched too: excluding them correctly means knowing which handles
  // they hold, and the audit has to reconcile that against product_type
  const handles = [];
  for (let page = 1; page <= 6; page++) {
    const res = await getJson(`${SHOP}/collections/${c.handle}/products.json?limit=250&page=${page}`);
    const got = res.products ?? [];
    if (!got.length) break;
    handles.push(...got.map((p) => p.handle));
    if (got.length < 250) break;
  }
  membership[c.handle] = { title: c.title, count: c.products_count, handles, watchBrand: WATCH_COLLECTIONS.has(c.handle) };
  process.stdout.write(`  ${c.handle}: ${handles.length}/${c.products_count}\n`);
}

await fs.mkdir(RAW, { recursive: true });
const fetchedAt = new Date().toISOString();
await writeJson(path.join(RAW, 'products.json'), { fetchedAt, count: products.length, products });
await writeJson(path.join(RAW, 'collections.json'), { fetchedAt, count: collections.length, collections });
await writeJson(path.join(RAW, 'membership.json'), { fetchedAt, membership });

const watches = products.filter((p) => p.product_type === 'watch').length;
console.log(`\n${products.length} products (${watches} typed as watches), ${collections.length} collections`);
console.log(`→ ${rel(RAW)}`);
