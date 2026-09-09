/**
 * Stage 4 of the brand pipeline: the browser and app icons, generated from the
 * authored mark rather than cropped from a third-party raster.
 *
 * Emits Next's file-convention icons:
 *   src/app/icon.svg        the crest, scalable, gold on transparent
 *   src/app/apple-icon.png  180x180, the crest on ink with breathing room
 *
 *   node scripts/brand/icons.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'src/app');

const { CREST } = await import(path.join(ROOT, 'src/components/brand/markGeometry.ts').replace(/\\/g, '/')).catch(async () => {
  // markGeometry.ts is TypeScript; read it and pull the two fields out rather than importing
  const src = await fs.readFile(path.join(ROOT, 'src/components/brand/markGeometry.ts'), 'utf8');
  const block = src.slice(src.indexOf('export const CREST'));
  return { CREST: { viewBox: block.match(/viewBox: '([^']+)'/)[1], fill: block.match(/fill: '([^']+)'/)[1] } };
});

const GOLD = [
  [0, '#d9a94e'], [0.07, '#f5d35b'], [0.15, '#ffe28b'], [0.29, '#fffec8'],
  [0.44, '#e0c079'], [0.73, '#d5b258'], [0.87, '#eed78c'], [1, '#f8e9af'],
];

const stops = GOLD.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
const crestSvg = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CREST.viewBox}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.35">${stops}</linearGradient></defs>
${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}<path d="${CREST.fill}" fill="url(#g)" fill-rule="evenodd"/>
</svg>`;

await fs.writeFile(path.join(APP, 'icon.svg'), crestSvg(null), 'utf8');
console.log('→ src/app/icon.svg');

// apple-icon: the crest on ink, inset so it is not cropped by the platform's rounding
const S = 180;
const inset = Math.round(S * 0.16);
const crest = await sharp(Buffer.from(crestSvg(null)), { density: 900 })
  .resize({ width: S - inset * 2, height: S - inset * 2, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: S, height: S, channels: 4, background: { r: 11, g: 10, b: 9, alpha: 1 } } })
  .composite([{ input: crest, gravity: 'centre' }])
  .png()
  .toFile(path.join(APP, 'apple-icon.png'));
console.log('→ src/app/apple-icon.png  180x180');

// the old icon was a crop of the Shopify raster; it has no place once the mark is authored
const legacy = path.join(APP, 'icon.png');
if (await fs.stat(legacy).then(() => true).catch(() => false)) {
  await fs.unlink(legacy);
  console.log('× removed src/app/icon.png (was a crop of the third-party raster)');
}
