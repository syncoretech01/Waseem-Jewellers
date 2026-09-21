#!/usr/bin/env node
/**
 * The morph, door by door. Every door to a piece that shows the piece's photograph must fly
 * that photograph into the page it opens — no clone, or a curtain, is a failure — and every
 * door that is only words must still get the curtain. For each door the check clicks, samples
 * the transition layer every frame (never more than 40 ms apart), and records:
 *
 *   clone      when the first `[data-flip-clone]` appeared after the click
 *   route      when the destination committed (the dev server's render time, or the network's)
 *   parked     time the clone sat still at its predicted frame waiting for the route
 *   flight     click → the clone at rest on its landing rect, less the park and the frozen frames: the time it was moving
 *   landing    the clone's rect at rest against the destination's visible frame, in px
 *   blank      frames where the veil or curtain covered the page with no clone on it
 *   crossfade  whether a second photograph was dissolved in (a different asset at the destination)
 *   stall      the longest gap between two sampled frames — the route commit or the destination's first paint
 *
 * Fails on: no clone for an image door, a clone for a word door, a landing off by more than
 * 2 px, a flight over 800 ms, a blank frame while an image door was flying, or a page error.
 * The last step is the browser's back button from the piece: the plain veil, never a clone.
 *
 *   node scripts/dev/flip-check.mjs [base] [headed] [WxH] [reduced] [shots] [only=<door>] [tier=HIGH]
 *   npm run flip:check
 *
 * Writes .cache/flip-check/report.json and, with `shots`, a mid-flight screenshot per door.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv.find((a) => /^https?:\/\//.test(a)) || 'http://localhost:3300').replace(/\/$/, '');
const HEADED = process.argv.includes('headed');
const REDUCED = process.argv.includes('reduced');
const SHOTS = process.argv.includes('shots');
const only = process.argv.find((a) => a.startsWith('only='))?.slice(5);
const tier = process.argv.find((a) => a.startsWith('tier='))?.slice(5);
const size = (process.argv.find((a) => /^\d+x\d+$/.test(a)) || '1440x900').split('x').map(Number);
const mobile = size[0] < 768;
const OUT = path.resolve('.cache/flip-check');
fs.mkdirSync(OUT, { recursive: true });
process.env.TMP = process.env.TEMP = path.resolve('.cache/s22/tmp');
fs.mkdirSync(process.env.TMP, { recursive: true });

const PDP = '/jewellery/lavender-halo-ring-r11912';

/**
 * expect: 'flip' — the door carries the piece's photograph; 'curtain' — words only;
 * 'auto' — flies if a visible `img[data-flip-source=slug]` is on the page when clicked, else the curtain.
 */
const DOORS = [
  { name: 'cluster card', path: '/', sel: '#ch03-gold a.group\\/piece', expect: 'flip' },
  { name: 'kinds piece door', path: '/', sel: '#ch02-kinds a[href^="/jewellery/"]', expect: 'auto' },
  { name: 'bangle study figure', path: '/', sel: '#ch02-bangle a.group\\/piece', expect: 'flip' },
  { name: 'suite light figure', path: '/', sel: '#ch05-light a.group\\/piece', expect: 'flip' },
  { name: 'parted piece figure', path: '/', sel: '#ch09 a.group\\/piece', expect: 'flip' },
  { name: 'gate in-frame credit', path: '/', sel: '#ch03-gate a[href^="/jewellery/"]', expect: 'auto' },
  { name: 'department kind link', path: '/', sel: '#ch03-gold nav a', expect: 'curtain' },
  { name: 'worlds column', path: '/', sel: mobile ? '#ch04 a.world-tile' : '#ch04 a[aria-label$="explore the world"]', expect: 'flip', key: 'collection-hero' },
  { name: 'pdp related piece', path: PDP, sel: '[data-section="related"] a.group\\/piece', expect: 'flip' },
].filter((d) => !only || d.name.includes(only));

// headed is the real GPU; the window may open behind others, and an occluded Chromium stops its animation frames
const browser = await chromium.launch({
  headless: !HEADED,
  args: HEADED ? ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', '--window-position=0,0'] : [],
});
const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
const page = await context.newPage();
if (HEADED) await page.bringToFront();
const pageErrors = [];
const buildErrors = [];
page.on('pageerror', (e) => {
  const text = String(e).slice(0, 240);
  // a compile error from another edit in the tree reaches the page as an overlay error, not a fault of the door
  (/^Error: \.\/src\//.test(text) ? buildErrors : pageErrors).push(text);
});

// warm the routes once so dev compilation does not count as flight time
for (const p of ['/', PDP, '/collections/bridal', ...new Set(DOORS.map((d) => d.path))]) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(400);
}

/** Installed before the click: one sample per animation frame into window.__flip. */
const installSampler = () =>
  page.evaluate(() => {
    const layer = document.querySelector('[data-transition-layer]');
    const veil = layer?.querySelector('[data-veil]');
    const curtain = layer?.querySelector('[data-curtain]');
    const samples = [];
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const clone = layer?.querySelector('[data-flip-clone]');
      const r = clone?.getBoundingClientRect();
      const second = clone?.querySelector('[data-flip-clone-img="target"]');
      samples.push({
        t: Math.round(performance.now() - t0),
        veil: veil ? parseFloat(getComputedStyle(veil).opacity) : 0,
        curtainTop: curtain ? Math.round(curtain.getBoundingClientRect().top) : innerHeight,
        clone: r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), o: parseFloat(getComputedStyle(clone).opacity) } : null,
        second: second ? parseFloat(getComputedStyle(second).opacity) : null,
        path: location.pathname + location.search,
        transitioning: document.documentElement.classList.contains('is-transitioning'),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.__flip = { samples, stop: () => cancelAnimationFrame(raf), t0, click: null };
    // the clock starts at the click itself, not at the driver's call
    document.addEventListener('click', () => (window.__flip.click ??= performance.now() - t0), { capture: true, once: true });
  });

/** The destination frame's visible box, cut by every clipping ancestor, for the landing comparison. */
const targetBox = (key) =>
  page.evaluate((key) => {
    const cut = (a, b) => {
      const x = Math.max(a.x, b.x);
      const y = Math.max(a.y, b.y);
      const r = Math.min(a.x + a.w, b.x + b.w);
      const btm = Math.min(a.y + a.h, b.y + b.h);
      return { x, y, w: Math.max(0, r - x), h: Math.max(0, btm - y) };
    };
    const boxOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const inset = (clip, box) => {
      const m = /^inset\(([^)]*)\)/.exec(clip);
      if (!m) return null;
      const parts = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/).slice(0, 4);
      const sides = parts.map((p, i) => (p.endsWith('%') ? (parseFloat(p) / 100) * (i % 2 === 0 ? box.h : box.w) : parseFloat(p)));
      const [t, r = t, b = t, l = r] = sides;
      return { x: box.x + l, y: box.y + t, w: box.w - l - r, h: box.h - t - b };
    };
    const el = [...document.querySelectorAll(`[data-flip-target="${key}"]`)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    let box = boxOf(el);
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') box = cut(box, boxOf(a));
      if (cs.clipPath && cs.clipPath !== 'none') {
        const i = inset(cs.clipPath, boxOf(a));
        if (i) box = cut(box, i);
      }
    }
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    return { x: +box.x.toFixed(1), y: +box.y.toFixed(1), w: +box.w.toFixed(1), h: +box.h.toFixed(1), imgVisible: img ? getComputedStyle(img).visibility !== 'hidden' : null };
  }, key);

const results = [];
const failures = [];

for (const door of DOORS) {
  const key = door.key || 'product-hero';
  await page.goto(`${BASE}${door.path}${tier ? `?tier=${tier}` : ''}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__wjConcierge, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // the first match that is laid out: a chapter's reduced-motion stack, or a phone layout, hides the other
  const before = await page.evaluate((sel) => {
    const a = [...document.querySelectorAll(sel)].find((el) => el.getBoundingClientRect().width > 0);
    if (!a) return null;
    a.setAttribute('data-flip-check-door', '');
    a.scrollIntoView({ block: 'center' });
    return { href: a.getAttribute('href'), hasImg: !!a.querySelector('img') };
  }, door.sel);
  if (!before) {
    results.push({ door: door.name, expected: door.expect, got: 'no element' });
    // a chapter's reduced-motion layout may carry no door at all: reported, and the chapter's own concern
    if (!REDUCED) failures.push(`${door.name}: selector ${door.sel} matched nothing`);
    continue;
  }
  await page.waitForTimeout(1200);
  // a visitor clicks a photograph they can see: wait for the door's image (a long-tail piece comes from the shop's CDN)
  await page
    .waitForFunction(() => [...(document.querySelector('[data-flip-check-door]')?.querySelectorAll('img') ?? [])].every((i) => i.complete && (i.naturalWidth > 0 || i.dataset.failed)), null, { timeout: 15000 })
    .catch(() => {});
  // and clicks a page that is drawing: the craft scene's shader compile on a real GPU freezes the page for seconds after it scrolls near
  await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          let run = 0;
          let last = performance.now();
          const started = last;
          const tick = () => {
            const now = performance.now();
            run = now - last < 60 ? run + 1 : 0;
            last = now;
            if (run >= 12 || now - started > 20000) resolve(now - started);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    )
    .catch(() => {});
  const slug = /^\/jewellery\/([^/?#]+)/.exec(before.href || '')?.[1] || null;
  const sourceOnScreen = await page.evaluate(
    ({ slug }) => {
      const a = document.querySelector('[data-flip-check-door]');
      const inLink = a?.querySelector('img');
      const seen = (img) => {
        const r = img.getBoundingClientRect();
        const vis = { w: Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), h: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) };
        return img.currentSrc && img.naturalWidth > 0 && vis.w * vis.h >= 48 * 48 && vis.w * vis.h >= 0.4 * r.width * r.height;
      };
      if (inLink && seen(inLink)) return 'in link';
      if (slug) for (const img of document.querySelectorAll(`img[data-flip-source="${CSS.escape(slug)}"]`)) if (seen(img)) return 'on page';
      return 'none';
    },
    { slug },
  );
  const expected = REDUCED ? 'veil' : door.expect === 'auto' ? (sourceOnScreen === 'none' ? 'curtain' : 'flip') : door.expect;

  // a headed window that has slipped behind another gets one frame a second, and a flight measured at that rate is not a flight
  if (HEADED) await page.bringToFront();
  await installSampler();
  // a few frames with the sampler armed before the click, so its first sample precedes the clone
  const armed = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 250) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); setTimeout(() => r(-n), 2000); }));
  if (process.env.FLIP_DEBUG) console.log(door.name, 'sampler armed; frames in 250 ms:', armed);
  if (armed < 6) pageErrors.push(`${door.name}: the page drew ${Math.abs(armed)} frame(s) in 250 ms before the click — a hidden or throttled window cannot measure a flight`);
  const clickAt = Date.now();
  await page.click('[data-flip-check-door]', { force: true, noWaitAfter: true, timeout: 5000 }).catch((e) => pageErrors.push(`${door.name} click: ${String(e).slice(0, 120)}`));
  let shot = null;
  if (SHOTS && expected === 'flip') {
    // a screenshot stalls rendering for a few frames; taken once, a third of the way in, and the flight is judged from what follows
    await page.waitForTimeout(220);
    shot = path.join(OUT, `${door.name.replace(/\s+/g, '-')}-${size[0]}x${size[1]}-midflight.png`);
    await page.screenshot({ path: shot });
  }
  // wait for the transition to end: the class is gone and no clone remains (or six seconds)
  await page
    .waitForFunction(() => !document.documentElement.classList.contains('is-transitioning') && !document.querySelector('[data-flip-clone]'), null, { timeout: 6000, polling: 40 })
    .catch(() => {});
  await page.waitForTimeout(80);
  const samples = await page.evaluate(() => {
    window.__flip.stop();
    const click = window.__flip.click ?? 0;
    return window.__flip.samples.filter((s) => s.t >= click).map((s) => ({ ...s, t: s.t - click }));
  });
  const target = await targetBox(key);
  const landedPath = await page.evaluate(() => location.pathname + location.search);

  const cloneFrames = samples.filter((s) => s.clone);
  const curtainUsed = samples.some((s) => s.curtainTop < size[1] * 0.5);
  const veilUsed = samples.some((s) => s.veil > 0.5);
  const got = cloneFrames.length ? 'flip' : curtainUsed ? 'curtain' : veilUsed ? 'veil' : 'none';
  const maxGap = samples.reduce((m, s, i) => (i ? Math.max(m, s.t - samples[i - 1].t) : 0), 0);

  // the landing rect: the clone at rest before it fades (the last full-opacity frame)
  const solid = cloneFrames.filter((s) => s.clone.o >= 0.99);
  const landing = solid.length ? solid[solid.length - 1].clone : null;
  const near = (a, b) => Math.abs(a.x - b.x) < 0.75 && Math.abs(a.y - b.y) < 0.75 && Math.abs(a.w - b.w) < 0.75 && Math.abs(a.h - b.h) < 0.75;
  const landedAt = landing ? solid.find((s) => near(s.clone, landing))?.t ?? null : null;
  // the route: when the destination committed
  const routeAt = samples.find((s) => s.path !== samples[0].path)?.t ?? null;
  /**
   * Every interval up to the landing is one of three things: the clone parked at its
   * predicted frame waiting for the route; a frozen frame (the commit, the first paint — the
   * page busy, the clone not moving); or flight. Only the third is the morph's own time.
   */
  let parked = 0;
  let flight = null;
  if (landedAt !== null) {
    flight = solid[0].t;
    for (let i = 1; i < solid.length; i++) {
      const s = solid[i];
      if (s.t > landedAt) break;
      const gap = s.t - solid[i - 1].t;
      if (near(s.clone, solid[i - 1].clone) && !near(s.clone, landing)) parked += gap;
      else if (gap > 120) flight += 33;
      else flight += gap;
    }
    flight = Math.round(flight);
  }
  const delta = landing && target ? Math.max(Math.abs(landing.x - target.x), Math.abs(landing.y - target.y), Math.abs(landing.w - target.w), Math.abs(landing.h - target.h)) : null;
  const blank = cloneFrames.length
    ? samples.filter((s) => s.t <= (landedAt ?? Infinity) && (s.veil >= 0.98 || s.curtainTop <= 1) && (!s.clone || s.clone.o < 0.05)).length
    : null;
  const crossfade = cloneFrames.some((s) => s.second !== null && s.second > 0.5);

  const row = {
    door: door.name,
    expected,
    got,
    source: sourceOnScreen,
    'clone@ms': cloneFrames[0] ? Math.round(cloneFrames[0].t) : null,
    'route ms': routeAt === null ? null : Math.round(routeAt),
    'parked ms': cloneFrames.length ? Math.round(parked) : null,
    'flight ms': flight,
    'delta px': delta === null ? null : +delta.toFixed(1),
    blank,
    crossfade: cloneFrames.length ? crossfade : null,
    'hero shown': target?.imgVisible ?? null,
    'stall ms': maxGap,
    landed: landedPath === (before.href || '').replace(/^https?:\/\/[^/]+/, '') ? 'ok' : landedPath,
  };
  results.push(row);

  const fail = (why) => failures.push(`${door.name}: ${why}`);
  if (got !== expected) fail(`expected ${expected}, got ${got}`);
  if (got === 'flip') {
    if (flight === null) fail('the clone never came to rest');
    else if (flight > 800) fail(`flight ${flight} ms > 800`);
    if (delta === null) fail('no landing rect or destination frame to compare');
    else if (delta > 2) fail(`landing off by ${delta.toFixed(1)} px`);
    if (blank) fail(`${blank} blank frame(s) while flying`);
    if (target && target.imgVisible === false) fail('destination image left hidden');
  }
  if (row.landed !== 'ok') fail(`landed on ${landedPath}`);
  if (shot) row.shot = path.relative(process.cwd(), shot);
  fs.writeFileSync(path.join(OUT, `${door.name.replace(/\s+/g, '-')}-${size[0]}x${size[1]}.json`), JSON.stringify({ door, expected, target, samples: samples.slice(0, 400), pageErrors, buildErrors, clickAt }, null, 1));
}

// and the way back: the browser's own history step gets the plain reveal, never a clone
if (!only) {
  const from = await page.evaluate(() => location.pathname + location.search);
  await installSampler();
  await page.goBack({ waitUntil: 'commit' }).catch((e) => pageErrors.push(`back: ${String(e).slice(0, 120)}`));
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-transitioning'), null, { timeout: 6000, polling: 40 }).catch(() => {});
  await page.waitForTimeout(700);
  const samples = await page.evaluate(() => {
    window.__flip.stop();
    return window.__flip.samples;
  });
  const to = await page.evaluate(() => location.pathname + location.search);
  const clone = samples.some((s) => s.clone);
  const veilLifted = samples.some((s) => s.veil > 0.5) && samples[samples.length - 1].veil < 0.05;
  const got = clone ? 'flip' : veilLifted ? 'veil' : 'none';
  results.push({ door: 'back from ' + from, expected: 'veil', got, landed: to !== from ? 'ok' : to });
  if (clone) failures.push('back: a clone flew on a history step');
  if (!veilLifted) failures.push('back: the veil did not lift');
  if (to === from) failures.push('back: did not leave ' + from);
}

console.log(`flip-check ${BASE} ${size.join('x')}${HEADED ? ' headed' : ''}${REDUCED ? ' reduced' : ''}${tier ? ` tier=${tier}` : ''}`);
console.table(results);
if (pageErrors.length) {
  console.log('page errors:');
  for (const e of pageErrors) console.log('  ' + e);
  failures.push(`${pageErrors.length} page error(s)`);
}
if (buildErrors.length) console.log(`${buildErrors.length} compile error(s) from other edits in the tree, not counted: ${buildErrors[0].slice(0, 80)}`);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, size, headed: HEADED, reduced: REDUCED, results, failures, pageErrors, buildErrors }, null, 2));
await browser.close();
if (failures.length) {
  console.log('FAIL');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('OK');
