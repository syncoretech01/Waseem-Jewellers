/**
 * Cuts every localised image into the ladder of widths the loader serves, next to its
 * original: `hero.webp` → `hero-640w.webp`, `hero-1080w.webp`, `hero-1600w.webp` — each only
 * when it is narrower than the source. Idempotent; a variant that is newer than its source
 * is left alone.
 *
 *   npm run assets:variants
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd(), 'public/assets/waseem/images');
const WIDTHS = [640, 1080, 1600];
const QUALITY = 78;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && /\.webp$/.test(entry.name) && !/-\d+w\.webp$/.test(entry.name)) yield p;
  }
}

let made = 0;
let kept = 0;
for (const file of walk(ROOT)) {
  const meta = await sharp(file).metadata();
  const sourceWidth = meta.width ?? 0;
  for (const w of WIDTHS) {
    if (w >= sourceWidth) continue;
    const out = file.replace(/\.webp$/, `-${w}w.webp`);
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(file).mtimeMs) {
      kept += 1;
      continue;
    }
    await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 5 }).toFile(out);
    made += 1;
  }
}
console.log(`variants: ${made} written, ${kept} up to date`);
