/**
 * Stage 2 of the brand pipeline: trace each upscaled band to Bezier outlines.
 *
 * The output is an UNDERLAY for the authoring stage, never the shipped deliverable.
 * potrace (not imagetracerjs) because it emits optimised cubic Beziers rather than
 * dense polylines, which is the difference between ~200 and ~1500 nodes.
 *
 *   node scripts/brand/trace.mjs [bandId]
 */
import { Potrace } from 'potrace';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BANDS, SCALE, CACHE, box, bandById } from './lib.mjs';

const IN = path.join(CACHE, 'bands');
const OUT = path.join(CACHE, 'traced');

const PARAMS = {
  turdSize: 2, // drop specks below 2px at 8x — i.e. sub-quarter-pixel in the master
  alphaMax: 1.0, // corner threshold; 1.0 keeps genuine corners, smooths the rest
  optCurve: true,
  optTolerance: 0.2,
  threshold: 128,
  turnPolicy: Potrace.TURNPOLICY_MINORITY,
  blackOnWhite: true,
};

const countNodes = (d) => (d.match(/[MLCQAZmlcqaz]/g) ?? []).length;

const only = process.argv[2];
const bands = only ? [bandById(only)] : BANDS;
await fs.mkdir(OUT, { recursive: true });

for (const band of bands) {
  const svg = await new Promise((resolve, reject) => {
    const p = new Potrace(PARAMS);
    p.loadImage(path.join(IN, `${band.id}.png`), (err) => (err ? reject(err) : resolve(p.getSVG())));
  });
  const b = box(band);
  // potrace works in upscaled pixels; record the divisor so the authoring stage can
  // express geometry in master pixels instead
  const header = `<!-- traced from ${band.id}.png at ${SCALE}x; divide coordinates by ${SCALE} for master pixels; band ${b.width}x${b.height} -->\n`;
  const file = path.join(OUT, `${band.id}.svg`);
  await fs.writeFile(file, header + svg, 'utf8');
  const nodes = [...svg.matchAll(/ d="([^"]+)"/g)].reduce((n, m) => n + countNodes(m[1]), 0);
  const paths = (svg.match(/<path/g) ?? []).length;
  console.log(`${band.id.padEnd(9)} ${paths} path(s), ${nodes} nodes, ${(svg.length / 1024).toFixed(1)} kB`);
}
console.log('\ntraced to', path.relative(process.cwd(), OUT));
