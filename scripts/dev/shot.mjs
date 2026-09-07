#!/usr/bin/env node
/**
 * Development-only page inspector: loads a URL in headless Edge/Chromium,
 * collects console errors/warnings and page errors, scrolls with real wheel
 * events (so Lenis + ScrollTrigger behave as for a visitor) and writes screenshots.
 *
 *   node scripts/dev/shot.mjs <url> [--out dir] [--w 1440] [--h 900] [--steps N] [--to px]
 *        [--wait ms] [--mobile] [--reduced] [--full] [--click sel] [--eval "js"] [--tag name] [--hover sel]
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3300/';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const out = opt('out', 'scripts/dev/shots');
const width = Number(opt('w', 1440));
const height = Number(opt('h', 900));
const wait = Number(opt('wait', 1800));
const steps = Number(opt('steps', 0));
const to = Number(opt('to', 0));
const tag = opt('tag', 'shot');
const clickSel = opt('click', null);
const hoverSel = opt('hover', null);
const evalJs = opt('eval', null);
fs.mkdirSync(out, { recursive: true });

async function launch() {
  let lastErr;
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      return await chromium.launch({
        headless: true,
        channel,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const browser = await launch();
const context = await browser.newContext({
  ...(flag('mobile') ? devices['iPhone 13'] : { viewport: { width, height }, deviceScaleFactor: 1 }),
  reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
  colorScheme: 'dark',
});
const page = await context.newPage();
const log = [];
page.on('console', (m) => {
  const t = m.type();
  if (t === 'info' && /\[(loader|spotlight)\]/.test(m.text())) log.push(`[console.info] ${m.text()}`);
  if (t === 'error' || t === 'warning') log.push(`[console.${t}] ${m.text().slice(0, flag('trace') || /hydrat/i.test(m.text()) ? 2400 : 300)}`);
});
page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('__nextjs')) log.push(`[http ${r.status()}] ${r.url()}`);
});
page.on('requestfailed', (r) => {
  const u = r.url();
  const err = r.failure()?.errorText ?? '';
  if (!u.includes('_next/webpack-hmr') && !u.includes('__nextjs') && err !== 'net::ERR_ABORTED') log.push(`[requestfailed] ${u} ${err}`);
});

async function wheelTo(targetY) {
  const current = await page.evaluate(() => window.scrollY);
  let remaining = targetY - current;
  const dir = Math.sign(remaining);
  while (Math.abs(remaining) > 1) {
    const delta = dir * Math.min(600, Math.abs(remaining));
    await page.mouse.wheel(0, delta);
    remaining -= delta;
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1100);
}

if (flag('trace')) {
  await page.addInitScript(() => {
    const orig = console.warn.bind(console);
    console.warn = (...args) => {
      const msg = args.map(String).join(' ');
      if (/GSAP target/.test(msg)) {
        const stack = (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 9).map((l) => l.trim().replace(/^at /, '')).join(' <- ');
        orig(msg + ' | ' + stack);
      } else orig(...args);
    };
  });
}
const t0 = Date.now();
await page.goto(url, { waitUntil: (opt('waituntil', 'networkidle') || 'networkidle'), timeout: 90000 }).catch((e) => log.push(`[goto] ${e.message}`));
await page.mouse.move(width / 2, height / 2);
await page.waitForTimeout(wait);
if (clickSel) {
  await page.click(clickSel).catch((e) => log.push(`[click] ${e.message}`));
  await page.waitForTimeout(1000);
}
if (hoverSel) {
  await page.hover(hoverSel).catch((e) => log.push(`[hover] ${e.message}`));
  await page.waitForTimeout(900);
}
if (to > 0) await wheelTo(to);
// --act "click:sel;wait:ms;type:sel|text;press:Key;hover:sel;shot:name;eval:js;wheel:px"
const acts = (opt('act', '') || '').split(';').map((a) => a.trim()).filter(Boolean);
for (const act of acts) {
  const i = act.indexOf(':');
  const kind = act.slice(0, i);
  const rest = act.slice(i + 1);
  try {
    if (kind === 'click') await page.click(rest, { timeout: 5000 });
    else if (kind === 'wait') await page.waitForTimeout(Number(rest));
    else if (kind === 'waitfor') await page.waitForSelector(rest, { timeout: 30000, state: 'attached' });
    else if (kind === 'type') {
      const j = rest.indexOf('|');
      await page.fill(rest.slice(0, j), rest.slice(j + 1));
    } else if (kind === 'press') await page.keyboard.press(rest);
    else if (kind === 'hover') await page.hover(rest, { timeout: 5000 });
    else if (kind === 'wheel') await wheelTo((await page.evaluate(() => window.scrollY)) + Number(rest));
    else if (kind === 'goto') {
      const [sel, vh] = rest.split('|');
      const top = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 0; const spacer = el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el; return spacer.getBoundingClientRect().top + window.scrollY; }, sel);
      await wheelTo(Math.round(top + Number(vh || 0) * (await page.evaluate(() => window.innerHeight))));
    }
    else if (kind === 'shot') await page.screenshot({ path: path.join(out, `${tag}-${rest}.png`), fullPage: flag('full') });
    else if (kind === 'eval') console.log('[eval]', JSON.stringify(await page.evaluate(rest)));
    else if (kind === 'evalfile') console.log('[eval]', JSON.stringify(await page.evaluate(fs.readFileSync(rest, 'utf8'))));
  } catch (e) {
    log.push(`[act ${act}] ${e.message}`);
  }
}
if (evalJs) {
  const r = await page.evaluate(evalJs).catch((e) => `eval error: ${e.message}`);
  console.log('[eval]', JSON.stringify(r));
}
await page.screenshot({ path: path.join(out, `${tag}-0.png`), fullPage: flag('full') });

if (steps > 0) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let i = 1; i <= steps; i++) {
    await wheelTo(Math.round((total * i) / steps));
    await page.screenshot({ path: path.join(out, `${tag}-${i}.png`) });
  }
}

const metrics = await page.evaluate(() => ({
  href: location.href,
  title: document.title,
  scrollHeight: document.documentElement.scrollHeight,
  theme: document.documentElement.getAttribute('data-theme'),
  tier: document.documentElement.getAttribute('data-tier'),
  triggers: window.__wj?.triggers?.() ?? null,
  tweens: window.__wj?.tweens?.() ?? null,
  canvases: document.querySelectorAll('canvas').length,
  videos: document.querySelectorAll('video').length,
}));
console.log(JSON.stringify({ ms: Date.now() - t0, ...metrics }));
console.log(log.length ? log.join('\n') : 'NO CONSOLE ERRORS/WARNINGS');
await browser.close();
