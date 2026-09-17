#!/usr/bin/env node
/**
 * The bespoke chapter, read at every scroll position: at no point may two pieces of text
 * occupy the same place on the screen. The chapter's stage words (one pair · the crown · the
 * bell · the tassel · yours), the parted pair's labels and its closing line, the title, the
 * line and the door are all text; the check samples the pin slowly forward, fast forward,
 * slowly backward, in a zigzag and across a resize inside the section, and fails on any two
 * visible text boxes that overlap by more than a fifth of the smaller one.
 *
 *   node scripts/dev/bespoke-check.mjs [base] [headed] [WxH]
 *   npm run bespoke:check
 *
 * Writes .cache/bespoke-check/report.json and a screenshot of every overlap it finds.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const HEADED = process.argv.includes('headed');
const size = (process.argv.find((a) => /^\d+x\d+$/.test(a)) || '1440x900').split('x').map(Number);
const OUT = path.resolve('.cache/bespoke-check');
fs.mkdirSync(OUT, { recursive: true });
process.env.TMP = process.env.TEMP = path.resolve('.cache/s22/tmp');
fs.mkdirSync(process.env.TMP, { recursive: true });

const browser = await chromium.launch({ headless: !HEADED });
const page = await (await browser.newContext({ viewport: { width: size[0], height: size[1] } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__wjConcierge, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

const range = await page.evaluate(() => {
  const s = document.querySelector('#ch09');
  if (!s) return null;
  const r = s.getBoundingClientRect();
  // the pin spacer holds the chapter's scroll length; its parent is the spacer when pinned
  const spacer = s.parentElement?.classList.contains('pin-spacer') ? s.parentElement : s;
  const sr = spacer.getBoundingClientRect();
  return { top: r.top + window.scrollY, end: sr.top + window.scrollY + sr.height - innerHeight };
});
if (!range) {
  console.log('bespoke-check: no #ch09 on this page');
  process.exit(2);
}
console.log('pin', Math.round(range.top), '→', Math.round(range.end));

/** Every visible text box in the chapter, with what it says. */
const sample = () =>
  page.evaluate(() => {
    const root = document.querySelector('#ch09');
    const boxes = [];
    const SEL = 'h2, p, span.micro, .bespoke-word, .parted-label span, .parted-closing, button';
    const els = root.querySelectorAll(SEL);
    const vis = (el) => {
      let e = el;
      while (e && e !== root) {
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.12) return false;
        e = e.parentElement;
      }
      return true;
    };
    for (const el of els) {
      // leaves only: a container whose text lives in children is not itself a box
      if (el.querySelector(SEL)) continue;
      const text = (el.textContent || '').trim();
      if (!text || !vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
      boxes.push({ text: text.slice(0, 40), x: r.x, y: r.y, w: r.width, h: r.height, cls: el.className?.toString().split(' ').find((c) => /bespoke|parted/.test(c)) || el.tagName.toLowerCase() });
    }
    return boxes;
  });

const overlaps = (boxes) => {
  const found = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      // a label beside its own hairline, or a word beside its numeral, is one line, not two
      if (a.text === b.text) continue;
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const inter = ix * iy;
      const small = Math.min(a.w * a.h, b.w * b.h);
      if (small > 0 && inter / small > 0.2) found.push({ a: a.text, b: b.text, ratio: +(inter / small).toFixed(2), ca: a.cls, cb: b.cls });
    }
  return found;
};

const anomalies = [];
const at = async (y, label) => {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(90);
  const boxes = await sample();
  const found = overlaps(boxes);
  if (found.length) {
    anomalies.push({ label, y: Math.round(y), found });
    if (anomalies.length <= 12) await page.screenshot({ path: path.join(OUT, `overlap-${anomalies.length}.jpg`), type: 'jpeg', quality: 70 });
  }
};
const span = range.end - range.top;
const patterns = [
  ['slow forward', Array.from({ length: 60 }, (_, i) => range.top - 200 + ((span + 400) * i) / 59)],
  ['fast forward', Array.from({ length: 8 }, (_, i) => range.top - 100 + ((span + 200) * i) / 7)],
  ['slow backward', Array.from({ length: 60 }, (_, i) => range.end + 200 - ((span + 400) * i) / 59)],
  ['zigzag', Array.from({ length: 40 }, (_, i) => range.top + span * (0.5 + 0.45 * Math.sin(i * 1.7)))],
];
for (const [label, ys] of patterns) for (const y of ys) await at(y, label);
// a resize inside the section
await page.evaluate((y) => window.scrollTo(0, y), range.top + span * 0.45);
await page.setViewportSize({ width: size[0], height: Math.max(700, size[1] - 132) });
await page.waitForTimeout(900);
for (const y of Array.from({ length: 20 }, (_, i) => range.top + (span * i) / 19)) await at(y, 'after resize');
await page.setViewportSize({ width: size[0], height: size[1] });

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, size, range, anomalies, errors }, null, 2));
const byPair = new Map();
for (const a of anomalies) for (const f of a.found) byPair.set(`${f.a} × ${f.b}`, (byPair.get(`${f.a} × ${f.b}`) || 0) + 1);
for (const [k, v] of byPair) console.log(`  ${String(v).padStart(3)}×  ${k}`);
console.log('errors', errors);
if (anomalies.length) {
  console.log(`bespoke-check: ${anomalies.length} sampled positions with overlapping text — see ${OUT}`);
  process.exit(1);
}
console.log('bespoke-check: clean — one word at a time, at every position sampled');
await browser.close();
