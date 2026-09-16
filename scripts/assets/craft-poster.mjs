// Renders the craft chapter's ring once, from the same scene the page draws, into a still for
// the visitors who cannot run it: no WebGL, or a request for reduced motion. Run against a dev
// server (the ?tier=HIGH override is honoured there) — the scene is rendered through
// SwiftShader, which is slow and exact.
//   node scripts/assets/craft-poster.mjs http://localhost:3300
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const OUT = path.resolve('public/assets/waseem/images/craft');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/?tier=HIGH`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__wjConcierge, null, { timeout: 60000 });
await page.waitForTimeout(5000);
const top = await page.evaluate(() => document.querySelector('#ch02-craft')?.getBoundingClientRect().top + window.scrollY);
await page.evaluate((y) => window.scrollTo(0, y + 2), top);
await page.waitForSelector('[data-craft-scene][data-webgl="1"] canvas', { timeout: 60000 });
// only the object: the labels, the halo, the orb and the dev badge step out of the frame
await page.addStyleTag({ content: '.craft-label, .craft-note, .craft-eyebrow, .craft-halo, .craft-closing, [data-orb], nextjs-portal, .wj-orb, [data-concierge-orb] { visibility: hidden !important; opacity: 0 !important; } #ch02-craft .craft-stage-wrap > *:not(.craft-scene) { visibility: hidden !important; }' });
// the object settles over a second or so of demand frames
await page.waitForTimeout(4000);
const canvas = await page.$('[data-craft-scene] canvas');
const png = await canvas.screenshot({ type: 'png', omitBackground: true });
const meta = await sharp(png).metadata();
console.log('canvas', meta.width, meta.height);
// trim to the object with a margin, then a square poster on transparent ground
const trimmed = await sharp(png).trim({ threshold: 8 }).toBuffer();
const t = await sharp(trimmed).metadata();
const side = Math.round(Math.max(t.width, t.height) * 1.18);
const poster = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: trimmed, left: Math.round((side - t.width) / 2), top: Math.round((side - t.height) / 2) }])
  .png()
  .toBuffer();
for (const w of [640, 1080, 1600]) {
  await sharp(poster).resize(Math.min(w, side)).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT, `ring-${w}w.webp`));
}
await sharp(poster).resize(Math.min(1600, side)).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT, 'ring.webp'));
console.log('poster', side, 'px →', OUT);
await browser.close();
