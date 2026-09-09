/**
 * Finds the fidelity/complexity knee for each band: the potrace settings where node
 * count falls a long way and IoU barely moves.
 *
 * This exists because hand-reconstructing Celtic knotwork from a 73px source risks
 * exactly what the brief forbids — redesigning the identity into something adjacent.
 * A measured trace follows Waseem's actual geometry; the only question is how few
 * nodes it can be expressed in. This answers that with numbers.
 *
 *   node scripts/brand/sweep.mjs [bandId]
 */
import { Potrace } from 'potrace';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MASTER, BANDS, SCALE, CACHE, box, bandById } from './lib.mjs';

const IN = path.join(CACHE, 'bands');
const THRESHOLD = 127;

const nodesOf = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].reduce((n, m) => n + (m[1].match(/[MLCQAZmlcqaz]/g)?.length ?? 0), 0);

async function traceWith(bandId, params) {
  return new Promise((resolve, reject) => {
    const p = new Potrace({ threshold: 128, blackOnWhite: true, turnPolicy: Potrace.TURNPOLICY_MINORITY, ...params });
    p.loadImage(path.join(IN, `${bandId}.png`), (err) => (err ? reject(err) : resolve(p.getSVG())));
  });
}

/** IoU of a traced band against the master's alpha for that band, both at 4x master. */
async function iouOf(band, svg) {
  const b = box(band);
  const w = b.width * 4;
  const h = b.height * 4;
  const master = await sharp(MASTER).ensureAlpha().extract(b).resize({ width: w, height: h, fit: 'fill' }).blur(1).extractChannel('alpha').raw().toBuffer();
  const cand = await sharp(Buffer.from(svg), { density: 384 }).ensureAlpha().resize({ width: w, height: h, fit: 'fill' }).blur(1).extractChannel('alpha').raw().toBuffer();
  let inter = 0;
  let union = 0;
  for (let i = 0; i < master.length; i++) {
    const m = master[i] > THRESHOLD;
    const c = cand[i] > THRESHOLD;
    if (m && c) inter++;
    if (m || c) union++;
  }
  return union === 0 ? 1 : inter / union;
}

const only = process.argv[2];
const bands = only ? [bandById(only)] : BANDS;

for (const band of bands) {
  console.log(`\n== ${band.id} ==`);
  console.log('turdSize  alphaMax  optTol   nodes   IoU');
  const results = [];
  for (const turdSize of [2, 4, 8]) {
    for (const alphaMax of [0.8, 1.0, 1.2]) {
      for (const optTolerance of [0.2, 0.5, 1.0, 2.0]) {
        const svg = await traceWith(band.id, { turdSize, alphaMax, optTolerance });
        const nodes = nodesOf(svg);
        const iou = await iouOf(band, svg);
        results.push({ turdSize, alphaMax, optTolerance, nodes, iou, svg });
        console.log(
          `${String(turdSize).padStart(6)}    ${alphaMax.toFixed(1)}      ${optTolerance.toFixed(1)}   ${String(nodes).padStart(5)}   ${iou.toFixed(4)}`,
        );
      }
    }
  }
  // the knee: fewest nodes among settings within 0.5% IoU of the best
  const best = Math.max(...results.map((r) => r.iou));
  const near = results.filter((r) => r.iou >= best - 0.005);
  const knee = near.reduce((a, b) => (b.nodes < a.nodes ? b : a));
  console.log(
    `best IoU ${best.toFixed(4)}  |  knee: turdSize=${knee.turdSize} alphaMax=${knee.alphaMax} optTolerance=${knee.optTolerance} → ${knee.nodes} nodes, IoU ${knee.iou.toFixed(4)}`,
  );
  await fs.mkdir(path.join(CACHE, 'knee'), { recursive: true });
  await fs.writeFile(path.join(CACHE, 'knee', `${band.id}.svg`), knee.svg, 'utf8');
  await fs.writeFile(
    path.join(CACHE, 'knee', `${band.id}.json`),
    JSON.stringify({ band: band.id, scale: SCALE, ...knee, svg: undefined }, null, 2),
    'utf8',
  );
}
