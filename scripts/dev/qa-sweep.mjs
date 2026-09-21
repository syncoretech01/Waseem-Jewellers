#!/usr/bin/env node
/**
 * The zero-visible-error sweep: every route the client will open, at every viewport in the
 * brief, loaded and scrolled through, counting what a visitor must never see — console
 * errors, page errors, failed or 404 requests, broken images, horizontal overflow — and
 * whether the page reached its interactive state. It says where, not just how many.
 *
 *   node scripts/dev/qa-sweep.mjs [base] [headed] [only=<route substring>] [viewports=390x844,1440x900]
 *   npm run qa:sweep
 *
 * Writes .cache/qa-sweep/report.json. Exits 1 on any error, failed request, broken image or
 * overflow. Media aborted by a navigation, and the dev overlay's own requests, are not counted.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:/.test(a)) || 'http://localhost:3399').replace(/\/$/, '');
const HEADED = args.includes('headed');
const only = args.find((a) => a.startsWith('only='))?.slice(5);
const vpArg = args.find((a) => a.startsWith('viewports='))?.slice(10);
const OUT = path.resolve('.cache/qa-sweep');
fs.mkdirSync(OUT, { recursive: true });
process.env.TMP = process.env.TEMP = path.resolve('.cache/s22/tmp');
fs.mkdirSync(process.env.TMP, { recursive: true });

const ROUTES = [
  { key: 'home', path: '/' },
  { key: 'gold', path: '/gold' },
  { key: 'diamond', path: '/diamond' },
  { key: 'bridal', path: '/bridal' },
  { key: 'men', path: '/men' },
  { key: 'kids', path: '/kids' },
  { key: 'category', path: '/gold/ring' },
  { key: 'campaign', path: '/collections/bridal' },
  { key: 'pdp-campaign', path: '/jewellery/aks-e-noor-satlada-haar' },
  { key: 'pdp-two-image', path: '/jewellery/gold-bangles-k13798' },
  { key: 'pdp-single', path: '/jewellery/men-bracelet-br02334' },
  { key: 'pdp-priced', path: '/jewellery/gold-earings-t06237' },
].filter((r) => !only || r.path.includes(only) || r.key.includes(only));

const VIEWPORTS = (vpArg ? vpArg.split(',') : ['360x800', '390x844', '412x915', '430x932', '768x1024', '1280x800', '1440x900', '1920x1080', '1440x768']).map((s) => {
  const [w, h] = s.split('x').map(Number);
  return { w, h, mobile: w < 768 };
});

const browser = await chromium.launch({ headless: !HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
const rows = [];
let failed = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext(vp.mobile ? { viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: vp.w, height: vp.h } });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const notFound = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      // the dev server's own noise is not the site's
      if (/Download the React DevTools|Fast Refresh|hot-reloader|webpack-hmr|turbopack/i.test(t)) return;
      consoleErrors.push(t.slice(0, 200));
    });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
    page.on('requestfailed', (r) => {
      const err = r.failure()?.errorText || '';
      // media the browser abandons when it no longer needs it is not a failure
      if (/ERR_ABORTED/.test(err) && /\.(mp4|webm)|_rsc=|\/_next\/static\/chunks/.test(r.url())) return;
      if (/ERR_ABORTED/.test(err) && r.resourceType() === 'media') return;
      failedRequests.push(`${r.url().slice(0, 120)} ${err}`);
    });
    page.on('response', (res) => {
      if (res.status() === 404 || res.status() >= 500) notFound.push(`${res.status()} ${res.url().slice(0, 120)}`);
    });
    let ok = true;
    let interactive = false;
    let overflow = 0;
    let brokenImages = [];
    let height = 0;
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'load', timeout: 120000 });
      interactive = await page.waitForFunction(() => !!window.__wjConcierge, null, { timeout: 60000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(2500);
      // a full scroll-through at a reading pace, so every lazy thing is asked for
      await page.evaluate(async () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        const step = innerHeight * 0.25;
        for (let y = 0; y <= max; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 70));
        }
        window.scrollTo(0, max);
        await new Promise((r) => setTimeout(r, 600));
      });
      const probe = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && !i.closest('[data-flip-clone]'));
        return {
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          broken: imgs.slice(0, 6).map((i) => (i.currentSrc || i.getAttribute('src') || '').slice(-80)),
          height: document.documentElement.scrollHeight,
        };
      });
      overflow = probe.overflow;
      brokenImages = probe.broken;
      height = probe.height;
    } catch (e) {
      ok = false;
      pageErrors.push('navigation: ' + String(e).slice(0, 160));
    }
    await page.waitForTimeout(400);
    const row = {
      viewport: `${vp.w}x${vp.h}`,
      route: route.key,
      interactive,
      consoleErrors,
      pageErrors,
      failedRequests,
      notFound,
      overflow,
      brokenImages,
      height,
      ok: ok && interactive && !consoleErrors.length && !pageErrors.length && !failedRequests.length && !notFound.length && !overflow && !brokenImages.length,
    };
    rows.push(row);
    if (!row.ok) failed++;
    const flag = row.ok ? 'ok  ' : 'FAIL';
    console.log(`${flag} ${row.viewport.padEnd(9)} ${route.key.padEnd(14)} h=${String(height).padStart(6)} console=${consoleErrors.length} page=${pageErrors.length} failed=${failedRequests.length} 404=${notFound.length} overflow=${overflow} broken=${brokenImages.length}${interactive ? '' : ' NOT INTERACTIVE'}`);
    for (const t of [...consoleErrors, ...pageErrors, ...failedRequests, ...notFound, ...brokenImages].slice(0, 4)) console.log(`       · ${t}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `qa-sweep: ${failed} of ${rows.length} route/viewport pairs have something a visitor must not see — see ${OUT}/report.json` : `qa-sweep: clean — ${rows.length} route/viewport pairs, nothing a visitor must not see`);
process.exit(failed ? 1 : 0);
