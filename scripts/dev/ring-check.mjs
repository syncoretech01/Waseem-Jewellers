// The craft chapter's one rule: over the ring there is the ring, its sequence, or the still of the ring —
// never a drawing, never a second mark. This scrolls through the pinned sequence slowly, fast,
// backwards and back and forth, sampling the DOM every 80 ms for anything brand-like or drawn
// that is visible over the stage, and for the object and its still both being off at once.
// Exits non-zero on any such frame. A regression gate for the layer that once surfaced here.
//   node scripts/dev/ring-check.mjs <base> [headed] [tier] [phone]
// `phone` samples the phone form (390×844, touch, DPR 2): the stage sticks by CSS there, so a
// stage in view is one whose sticky box sits at the top of the viewport.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'https://waseem-jewellers-two.vercel.app').replace(/\/$/, '');
const HEADED = process.argv[3] === 'headed';
const TIER = process.argv[4] && process.argv[4] !== 'phone' ? process.argv[4] : '';
const PHONE = process.argv.includes('phone');
const OUT = path.resolve('.cache/ring-check');
fs.mkdirSync(OUT, { recursive: true });
process.env.TMP = process.env.TEMP = path.resolve('.cache/tmp');
fs.mkdirSync(process.env.TMP, { recursive: true });

const browser = await chromium.launch({ headless: !HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' || /\[concierge\] illegal|GSAP/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
await page.goto(`${BASE}/${TIER ? `?tier=${TIER}` : ''}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__wjConcierge, null, { timeout: 60000 });
await page.waitForTimeout(5000);

const geo = await page.evaluate(() => {
  const s = document.querySelector('#ch02-craft');
  const r = s.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height, tier: document.documentElement.dataset.tier };
});
console.log('craft', geo);

const sample = () =>
  page.evaluate(() => {
    const stage = document.querySelector('.craft-stage-wrap');
    const sr = stage?.getBoundingClientRect();
    const vis = (el) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      let o = 1;
      let n = el;
      while (n && n !== document.body) {
        const c = getComputedStyle(n);
        o *= Number(c.opacity);
        if (c.visibility === 'hidden' || c.display === 'none') return false;
        n = n.parentElement;
      }
      return o > 0.04;
    };
    const overStage = (el) => {
      if (!sr) return false;
      const r = el.getBoundingClientRect();
      return r.width > 24 && r.height > 24 && r.bottom > Math.max(0, sr.top) && r.top < Math.min(innerHeight, sr.bottom) && r.right > 0 && r.left < innerWidth;
    };
    const brand = [...document.querySelectorAll('svg, img, video, canvas, [data-mark], .ritual, header')].filter((el) => !el.closest('[data-concierge-orb]') && !el.closest('footer') && overStage(el) && vis(el)).map((el) => {
      const r = el.getBoundingClientRect();
      const label = el.getAttribute('aria-label') || el.getAttribute('alt') || el.className?.baseVal || el.className || el.id || '';
      return `${el.tagName.toLowerCase()}${String(label).slice(0, 40) ? '[' + String(label).slice(0, 40) + ']' : ''}@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    });
    const stone = document.querySelector('.craft-stone, .craft-ring, .craft-band, [data-craft-scene] .stone-lines');
    const scene = document.querySelector('[data-craft-scene]');
    const posterEl = document.querySelector('.craft-poster');
    const canvasWrap = scene?.querySelector('canvas')?.parentElement;
    const posterOn = posterEl ? vis(posterEl) : false;
    const canvasOn = canvasWrap ? vis(canvasWrap) : false;
    // the states (the same object, one still per beat, on a phone or without WebGL) count as the object
    const framesEl = document.querySelector('.craft-states');
    const framesOn = framesEl ? vis(framesEl) && [...framesEl.querySelectorAll('.craft-state')].some((f) => vis(f)) : false;
    return {
      y: Math.round(window.scrollY),
      webgl: scene?.dataset.webgl,
      tier: document.documentElement.dataset.tier,
      demoted: document.documentElement.dataset.demoted ?? null,
      stoneVisible: stone ? vis(stone) : false,
      canvas: !!scene?.querySelector('canvas'),
      poster: posterOn,
      frames: framesOn,
      objectOn: posterOn || canvasOn || framesOn,
      pinned: stage ? getComputedStyle(stage).position : null,
      stageTop: sr ? Math.round(sr.top) : null,
      stage: stage?.dataset.stage ?? null,
      brand: brand.filter((b) => !/^canvas|^img\[An emerald-cut|^img\[craft-state|^img\[Rose-gold/.test(b)),
    };
  });

const log = [];
let shots = 0;
const seen = new Set();
const note = async (phase) => {
  const s = await sample();
  const key = `${s.webgl}|${s.stoneVisible}|${s.canvas}|${s.brand.join(';')}`;
  // a drawn stone over the stage, a stage with neither object nor still, or any mark that is not the fixed chrome
  const inStage = s.pinned === 'fixed' || (s.pinned === 'sticky' && s.stageTop === 0);
  const anomaly = s.stoneVisible === true || (inStage && !s.objectOn) || s.brand.some((b) => /ritual|lockup|\[.*(?:crest|mark|Waseem)/i.test(b) && !/^header/.test(b));
  log.push({ phase, ...s, anomaly });
  if (anomaly && !seen.has(key) && shots < 12) {
    seen.add(key);
    shots += 1;
    await page.screenshot({ path: path.join(OUT, `anomaly-${shots}-${phase}-${s.y}.jpg`), type: 'jpeg', quality: 70 });
    console.log('ANOMALY', phase, JSON.stringify(s).slice(0, 400));
  }
};

const scrollTo = async (y) => page.evaluate((yy) => window.scrollTo(0, yy), y);
const start = geo.top - 700;
const end = geo.top + geo.height + 200;

// the first sample is taken settled, not inside anticipatePin's frame after the initial jump
await scrollTo(start);
await page.waitForTimeout(400);
// 1. slow forward through the whole chapter
for (let y = start; y <= end; y += 60) { await scrollTo(y); await page.waitForTimeout(80); await note('slow-fwd'); }
// 2. fast backward
for (let y = end; y >= start; y -= 400) { await scrollTo(y); await page.waitForTimeout(60); await note('fast-back'); }
await page.waitForTimeout(1500); await note('rest-top');
// 3. fast forward
for (let y = start; y <= end; y += 400) { await scrollTo(y); await page.waitForTimeout(60); await note('fast-fwd'); }
await page.waitForTimeout(1500); await note('rest-bottom');
// 4. direction changes inside the pin
const mid = geo.top + geo.height * 0.4;
for (let i = 0; i < 12; i++) { await scrollTo(mid + (i % 2 ? 500 : -500)); await page.waitForTimeout(90); await note('zigzag'); }
// 5. wheel-driven scroll (Lenis path) forward and back
await scrollTo(start);
await page.waitForTimeout(500);
await page.mouse.move(PHONE ? 195 : 720, PHONE ? 420 : 450);
for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(50); await note('wheel-fwd'); }
await page.waitForTimeout(1200); await note('wheel-rest');
for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(50); await note('wheel-back'); }
await page.waitForTimeout(2500); await note('wheel-back-rest');

fs.writeFileSync(path.join(OUT, `log-${TIER || geo.tier}-${HEADED ? 'headed' : 'headless'}${PHONE ? '-phone' : ''}.json`), JSON.stringify({ geo, errors, log }, null, 1));
const anomalies = log.filter((l) => l.anomaly);
console.log(`samples ${log.length}, anomalies ${anomalies.length}, webgl states ${[...new Set(log.map((l) => l.webgl))].join(',')}, stone visible ${log.filter((l) => l.stoneVisible).length}, demoted ${[...new Set(log.map((l) => l.demoted))].join(',')}`);
console.log('brand seen over stage:', [...new Set(log.flatMap((l) => l.brand))].slice(0, 20));
console.log('errors', errors.slice(0, 5));
await browser.close();
if (anomalies.length) {
  console.log('ring-check: FAILED — a second layer, or no object, over the ring');
  process.exit(1);
}
console.log('ring-check: clean — the ring, or its still, and nothing else');
