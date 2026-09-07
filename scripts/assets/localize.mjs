#!/usr/bin/env node
/**
 * Localises every curated image (and video stills) from the manifest:
 * fetch → cache → crop → resize (never enlarge) → webp q82 (+jpg/png when asked)
 * → 16px blur placeholder → src/data/generated/asset-map.ts → ASSET_MANIFEST.md.
 * Failures are recorded, never thrown, so one dead URL does not stop the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGES, STILLS } from './manifest.mjs';
import { ROOT, PUBLIC, CACHE, GENERATED, ensureDir, fetchCached, run, extOf, fmtBytes, rel } from './lib.mjs';

ensureDir(PUBLIC);
ensureDir(GENERATED);
ensureDir(CACHE);

const failures = [];
const images = [];
let bytes = 0;

async function processImage(entry, inputFile) {
  const outBase = path.join(PUBLIC, entry.out);
  ensureDir(path.dirname(outBase));
  let pipeline = sharp(inputFile).rotate();
  const meta = await pipeline.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (entry.derive?.crop) {
    const [x, y, w, h] = entry.derive.crop;
    pipeline = pipeline.extract({
      left: Math.round(x * srcW),
      top: Math.round(y * srcH),
      width: Math.round(w * srcW),
      height: Math.round(h * srcH),
    });
  }
  pipeline = pipeline.resize({ width: entry.maxWidth, withoutEnlargement: true, kernel: 'lanczos3' });
  const formats = entry.formats ?? ['webp'];
  let primary = null;
  for (const f of formats) {
    const file = `${outBase}.${f}`;
    const p = pipeline.clone();
    if (f === 'webp') await p.webp({ quality: 82, effort: 5 }).toFile(file);
    else if (f === 'jpg') await p.jpeg({ quality: 86, mozjpeg: true }).toFile(file);
    else if (f === 'png') await p.png({ compressionLevel: 9 }).toFile(file);
    const size = fs.statSync(file).size;
    bytes += size;
    primary ??= { file, size, format: f };
  }
  const outMeta = await sharp(primary.file).metadata();
  const blur = (await sharp(primary.file).resize(16).webp({ quality: 40 }).toBuffer()).toString('base64');
  const width = outMeta.width ?? 0;
  const height = outMeta.height ?? 0;
  const role = entry.role;
  const maxDisplayWidth = role === 'packshot' || role === 'macro' ? Math.round(width / 2) : width;
  if (entry.derive?.crop && width < 1200 && (role === 'macro' || role === 'campaign')) {
    failures.push({ id: entry.id, source: entry.source ?? entry.video, reason: `derived crop only ${width}px wide (< 1200)` });
  }
  images.push({
    id: entry.id,
    src: `/assets/waseem/${entry.out}.${primary.format}`,
    width,
    height,
    alt: entry.alt,
    blurDataURL: `data:image/webp;base64,${blur}`,
    focal: entry.focal ?? [0.5, 0.5],
    role,
    maxDisplayWidth,
    source: entry.source ?? `${entry.video} @ ${entry.at}s`,
    bytes: primary.size,
    sourceSize: `${srcW}×${srcH}`,
  });
  console.log(`  ${entry.id.padEnd(20)} ${srcW}×${srcH} → ${width}×${height} ${fmtBytes(primary.size)}`);
}

console.log('images');
for (const entry of IMAGES) {
  try {
    const cached = await fetchCached(entry.source, extOf(entry.source));
    await processImage(entry, cached);
  } catch (e) {
    failures.push({ id: entry.id, source: entry.source, reason: e.message });
    console.log(`  ${entry.id.padEnd(20)} FAILED ${e.message}`);
  }
}

console.log('stills');
for (const entry of STILLS) {
  try {
    const video = path.join(ROOT, entry.video);
    if (!fs.existsSync(video)) throw new Error(`missing ${entry.video}`);
    const png = path.join(CACHE, `${entry.id}.png`);
    if (!fs.existsSync(png)) {
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(entry.at), '-i', video, '-frames:v', '1', '-update', '1', png]);
    }
    await processImage(entry, png);
  } catch (e) {
    failures.push({ id: entry.id, source: entry.video, reason: e.message });
    console.log(`  ${entry.id.padEnd(20)} FAILED ${e.message}`);
  }
}

// grain texture (tileable gaussian noise, transparent base) and OG image
{
  const brand = path.join(PUBLIC, 'brand');
  ensureDir(brand);
  await sharp({
    create: { width: 256, height: 256, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 }, noise: { type: 'gaussian', mean: 128, sigma: 28 } },
  })
    .png()
    .toFile(path.join(brand, 'grain-256.png'));
  console.log('brand/grain-256.png');
  const videosFile = path.join(CACHE, 'videos.json');
  if (fs.existsSync(videosFile)) {
    const videos = JSON.parse(fs.readFileSync(videosFile, 'utf8'));
    const hero = videos.find((v) => v.id === 'hero-royal');
    if (hero) {
      ensureDir(path.join(PUBLIC, 'og'));
      const posterJpg = path.join(ROOT, 'public', hero.posterJpg);
      await sharp(posterJpg).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toFile(path.join(PUBLIC, 'og', 'home.jpg'));
      console.log('og/home.jpg');
    }
  }
}

// asset map
const videosFile = path.join(CACHE, 'videos.json');
const videos = fs.existsSync(videosFile) ? JSON.parse(fs.readFileSync(videosFile, 'utf8')) : [];
const imageMap = Object.fromEntries(
  images.map((i) => [
    i.id,
    { id: i.id, src: i.src, width: i.width, height: i.height, alt: i.alt, blurDataURL: i.blurDataURL, focal: i.focal, role: i.role, maxDisplayWidth: i.maxDisplayWidth },
  ]),
);
const videoMap = Object.fromEntries(
  videos.map((v) => [
    v.id,
    {
      id: v.id,
      src1280: v.files['1280'].src,
      src720: v.files['720'].src,
      srcPortrait: v.files.portrait.src,
      poster: v.poster,
      posterBlur: v.posterBlur,
      width: v.files['1280'].width,
      height: v.files['1280'].height,
      duration: Number(v.duration.toFixed(2)),
      subject: v.subject,
      label: v.label,
    },
  ]),
);
const ts = `/* Generated by scripts/assets/localize.mjs — do not edit. */
import type { ImageAsset, VideoAsset } from '../types';

export const IMAGES = ${JSON.stringify(imageMap, null, 2)} as const satisfies Record<string, ImageAsset>;

export const VIDEOS = ${JSON.stringify(videoMap, null, 2)} as const satisfies Record<string, VideoAsset>;

export type ImageId = keyof typeof IMAGES;
export type VideoId = keyof typeof VIDEOS;
`;
fs.writeFileSync(path.join(GENERATED, 'asset-map.ts'), ts);

// manifest doc
const lines = [];
lines.push('# Asset Manifest', '', `Generated by \`npm run assets\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.`, '');
lines.push(`**Images:** ${images.length} files, ${fmtBytes(bytes)}. **Videos:** ${videos.length} clips (${videos.length ? fmtBytes(videos.reduce((n, v) => n + Object.values(v.files).reduce((m, f) => m + f.bytes, 0), 0)) : '0'}).`, '');
lines.push('## Videos', '', '| id | use | duration | 1280 | 720 | portrait | poster |', '|---|---|---|---|---|---|---|');
for (const v of videos) {
  lines.push(`| ${v.id} | ${v.label} | ${v.duration.toFixed(1)}s | ${fmtBytes(v.files['1280'].bytes)} | ${fmtBytes(v.files['720'].bytes)} | ${fmtBytes(v.files.portrait.bytes)} | ${v.poster} |`);
}
lines.push('', 'Originals (untouched): `media-originals/royal-wedding.mp4`, `media-originals/naqsh-e-gul.mp4`, `media-originals/dewaan.mp4`; the studio clip is fetched from the current site.', '');
lines.push('## Images', '', '| id | local | source | role | size | bytes | alt |', '|---|---|---|---|---|---|---|');
for (const i of images) {
  lines.push(`| ${i.id} | ${i.src} | ${i.source} | ${i.role} | ${i.width}×${i.height} (from ${i.sourceSize}) | ${fmtBytes(i.bytes)} | ${i.alt} |`);
}
lines.push('', '## Could not localise', '');
if (failures.length === 0) lines.push('None.');
for (const f of failures) lines.push(`- **${f.id}** — ${f.source} — ${f.reason}`);
lines.push('', '## Media not available online', '', '- Archival photography from the house (founders, early showrooms, workshop). Requested from the client; the heritage chapter is built from the showroom facade, the vitrine and campaign fragments until then.', '');
fs.writeFileSync(path.join(ROOT, 'ASSET_MANIFEST.md'), lines.join('\n'));

console.log(`\n${images.length} images, ${fmtBytes(bytes)}; ${failures.length} failure(s)`);
console.log(`wrote ${rel(path.join(GENERATED, 'asset-map.ts'))} and ASSET_MANIFEST.md`);
if (failures.length) console.log(failures.map((f) => `  - ${f.id}: ${f.reason}`).join('\n'));
