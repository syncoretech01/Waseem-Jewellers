/**
 * Stage 2: read the specifications out of `body_html`.
 *
 * The shop publishes them as prose with **no separator between any two fields**:
 *
 *   Product Details: Gold Purity: 21 KT Gross Weight: 5.830 Gms Diamond Color: G&H
 *   Diamond Clarity: VVS Diamond Carat: 0.75ct (Note: ...)
 *
 * So per-field regexes are structurally wrong — `/Gross Weight:\s*(.+)/` swallows every
 * later field. Instead every known label is located, the matches are sorted by offset, and
 * each value is the text between one label and the next. That is O(n) and immune to the
 * missing separator by construction rather than by patch.
 *
 *   node scripts/catalogue/parse.mjs
 */
import path from 'node:path';
import { CACHE, readJson, writeJson, rel, titleCase } from './lib.mjs';

const RAW = path.join(CACHE, 'raw');

/** Every label the shop actually uses, including its typo. */
const LABELS = [
  ['reference', /\b(?:Item\s*Code|Jewellery\s*Code|Jewelry\s*Code)\s*:/gi],
  ['grossWeight', /\bGross\s*Weight\s*:/gi],
  ['netWeight', /\bNet\s*Weight\s*:/gi],
  // 'Gold Pursity' appears once in the catalogue
  ['purity', /\bGold\s*Pu(?:ri|rsi)ty\s*:/gi],
  ['purityAlt', /\b(?<!Gold\s)Purity\s*:/gi],
  ['diamondColour', /\bDiamond\s*Colou?r\s*:/gi],
  ['diamondClarity', /\bDiamond\s*Clarity\s*:/gi],
  ['diamondCarat', /\bDiamond\s*Carat\s*:/gi],
  ['metalColour', /\bMetal\s*Colou?r\s*:/gi],
  ['metal', /\bMetal\s*:/gi],
  ['stone', /\bStone\s*:/gi],
  ['size', /\bSize\s*:/gi],
];

/** Where the value section starts, and the boilerplate that ends it. */
const DETAILS_START = /Product\s*Details\s*:/i;
const TRAILING_NOTE = /\(\s*Note\s*:/i;

export function toText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h\d|li)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Label-anchored segmentation: the only correct way to read a run with no separators. */
export function segment(text) {
  const hits = [];
  for (const [field, re] of LABELS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) hits.push({ field, start: m.index, end: m.index + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start);
  const out = {};
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const stop = hits[i + 1]?.start ?? text.length;
    let value = text.slice(h.end, stop).trim();
    const note = value.search(TRAILING_NOTE);
    if (note >= 0) value = value.slice(0, note).trim();
    const field = h.field === 'purityAlt' ? 'purity' : h.field;
    if (value && out[field] === undefined) out[field] = value;
  }
  return out;
}

const num = (s) => {
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};

/**
 * Each normaliser returns a value or records why it could not.
 *
 * `details` is the whole run, because two facts are stated without a label at all: the
 * alloy and the metal colour appear as a bare token straight after "Product Details:"
 * ("Product Details: Palladium Gross Weight: 6.132 Gms ..."), so reading them out of the
 * purity value would miss every one of them.
 */
function normalise(raw, gaps, details = '') {
  const spec = {};

  if (raw.grossWeight !== undefined) {
    const m = raw.grossWeight.match(/^([\d.]+)\s*(?:Gms?|Grams?|g)\b/i) ?? raw.grossWeight.match(/^([\d.]+)/);
    const v = m ? Number(m[1]) : undefined;
    if (v === undefined || !Number.isFinite(v)) gaps.push('unparsed-weight');
    else if (v <= 0 || v > 5000) gaps.push('implausible-weight');
    else spec.grossWeightGrams = v;
  }
  if (raw.netWeight !== undefined) {
    const v = num(raw.netWeight);
    if (v !== undefined && v > 0 && v <= 5000) spec.netWeightGrams = v;
  }

  if (raw.purity !== undefined) {
    const m = raw.purity.match(/(\d{2})\s*(?:KT|K|karat|carat)\b/i);
    if (m && ['18', '21', '22', '24'].includes(m[1])) spec.purity = `${m[1]}K`;
    else gaps.push('unparsed-purity');
  }

  const unlabelled = `${raw.purity ?? ''} ${details}`;
  const alloy = [];
  if (/palladium/i.test(unlabelled)) alloy.push('palladium');
  if (/platinum/i.test(unlabelled)) alloy.push('platinum');
  if (alloy.length) spec.alloy = alloy;
  if (/rose\s*gold/i.test(unlabelled)) spec.metalColour = 'rose';
  else if (/white\s*gold/i.test(unlabelled)) spec.metalColour = 'white';
  else if (/yellow\s*gold/i.test(unlabelled)) spec.metalColour = 'yellow';
  else if (/two[- ]?tone/i.test(unlabelled)) spec.metalColour = 'two-tone';

  if (!spec.metalColour && raw.metalColour) {
    const c = raw.metalColour.toLowerCase();
    if (/rose/.test(c)) spec.metalColour = 'rose';
    else if (/white/.test(c)) spec.metalColour = 'white';
    else if (/yellow/.test(c)) spec.metalColour = 'yellow';
    else if (/two/.test(c)) spec.metalColour = 'two-tone';
  }

  // published as written: 'G&H' and 'H' are the shop's own vocabulary and are never
  // normalised into a grading scale nobody stated
  if (raw.diamondColour !== undefined) {
    const v = raw.diamondColour.replace(/[^A-Za-z&/ -]/g, '').trim();
    if (v) spec.diamondColour = v;
    else gaps.push('unparsed-colour');
  }
  if (raw.diamondClarity !== undefined) {
    const m = raw.diamondClarity.match(/\b(VVS1|VVS2|VVS|VS1|VS2|VS|SI1|SI2|SI|IF|FL)\b/i);
    if (m) spec.diamondClarity = m[1].toUpperCase();
    else gaps.push('unparsed-clarity');
  }
  if (raw.diamondCarat !== undefined) {
    const v = num(raw.diamondCarat);
    if (v !== undefined && v > 0 && v < 200) spec.diamondCarat = v;
    else gaps.push('unparsed-carat');
  }
  if (raw.size !== undefined) {
    const v = raw.size.trim();
    if (v) spec.size = v;
  }
  return spec;
}

/**
 * A code in the title is a second source; the body wins when both exist.
 *
 * The prefix and the number are separated inconsistently — "R11912", "R 12717",
 * "NS. 04787" are all the same shape — so the separator is stripped before matching
 * rather than enumerated.
 */
const CODE_IN_TITLE = /[-–—]\s*([A-Z]{1,3}[.\s-]?\s?\d{3,6})\s*$/i;
const CODE_SHAPE = /^([A-Z]{1,3})(\d{3,6})$/;

function reference(raw, title, gaps) {
  // up to two tokens: the prefix and the number may be written apart
  const fromBody = raw.reference ? String(raw.reference).trim().split(/\s+/).slice(0, 2).join('') : undefined;
  const t = title.match(CODE_IN_TITLE);
  const fromTitle = t ? t[1] : undefined;
  const clean = (v) => {
    if (!v) return undefined;
    const m = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().match(CODE_SHAPE);
    return m ? `${m[1]}${m[2]}` : undefined;
  };
  const body = clean(fromBody);
  const titleCode = clean(fromTitle);
  if (body && titleCode && body !== titleCode) gaps.push('reference-mismatch');
  return body ?? titleCode;
}

const { products, fetchedAt } = await readJson(path.join(RAW, 'products.json'));

const parsed = products.map((p) => {
  const gaps = [];
  const text = toText(p.body_html);
  const detailsAt = text.search(DETAILS_START);
  // the description above "Product Details:" is boilerplate repeated across dozens of
  // products; it is discarded rather than stored
  const details = detailsAt >= 0 ? text.slice(detailsAt) : text;
  const raw = segment(details);
  const spec = normalise(raw, gaps, details);
  const ref = reference(raw, p.title, gaps);

  const variant = p.variants?.[0] ?? {};
  const priceNum = Number(variant.price ?? 0);
  if (Number(variant.grams ?? 0) > 0) gaps.push('variant-grams-nonzero');

  return {
    handle: p.handle,
    shopifyId: p.id,
    title: titleCase(p.title),
    rawTitle: p.title,
    productType: p.product_type ?? '',
    tags: Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
    price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : 0,
    sku: variant.sku || undefined,
    available: variant.available ?? null,
    reference: ref,
    spec,
    rawSpec: raw,
    hasDetails: detailsAt >= 0,
    images: (p.images ?? []).map((i) => ({ src: i.src.split('?')[0], width: i.width, height: i.height, position: i.position })),
    gaps,
  };
});

const has = (k) => parsed.filter((p) => p.spec[k] !== undefined).length;
const stats = {
  products: parsed.length,
  withDetails: parsed.filter((p) => p.hasDetails).length,
  reference: parsed.filter((p) => p.reference).length,
  grossWeight: has('grossWeightGrams'),
  purity: has('purity'),
  diamondColour: has('diamondColour'),
  diamondClarity: has('diamondClarity'),
  diamondCarat: has('diamondCarat'),
  metalColour: has('metalColour'),
  alloy: parsed.filter((p) => p.spec.alloy).length,
  priced: parsed.filter((p) => p.price > 0).length,
  images: parsed.reduce((n, p) => n + p.images.length, 0),
  gaps: parsed.flatMap((p) => p.gaps).reduce((m, g) => ({ ...m, [g]: (m[g] ?? 0) + 1 }), {}),
};

await writeJson(path.join(CACHE, 'parsed.json'), { fetchedAt, parsedAt: new Date().toISOString(), stats, products: parsed });

console.log('coverage across all', stats.products, 'products (watches included; they are excluded at classify)');
for (const [k, v] of Object.entries(stats)) {
  if (k === 'gaps' || k === 'products') continue;
  console.log(`  ${k.padEnd(16)} ${v}`);
}
console.log('  gaps            ', JSON.stringify(stats.gaps));
console.log(`\n→ ${rel(path.join(CACHE, 'parsed.json'))}`);
