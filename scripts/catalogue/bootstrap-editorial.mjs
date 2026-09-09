/**
 * One-shot: write src/data/editorial/products.ts from the lift.
 *
 * After this runs the file is human-owned. No script writes to src/data/editorial/* again —
 * that is the whole point of the split, and the reason a re-sync can never destroy a word
 * anyone wrote.
 *
 *   node scripts/catalogue/bootstrap-editorial.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE, readJson, rel } from './lib.mjs';

const OUT = path.join(process.cwd(), 'src/data/editorial/products.ts');
if (await fs.stat(OUT).then(() => true).catch(() => false)) {
  console.error(`${rel(OUT)} already exists — it is human-owned and will not be overwritten.`);
  process.exit(1);
}

const { products } = await readJson(path.join(CACHE, 'editorial-lift.json'));
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const arr = (a) => (a?.length ? `[${a.map(q).join(', ')}]` : undefined);

const entry = (p) => {
  const lines = [];
  const put = (k, v) => v !== undefined && v !== '' && lines.push(`    ${k}: ${v},`);
  put('slug', q(p.slug));
  put('editorialTitle', q(p.editorialTitle));
  put('campaign', p.campaign ? q(p.campaign) : undefined);
  put('world', p.world ? q(p.world) : undefined);
  put('category', p.category ? q(p.category) : undefined);
  put('material', p.material ? q(p.material) : undefined);
  put('tags', arr(p.tags));
  put('styleTags', arr(p.styleTags));
  put('stones', arr(p.stones));
  put('technique', arr(p.technique));
  put('featuredRank', p.featuredRank || undefined);
  if (p.story) {
    lines.push('    story: {');
    for (const k of ['lede', 'craft', 'care']) if (p.story[k]) lines.push(`      ${k}: ${q(p.story[k])},`);
    lines.push('    },');
  }
  lines.push('    media: {');
  lines.push(`      hero: ${q(p.hero)},`);
  lines.push(`      gallery: ${arr(p.gallery)},`);
  if (p.macro) lines.push(`      macro: ${q(p.macro)},`);
  lines.push('    },');
  put('complementary', arr(p.complementary));
  return `  ${q(p.handle)}: {\n${lines.join('\n')}\n  },`;
};

const file = `import type { Category, Material, SetRole, StyleTag, WorldSlug } from '../types';

/**
 * Authored copy, keyed by the shop's own product handle.
 *
 * This file is human-owned. No script writes to it. Everything here is layered on top of
 * the generated catalogue at module load in src/data/products.ts, so a re-sync can add,
 * remove or respecify products without touching a word anyone wrote.
 *
 * Hard specifications are deliberately absent: weight, purity, carat, clarity, colour and
 * the item code are re-derived from what Waseem publishes on every sync. Writing them here
 * would create a second source of truth that could quietly disagree with the first.
 *
 * What belongs here is what only a person can supply — a name worth reading, a lede, the
 * craft and care notes, the stones and techniques read off the photograph, and the
 * complementary graph.
 */
export interface ProductEditorial {
  slug?: string;
  editorialTitle?: string;
  urdu?: string;
  campaign?: string;
  world?: WorldSlug;
  category?: Category;
  subcategory?: string;
  material?: Material;
  tags?: string[];
  styleTags?: StyleTag[];
  /** Read off the photograph, not from a specification sheet. */
  stones?: string[];
  technique?: string[];
  featuredRank?: number;
  setId?: string;
  setRole?: SetRole;
  story?: { lede?: string; craft?: string; care?: string };
  media?: { hero?: string; gallery?: string[]; macro?: string; video?: string };
  complementary?: string[];
}

export const EDITORIAL: Record<string, ProductEditorial> = {
${products.map(entry).join('\n')}
};
`;

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, file, 'utf8');
console.log(`→ ${rel(OUT)}  (${products.length} entries, ${(file.length / 1024).toFixed(1)} kB)`);
console.log('This file is now human-owned; no script will write to it again.');
