/**
 * Shared constants for the brand pipeline.
 *
 * The mark's four bands, measured from the alpha channel of the 999x291 master
 * (scripts/brand/extract.mjs prints the same numbers on every run, so drift is visible).
 * Every band's bounding box is centred on x = 499.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = path.join(ROOT, '.cache/brand');

/** The canonical master, committed so the pipeline is reproducible from a fresh clone. */
export const MASTER = path.join(ROOT, 'scripts/brand/master/waseem-logo.png');
export const MASTER_URL = 'https://www.waseemjewellers.com/cdn/shop/files/waseem-logo.png';
export const MASTER_SIZE = { width: 999, height: 291 };

/** x0, y0, x1, y1 inclusive, in master pixels. */
export const BANDS = [
  { id: 'crest', x0: 463, y0: 10, x1: 535, y1: 83 },
  { id: 'monogram', x0: 406, y0: 94, x1: 592, y1: 173 },
  { id: 'word-1', x0: 359, y0: 188, x1: 640, y1: 227 },
  { id: 'word-2', x0: 306, y0: 242, x1: 692, y1: 281 },
];

export const AXIS_X = 499; // the mark's vertical mirror axis

/** Upscale factor for tracing. 8x turns a 73px crest into 584px of usable curve. */
export const SCALE = 8;

export const box = (b) => ({ left: b.x0, top: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 });

export function bandById(id) {
  const b = BANDS.find((x) => x.id === id);
  if (!b) throw new Error(`unknown band: ${id}`);
  return b;
}
