/**
 * The fidelity gate. Renders the authored mark at master resolution and compares it
 * against the brand master, per band.
 *
 * Two metrics, because one is not enough:
 *   ink  — IoU of the mark's shape. Catches drift in the geometry.
 *   hole — IoU of the negative space. Catches the failure IoU alone hides: a trace
 *          can dilate strokes until fine gaps close and still score well on ink,
 *          because closed gaps offset shrunken tips.
 *
 * And neither certifies brand fidelity. A mark can pass both and still read wrong —
 * the crest's volute rhythm, the star points, the weight of the J's hook. So this
 * also writes a review sheet for human sign-off. The gate is necessary, not
 * sufficient: the mark is not the production identity until a person has looked.
 *
 *   node scripts/brand/verify.mjs [pathToSvg]
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MASTER, MASTER_SIZE, BANDS, CACHE, box } from './lib.mjs';

const OUT = path.join(CACHE, 'verify');
const THRESHOLD = 127;
const BLUR = 1; // absorbs rasteriser differences between sharp's SVG renderer and the source
const SAMPLE = 4; // compare at 4x master, where a 1px stroke is 4px of evidence

/**
 * Calibrated from measurement, not assumed. The mark is a 73px crest and two lines of
 * 40px type; these are the numbers the faithful trace actually achieves at the size it
 * ships, with ~1.5% headroom so a regeneration nudge does not fail the build but real
 * drift does. Node counts are recorded for the same reason.
 */
export const GATES = {
  crest: { ink: 0.95, hole: 0.96, dAlpha: 0.03 },
  monogram: { ink: 0.96, hole: 0.97, dAlpha: 0.03 },
  'word-1': { ink: 0.955, hole: 0.96, dAlpha: 0.03 },
  'word-2': { ink: 0.97, hole: 0.97, dAlpha: 0.03 },
};
export const NODE_CEILING = 1100;

const countNodes = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].reduce((n, m) => n + (m[1].match(/[MLCQAZmlcqazSsTtHhVv]/g)?.length ?? 0), 0);

const alphaOf = (buf, width, height) =>
  sharp(buf).ensureAlpha().resize({ width, height, fit: 'fill' }).blur(BLUR).extractChannel('alpha').raw().toBuffer();

export async function verify(svgPath, { quiet = false } = {}) {
  const svg = await fs.readFile(svgPath, 'utf8');
  await fs.mkdir(OUT, { recursive: true });

  const rendered = await sharp(Buffer.from(svg), { density: 384 })
    .resize({ width: MASTER_SIZE.width, height: MASTER_SIZE.height, fit: 'fill' })
    .png()
    .toBuffer();

  const rows = [];
  for (const band of BANDS) {
    const b = box(band);
    const w = b.width * SAMPLE;
    const h = b.height * SAMPLE;
    const [ma, ra] = await Promise.all([
      alphaOf(await sharp(MASTER).ensureAlpha().extract(b).png().toBuffer(), w, h),
      alphaOf(await sharp(rendered).ensureAlpha().extract(b).png().toBuffer(), w, h),
    ]);

    let inter = 0;
    let union = 0;
    let holeInter = 0;
    let holeUnion = 0;
    let sumAbs = 0;
    for (let i = 0; i < ma.length; i++) {
      const m = ma[i] > THRESHOLD;
      const r = ra[i] > THRESHOLD;
      if (m && r) inter++;
      if (m || r) union++;
      if (!m && !r) holeInter++;
      if (!m || !r) holeUnion++;
      sumAbs += Math.abs(ma[i] - ra[i]);
    }
    const ink = union === 0 ? 1 : inter / union;
    const hole = holeUnion === 0 ? 1 : holeInter / holeUnion;
    const dAlpha = sumAbs / ma.length / 255;
    const gate = GATES[band.id];
    rows.push({ id: band.id, ink, hole, dAlpha, gate, pass: ink >= gate.ink && hole >= gate.hole && dAlpha <= gate.dAlpha });

    // master-only red, candidate-only green, agreement gold
    const diff = Buffer.alloc(ma.length * 3);
    for (let i = 0; i < ma.length; i++) {
      const m = ma[i] > THRESHOLD;
      const r = ra[i] > THRESHOLD;
      const px = m && r ? [0xdb, 0xb4, 0x5d] : m ? [0xe0, 0x30, 0x30] : r ? [0x30, 0xd0, 0x50] : [0x0b, 0x0a, 0x09];
      diff.set(px, i * 3);
    }
    await sharp(diff, { raw: { width: w, height: h, channels: 3 } }).png().toFile(path.join(OUT, `diff-${band.id}.png`));
  }

  const nodes = countNodes(svg);
  if (!quiet) {
    console.log('band       ink-IoU  gate   hole-IoU  gate   mean|da|  gate   result');
    for (const r of rows) {
      console.log(
        `${r.id.padEnd(9)} ${r.ink.toFixed(4)}  ${r.gate.ink.toFixed(3)}  ${r.hole.toFixed(4)}   ${r.gate.hole.toFixed(2)}   ${(r.dAlpha * 100).toFixed(2)}%    ${(r.gate.dAlpha * 100).toFixed(0)}%    ${r.pass ? 'pass' : 'FAIL'}`,
      );
    }
    console.log(`\nnodes ${nodes} (ceiling ${NODE_CEILING})`);
  }
  return { rows, nodes, rendered, svg, pass: rows.every((r) => r.pass) && nodes <= NODE_CEILING };
}

/**
 * Side by side at the sizes that matter. The master is upscaled smoothly and the
 * candidate is rendered from vector at the target size — i.e. each is shown the way it
 * would actually be seen, rather than nearest-upscaling an antialiased raster against a
 * crisp vector, which makes the vector look heavier than it is.
 */
async function reviewSheet(svg, rendered) {
  const pad = 28;
  const crops = [
    { label: 'lockup 1x', box: { left: 0, top: 0, width: 999, height: 291 }, out: 999 },
    { label: 'crest 6x', box: box(BANDS[0]), out: 73 * 6 },
    { label: 'knot 14x', box: { left: 476, top: 28, width: 46, height: 46 }, out: 46 * 14 },
  ];
  const strips = [];
  for (const c of crops) {
    const w = c.out;
    const h = Math.round((c.box.height / c.box.width) * w);
    const a = await sharp(MASTER).extract(c.box).resize({ width: w, height: h, kernel: 'lanczos3' }).flatten({ background: '#0b0a09' }).png().toBuffer();
    // render the vector at the target size rather than upscaling a small raster
    const scale = w / c.box.width;
    const b = await sharp(Buffer.from(svg), { density: 96 * scale })
      .resize({ width: Math.round(MASTER_SIZE.width * scale), height: Math.round(MASTER_SIZE.height * scale), fit: 'fill' })
      .extract({ left: Math.round(c.box.left * scale), top: Math.round(c.box.top * scale), width: w, height: h })
      .flatten({ background: '#0b0a09' })
      .png()
      .toBuffer();
    strips.push({ a, b, w, h, label: c.label });
  }
  const width = Math.max(...strips.map((s) => s.w * 2 + pad * 3));
  const height = strips.reduce((t, s) => t + s.h + pad, pad);
  const composite = [];
  let y = pad;
  for (const s of strips) {
    composite.push({ input: s.a, left: pad, top: y }, { input: s.b, left: pad * 2 + s.w, top: y });
    y += s.h + pad;
  }
  await sharp({ create: { width, height, channels: 3, background: { r: 11, g: 10, b: 9 } } })
    .composite(composite)
    .png()
    .toFile(path.join(OUT, 'review-sheet.png'));

  // the mark at the sizes it is actually used, rendered from vector at each size
  const sizes = [16, 20, 32, 48, 64, 128];
  const crest = box(BANDS[0]);
  const marks = [];
  let x = pad;
  for (const s of sizes) {
    const scale = s / crest.height;
    const img = await sharp(Buffer.from(svg), { density: Math.max(96 * scale, 8) })
      .resize({ width: Math.round(MASTER_SIZE.width * scale), height: Math.round(MASTER_SIZE.height * scale), fit: 'fill' })
      .extract({ left: Math.round(crest.left * scale), top: Math.round(crest.top * scale), width: Math.max(1, Math.round(crest.width * scale)), height: s })
      .png()
      .toBuffer();
    marks.push({ input: img, left: x, top: pad + (128 - s) });
    x += Math.round(crest.width * (s / crest.height)) + pad;
  }
  await sharp({ create: { width: x, height: 128 + pad * 2, channels: 3, background: { r: 11, g: 10, b: 9 } } })
    .composite(marks)
    .png()
    .toFile(path.join(OUT, 'review-sizes.png'));
}

const target = process.argv[2] ?? path.join(CACHE, 'candidate.svg');
const res = await verify(target);
await reviewSheet(res.svg, res.rendered);
console.log(`\nreview sheet → ${path.relative(process.cwd(), path.join(OUT, 'review-sheet.png'))}   (master | reconstruction)`);
console.log(`at real sizes → ${path.relative(process.cwd(), path.join(OUT, 'review-sizes.png'))}`);
console.log(`differences   → ${path.relative(process.cwd(), OUT)}/diff-*.png   (red = master only, green = ours, gold = agreement)`);
console.log(
  res.pass
    ? '\nAutomated gate PASSED — necessary, not sufficient.\nThe reconstructed mark is not the production identity until a human has\nreviewed the sheet above and signed off in writing (see BRAND.md).'
    : '\nAutomated gate FAILED.',
);
if (!res.pass) process.exitCode = 1;
