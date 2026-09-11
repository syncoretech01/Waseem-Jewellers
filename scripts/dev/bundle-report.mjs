/**
 * What the browser actually downloads, per route, gzipped — measured, not estimated.
 *
 * PERFORMANCE_BUDGET.md carried "not measured" in its status column for a year of decisions
 * that depended on the number. This fills it in the only trustworthy way: a real browser loads
 * each route from a running build, every script response is captured, gzipped here with the
 * same algorithm a CDN uses, and attributed. Nothing is read from a manifest, because a
 * manifest says what *could* load and this says what *did*.
 *
 * Two figures per route:
 *
 *   initial   every script the HTML itself references — <script src> and <link modulepreload> —
 *             which is what stands between the visitor and hydration, regardless of when the
 *             browser happened to fire its load event
 *   settled   everything fetched by two seconds of network idle after that — the lazy chunks
 *             (three, the concierge, the menu) that arrive on idle or on interaction
 *
 * Chunks are attributed by content, not by name: Turbopack's names are hashes. A chunk that
 * mentions `THREE.REVISION` is three; one that mentions `@react-three/fiber` is R3F; `drei`
 * by its own package marker; GSAP by `gsap.registerPlugin`. The rest is "app".
 *
 *   node scripts/dev/bundle-report.mjs [baseUrl]     default http://localhost:3300
 *
 * Writes .cache/bundle-report.json and prints the table that goes into the budget document.
 */
import { chromium } from 'playwright';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3300';
/** e.g. '?tier=HIGH' on a build with NEXT_PUBLIC_QA_TIER_OVERRIDE=1, so the craft object actually mounts. */
const SUFFIX = process.argv[3] ?? '';
const ROUTES = [
  { key: 'home', path: '/' },
  { key: 'department', path: '/gold' },
  { key: 'pdp', path: '/jewellery/lavender-halo-ring-r11912' },
  { key: 'campaign', path: '/collections/bridal' },
];

/** The budget lines from PERFORMANCE_BUDGET.md, in gzipped kilobytes. */
const BUDGET = { baseRouteJs: 170, threeChunk: 220, homeFirstLoad: 400 };

/**
 * Library-unique strings, so a chapter that *calls* gsap is not counted as gsap. `GSCache` and
 * `_scrollers` exist only inside the library; `__reactFiber` only inside react-dom. The
 * concierge bucket is the one this report exists to expose: its lexicon, tools and UI are
 * invisible until a visitor opens the panel, and every kilobyte of it in the initial load is
 * hydration the visitor waits on for nothing.
 */
const MARKERS = [
  ['react', /__reactFiber|__reactProps|react-dom/],
  ['three', /THREE\.REVISION|WebGLRenderer|BufferGeometry/],
  ['r3f', /@react-three\/fiber|useFrame\(/],
  ['drei', /@react-three\/drei/],
  ['gsap', /GSCache|_scrollers|gsap\.version/],
  ['concierge', /ur-Latn|lexicon|ConciergeController|conciergeStore|TOOL_DEFS/],
  ['lenis', /Lenis/],
  ['motion', /AnimatePresence|framer-motion|motion\/react/],
  // last, and without `__turbopack`: every chunk carries the loader boilerplate, so that string
  // attributed the whole application shell to the framework
  ['next', /createFromFetch|prefetchCache|app-router/],
];

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

function attribute(body) {
  for (const [name, re] of MARKERS) if (re.test(body)) return name;
  return 'app';
}

const browser = await chromium.launch();
const report = { base: BASE, measuredAt: new Date().toISOString(), routes: {} };

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const scripts = new Map();
  // the initial set is what the document asks for, read from the HTML rather than inferred
  // from event timing — which differs by route and by cache state
  const html = await (await fetch(BASE + route.path + SUFFIX)).text();
  const initial = new Set([...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, '')));

  page.on('response', async (res) => {
    const req = res.request();
    if (req.resourceType() !== 'script') return;
    const url = res.url();
    if (scripts.has(url)) return;
    let body;
    try {
      body = await res.text();
    } catch {
      return;
    }
    const gz = gzipSync(Buffer.from(body)).length;
    const rel = url.replace(BASE, '');
    scripts.set(url, { url: rel, raw: body.length, gz, kind: attribute(body), phase: initial.has(rel) ? 'initial' : 'settled' });
  });

  // domcontentloaded, with a long ceiling: on a software-GL machine the HIGH tier can hold the load event for a minute
  await page.goto(BASE + route.path + SUFFIX, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  // the ritual, then idle: lazy chunks arrive on requestIdleCallback and on first interaction
  await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  await page.mouse.move(400, 400);
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(1000);

  const list = [...scripts.values()];
  const sum = (pred) => list.filter(pred).reduce((n, s) => n + s.gz, 0);
  const byKind = Object.fromEntries(['app', 'react', 'next', 'three', 'r3f', 'drei', 'gsap', 'concierge', 'lenis', 'motion'].map((k) => [k, kb(sum((s) => s.kind === k))]));
  report.routes[route.key] = {
    path: route.path,
    initialGzKb: kb(sum((s) => s.phase === 'initial')),
    settledGzKb: kb(sum(() => true)),
    byKindGzKb: byKind,
    chunks: list.sort((a, b) => b.gz - a.gz).map((s) => ({ url: s.url, gzKb: kb(s.gz), kind: s.kind, phase: s.phase })),
  };
  await page.close();
}

await browser.close();

fs.mkdirSync(path.join(process.cwd(), '.cache'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), '.cache/bundle-report.json'), JSON.stringify(report, null, 2));

// ── the table ───────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log(`bundle report · ${BASE} · gzipped kB\n`);
console.log(pad('route', 12) + pad('initial', 10) + pad('settled', 10) + pad('react', 8) + pad('next', 8) + pad('gsap', 8) + pad('concierge', 11) + pad('motion', 8) + pad('lenis', 8) + pad('three', 8) + 'app');
for (const [key, r] of Object.entries(report.routes)) {
  const k = r.byKindGzKb;
  console.log(pad(key, 12) + pad(r.initialGzKb, 10) + pad(r.settledGzKb, 10) + pad(k.react, 8) + pad(k.next, 8) + pad(k.gsap, 8) + pad(k.concierge, 11) + pad(k.motion, 8) + pad(k.lenis, 8) + pad(k.three + k.r3f + k.drei, 8) + k.app);
}

const home = report.routes.home;
const three = home.byKindGzKb.three + home.byKindGzKb.r3f + home.byKindGzKb.drei;
const verdict = (label, value, limit) => console.log(`  ${pad(label, 40)} ${pad(value + ' kB', 12)} budget ${limit} kB   ${value <= limit ? 'within' : 'OVER by ' + kb((value - limit) * 1024)}`);
console.log('\nagainst PERFORMANCE_BUDGET.md:');
verdict('base route JS (home, initial)', home.initialGzKb, BUDGET.baseRouteJs);
verdict('three + R3F + drei (home, settled)', kb(three * 1024), BUDGET.threeChunk);
verdict('homepage first load incl. three (settled)', home.settledGzKb, BUDGET.homeFirstLoad);

console.log('\nlargest chunks on the homepage:');
for (const c of home.chunks.slice(0, 8)) console.log(`  ${pad(c.gzKb + ' kB', 10)} ${pad(c.kind, 8)} ${pad(c.phase, 9)} ${c.url}`);
