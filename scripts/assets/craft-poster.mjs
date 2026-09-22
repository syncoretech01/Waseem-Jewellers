// Renders the craft chapter's ring once, from the same scene the page draws, into the still that
// stands beneath the live object while it compiles and under reduced motion (the scroll-driven
// frames are craft-frames.mjs's). Run against a dev
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
// only the object: the labels, the halo, the stills, the orb, the dev badge and every other
// section step out of the frame, and every ground beneath the canvas goes transparent — the
// capture carries the object's own alpha, not the page's ink, which on the stage read as a
// faintly lighter square around the ring (the canvas's tone mapping does not return the ink exactly)
await page.addStyleTag({
  content:
    '.craft-label, .craft-note, .craft-eyebrow, .craft-halo, .craft-closing, .craft-poster, .craft-states, [data-orb], nextjs-portal, .wj-orb, [data-concierge-orb], header, footer, section:not(#ch02-craft), main > *:not(#ch02-craft):not(:has(#ch02-craft)) { visibility: hidden !important; opacity: 0 !important; } #ch02-craft .craft-stage-wrap > *:not(.craft-scene) { visibility: hidden !important; } html, body, #page-root, main, #ch02-craft, .pin-spacer, .craft-stage-wrap, .craft-scene, [data-chrome] { background: transparent !important; }',
});
// the object settles over a second or so of demand frames
await page.waitForTimeout(4000);
const canvas = await page.$('[data-craft-scene] canvas');
const shot = await canvas.screenshot({ type: 'png', omitBackground: true, timeout: 180000 });
// anything at a few levels of alpha is ground the capture left behind, not object
const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) if (data[i + 3] <= 16) data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
console.log('canvas', info.width, info.height);
// trim to the object with a margin, then a square poster on transparent ground
const trimmed = await sharp(png).trim({ threshold: 8 }).toBuffer();
const t = await sharp(trimmed).metadata();
const side = Math.round(Math.max(t.width, t.height) * 1.18);
const poster = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: trimmed, left: Math.round((side - t.width) / 2), top: Math.round((side - t.height) / 2) }])
  .png()
  .toBuffer();
for (const w of [640, 1080, 1600]) {
  await sharp(poster).resize(Math.min(w, side)).webp({ quality: 88, alphaQuality: 80, effort: 6 }).toFile(path.join(OUT, `ring-${w}w.webp`));
}
await sharp(poster).resize(Math.min(1600, side)).webp({ quality: 88, alphaQuality: 80, effort: 6 }).toFile(path.join(OUT, 'ring.webp'));
console.log('poster', side, 'px →', OUT);
await browser.close();
