#!/usr/bin/env node
/**
 * Development-only: load a URL, scroll to Y (wheel-driven so Lenis/ScrollTrigger see it),
 * evaluate a JS expression and print the result.
 *   node scripts/dev/eval.mjs <url> <scrollY> "<js expression>" [--w 1440] [--h 900] [--wait 1500]
 */
import { chromium } from 'playwright';

const [url, yArg, js, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
const width = Number(opt('w', 1440));
const height = Number(opt('h', 900));
const wait = Number(opt('wait', 1500));
const y = Number(yArg ?? 0);

async function launch() {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      return await chromium.launch({ headless: true, channel, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    } catch {
      /* next */
    }
  }
  throw new Error('no browser');
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width, height } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(wait);
if (y > 0) {
  // wheel in steps so Lenis animates and ScrollTrigger updates
  const steps = Math.max(1, Math.ceil(y / 600));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.min(600, y - i * 600));
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1600);
}
const result = await page.evaluate(js).catch((e) => `EVAL ERROR: ${e.message}`);
console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
if (logs.length) console.log(logs.join('\n'));
await browser.close();
