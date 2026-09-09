/**
 * Shared plumbing for the catalogue pipeline.
 *
 * Six stages, each independently re-runnable with its own cached output:
 *   fetch → parse → classify → media → emit → audit
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = path.join(ROOT, '.cache/catalogue');
export const GENERATED = path.join(ROOT, 'src/data/generated');

export const SHOP = 'https://waseemjewellers.com';
export const PRODUCT_URL = (handle) => `${SHOP}/products/${handle}`;

/** Watch brands are third-party maisons; Waseem sells them in the showroom, not here. */
export const WATCH_COLLECTIONS = new Set(['rado', 'tag-heuer', 'tissot']);

/**
 * Handles excluded by name rather than by rule.
 *
 * `rado-centrix-diamonds-3` is a Rado watch with an empty `product_type`, so the
 * product_type filter alone would import it as jewellery. `aks-e-noor` carries a
 * PKR 2,000 placeholder price that is not a real price.
 */
export const DENY_HANDLES = new Set(['rado-centrix-diamonds-3', 'aks-e-noor']);

/** Gold bracelets made for a watch. Flagged for Waseem; excluded until they answer. */
export const REVIEW_HANDLES = new Set(['watch-link-bracelet', 'watch-strap-bracelet']);

export const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

export const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/**
 * Node's fetch with backoff. The shop is occasionally slow rather than flaky, and DNS
 * here has returned EAI_AGAIN under load, so transient resolution failures are retried
 * patiently instead of failing the run.
 */
export async function getJson(url, { retries = 5 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'waseem-flagship-catalogue/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      const cause = err?.cause?.code ?? '';
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 800 * 2 ** i));
      if (i === retries - 1) throw new Error(`GET ${url} failed after ${retries}: ${err.message}${cause ? ` (${cause})` : ''}`);
    }
  }
  throw new Error(`GET ${url} failed: ${lastErr?.message}`);
}

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/**
 * The shop writes titles as "MEN BRACELET-BR02334". The code is stripped for display —
 * title-casing it produces "Br02334", which is worse than useless, and the reference is
 * shown properly in the specification table where a visitor can read it.
 */
export function displayTitle(raw) {
  return titleCase(String(raw).replace(/[-–—]?\s*[A-Z]{1,3}[.\s-]?\s?\d{3,6}\s*$/i, '').trim() || raw);
}

/** Title case for the shop's ALL-CAPS titles, leaving item codes alone. */
export function titleCase(s) {
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (/^[A-Z]{1,3}\d{3,6}$/.test(w) || /^\d/.test(w)) return w; // item codes and numbers
      const lower = w.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.replace(/(^|[-–/])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}
