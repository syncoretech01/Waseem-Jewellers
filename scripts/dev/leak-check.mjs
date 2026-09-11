/**
 * Do route changes and concierge cycles return the page to its resting counts?
 *
 * The plan's mandatory bar says no leaks — ScrollTriggers, ticker listeners and GL resources
 * back to baseline across route changes and concierge open/close. An audit on 11 September 2026
 * found three retainers that each kept a whole previous homepage alive per visit: an Observer
 * target in GSAP's module cache, six paused quickTo tweens, and a <source media> that Blink
 * never lets go of. This is the loop that found them, kept, so the fix stays fixed.
 *
 * Runs against a production build (the dev inspector is not available there), so GSAP internals
 * are read by counting what the browser exposes: DOM nodes and JS listeners after a forced GC
 * through CDP, and the heap. A monotonic rise of more than ~15% across loops is a leak.
 *
 *   node scripts/dev/leak-check.mjs [baseUrl]     default http://localhost:3399
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3399';
const LOOPS = 5;
const TOLERANCE = 0.15;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('HeapProfiler.enable');

const metrics = async () => {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(400);
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  const get = (name) => m.find((x) => x.name === name)?.value ?? 0;
  return { nodes: get('Nodes'), listeners: get('JSEventListeners'), heapMb: get('JSHeapUsedSize') / 1048576 };
};

// in-page navigation through the app's own links, never page.goto — a hard reload hides everything
const go = async (selector) => {
  await page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
  await page.waitForTimeout(3200);
};

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

console.log(`leak check · ${BASE} · ${LOOPS} loops of / → /gold → PDP → / → /collections/bridal → /\n`);
const samples = [];
for (let i = 0; i < LOOPS; i++) {
  await page.evaluate(() => document.querySelector('button[aria-controls="wj-menu"]')?.click());
  await page.waitForTimeout(1200);
  await go('#wj-menu a[href="/gold"]');
  await go('a[href^="/jewellery/"]');
  await go('header a[href="/"]');
  await go('a[href="/collections/bridal"]');
  await go('header a[href="/"]');
  const s = await metrics();
  samples.push(s);
  console.log(`loop ${i + 1}  nodes ${String(Math.round(s.nodes)).padStart(6)}  listeners ${String(Math.round(s.listeners)).padStart(5)}  heap ${s.heapMb.toFixed(1)} MB`);
}

// concierge open/close ×20
console.log('\nconcierge open/close ×20 on /');
const before = await metrics();
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => document.querySelector('[aria-label="Open the Waseem Concierge"]')?.click());
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('[data-salon] button[aria-label="Close the concierge"]')?.click());
  await page.waitForTimeout(500);
}
const after = await metrics();
console.log(`before  nodes ${Math.round(before.nodes)}  listeners ${Math.round(before.listeners)}  heap ${before.heapMb.toFixed(1)} MB`);
console.log(`after   nodes ${Math.round(after.nodes)}  listeners ${Math.round(after.listeners)}  heap ${after.heapMb.toFixed(1)} MB`);

await browser.close();

// verdict: compare the last loop to the first; the first includes one-off lazy chunks and caches
const first = samples[0];
const last = samples[samples.length - 1];
const grew = (k) => (last[k] - first[k]) / first[k];
const fails = [];
if (grew('nodes') > TOLERANCE) fails.push(`nodes +${Math.round(grew('nodes') * 100)}%`);
if (grew('listeners') > TOLERANCE) fails.push(`listeners +${Math.round(grew('listeners') * 100)}%`);
if (grew('heapMb') > TOLERANCE) fails.push(`heap +${Math.round(grew('heapMb') * 100)}%`);
const cyc = (after.nodes - before.nodes) / before.nodes;
if (cyc > TOLERANCE) fails.push(`concierge cycles nodes +${Math.round(cyc * 100)}%`);

console.log(fails.length ? `\nleaks: FAILED — ${fails.join(', ')} across ${LOOPS} loops` : `\nleaks: clean — nodes ${Math.round(grew('nodes') * 100)}%, listeners ${Math.round(grew('listeners') * 100)}%, heap ${Math.round(grew('heapMb') * 100)}% from loop 1 to ${LOOPS}`);
process.exit(fails.length ? 1 : 0);
