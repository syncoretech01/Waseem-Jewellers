/**
 * Stage 1 of the brand pipeline: cut the master into its four bands and upscale each
 * to a black-on-white matte that potrace can read.
 *
 * The mark is gold-on-transparent, so the shape lives entirely in the alpha channel.
 * Tracing the colour would trace the gradient; tracing alpha traces the mark.
 *
 *   node scripts/brand/extract.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MASTER, MASTER_SIZE, BANDS, SCALE, CACHE, box } from './lib.mjs';

const OUT = path.join(CACHE, 'bands');

/** Row/column occupancy of the alpha channel — prints the band table so drift is visible. */
async function measure() {
  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  if (W !== MASTER_SIZE.width || H !== MASTER_SIZE.height) {
    throw new Error(`master is ${W}x${H}, expected ${MASTER_SIZE.width}x${MASTER_SIZE.height}`);
  }
  const alpha = (x, y) => data[(y * W + x) * C + 3];
  const found = [];
  let start = -1;
  for (let y = 0; y <= H; y++) {
    let on = false;
    if (y < H) for (let x = 0; x < W; x++) if (alpha(x, y) > 24) { on = true; break; }
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      let x0 = W;
      let x1 = 0;
      for (let yy = start; yy < y; yy++) for (let x = 0; x < W; x++) if (alpha(x, yy) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      found.push({ x0, y0: start, x1, y1: y - 1 });
      start = -1;
    }
  }
  return found;
}

const found = await measure();
if (found.length !== BANDS.length) throw new Error(`master has ${found.length} bands, expected ${BANDS.length}`);
found.forEach((f, i) => {
  const b = BANDS[i];
  const same = f.x0 === b.x0 && f.y0 === b.y0 && f.x1 === b.x1 && f.y1 === b.y1;
  console.log(
    `${b.id.padEnd(9)} x ${f.x0}-${f.x1} y ${f.y0}-${f.y1}  (${f.x1 - f.x0 + 1}x${f.y1 - f.y0 + 1})  ${same ? 'matches lib.mjs' : 'DRIFT — update lib.mjs'}`,
  );
  if (!same) process.exitCode = 1;
});

await fs.mkdir(OUT, { recursive: true });
for (const band of BANDS) {
  const b = box(band);
  const file = path.join(OUT, `${band.id}.png`);
  await sharp(MASTER)
    .ensureAlpha()
    .extract(b)
    // the shape is the alpha channel; extract it, invert so ink is black on white
    .extractChannel('alpha')
    .negate()
    .resize({ width: b.width * SCALE, height: b.height * SCALE, kernel: 'lanczos3' })
    .sharpen({ sigma: 1 })
    .png()
    .toFile(file);
  console.log(`  → ${path.relative(process.cwd(), file)}  ${b.width * SCALE}x${b.height * SCALE}`);
}

// a colour reference of each band, for the human authoring stage
for (const band of BANDS) {
  const b = box(band);
  await sharp(MASTER)
    .extract(b)
    .resize({ width: b.width * SCALE, height: b.height * SCALE, kernel: 'lanczos3' })
    .flatten({ background: '#0b0a09' })
    .png()
    .toFile(path.join(OUT, `${band.id}-colour.png`));
}
console.log('\nbands written to', path.relative(process.cwd(), OUT));
