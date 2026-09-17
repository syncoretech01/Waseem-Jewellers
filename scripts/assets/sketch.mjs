// The jeweller's drawing of a piece, derived from the piece's own photograph — a pencil-sketch
// pass (greyscale, inverted blur, dodge) over the localised hero, so the drawing is a literal
// trace of the photograph and claims nothing the photograph does not. Written next to the
// hero as sketch-{640,1080,1600}w.webp; the craft coda crossfades from it into the photograph.
//   node scripts/assets/sketch.mjs [slug ...]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('public/assets/waseem/images/products');
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ['lavender-halo-ring-r11912'];

// ink on ivory: the site's own drawing colours
const INK = [42, 36, 32];
const IVORY = [244, 239, 230];

for (const slug of slugs) {
  const src = path.join(ROOT, slug, 'hero.webp');
  if (!fs.existsSync(src)) throw new Error(`no hero for ${slug}`);
  const base = sharp(src).rotate();
  const meta = await base.metadata();
  const side = Math.min(1600, Math.max(meta.width, meta.height));
  const grey = await base.clone().resize(side, side, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = grey.info;
  const blurred = await sharp(grey.data, { raw: { width, height, channels: 1 } }).negate().blur(side / 110).toColourspace('b-w').raw().toBuffer();
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const g = grey.data[i];
    const b = blurred[i];
    // colour dodge: the classic pencil pass — flat tone goes to paper, edges keep their line
    const dodge = b >= 255 ? 255 : Math.min(255, (g * 256) / (256 - b));
    // a curve so the drawing has weight: the last few percent go to paper, the rest firms up the line
    const n = Math.min(1, dodge / 246);
    const t = Math.pow(n, 3.2);
    out[i * 3] = Math.round(INK[0] + (IVORY[0] - INK[0]) * t);
    out[i * 3 + 1] = Math.round(INK[1] + (IVORY[1] - INK[1]) * t);
    out[i * 3 + 2] = Math.round(INK[2] + (IVORY[2] - INK[2]) * t);
  }
  const sketch = sharp(out, { raw: { width, height, channels: 3 } });
  for (const w of [640, 1080, 1600]) {
    if (w > side && w !== 640) continue;
    await sketch.clone().resize(Math.min(w, side)).webp({ quality: 82 }).toFile(path.join(ROOT, slug, `sketch-${w}w.webp`));
  }
  console.log(slug, 'sketch', side);
}
