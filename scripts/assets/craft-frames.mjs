// Renders the craft chapter's ring in each of its states, from the same scene the page draws,
// into the stills the chapter shows where the live object is not mounted: every phone, a device
// without WebGL, a context lost twice. The chapter's `CRAFT_STATES` (craftProgress.ts) is the
// one list of states; this script reads it, mounts the live object on the dev server, poses it
// through the development handle (`window.__wjCraft.pose` — the camera and the turn held, only
// the parts moving), waits for the damped object to settle, captures the canvas, then cuts every
// state to ONE crop box (the union of the object's extent across the states, with a margin) so
// the object never jumps between states and the parts that do not move are the same pixels in
// every one. Run against a dev server (?tier=HIGH is honoured there) — the scene is rendered
// through SwiftShader, which is slow and exact.
//   node scripts/assets/craft-frames.mjs http://localhost:3300
//   node scripts/assets/craft-frames.mjs http://localhost:3300 --out=.cache/s22/craft2/probe
// A probe of the desktop choreography at given progress values (scrolled, not posed):
//   node scripts/assets/craft-frames.mjs http://localhost:3300 --at=.06,.21,.39 --out=.cache/s22/craft2/probe
// The assembled poster (ring-*.webp) is craft-poster.mjs's and is not rewritten here.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:/.test(a)) || 'http://localhost:3300').replace(/\/$/, '');
const val = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = path.resolve(val('out') || 'public/assets/waseem/images/craft');
const WIDTHS = [640, 1080, 1600];
const QUALITY = Number(val('quality') || 82);
// the alpha is a clean mask (0, 255 and an anti-aliased edge); at 70 it is indistinguishable from
// 90 on the ink and a fifth smaller
const ALPHA_QUALITY = Number(val('alpha') || 70);
const MARGIN = Number(val('margin') || 0.05);
// the canvas: tall enough that the crop carries 1600 real pixels, and a little narrower than
// it is tall, so the camera stands back as it does on a portrait stage (CraftScene `far`) and
// the dropped band of the metal state is not cut by the frame's bottom edge (it was, on a
// square canvas). A probe of the desktop choreography (--at) keeps the square canvas.
const AT = val('at');
const SIDE = Number(val('side') || 2600);
const WIDTH = Number(val('width') || (AT ? SIDE : 2000));
const HEIGHT = Number(val('height') || SIDE);
fs.mkdirSync(OUT, { recursive: true });

/** The layers, from the one list the chapter reads: `{ key, pose }` per entry. */
function readStates() {
  const src = fs.readFileSync(path.resolve('src/components/home/chapters/craftProgress.ts'), 'utf8');
  const block = src.match(/CRAFT_LAYERS[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1];
  if (!block) throw new Error('CRAFT_LAYERS not found in craftProgress.ts');
  return [...block.matchAll(/key:\s*'([a-z]+)'\s*,\s*pose:\s*(\{[^}]*\})/g)].map((m, i) => ({ i, key: m[1], pose: JSON.parse(m[2].replace(/(\w+):/g, '"$1":')) }));
}
const STATES = AT ? AT.split(',').map((p, i) => ({ i, key: `p${p.replace(/^0?\./, '')}`, p: Number(p) })) : readStates();
console.log(AT ? 'probe' : 'layers', STATES.map((f) => `${f.i}:${f.key}${f.p !== undefined ? '@' + f.p : ''}`).join(' '));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
let top = 0;
// the pin: +=155% of the viewport on a desktop stage (Ch02Craft), from the stage's top
const pin = HEIGHT * 1.55;
/**
 * Opens the page and mounts the object. Called again whenever the dev server reloads the page
 * under the run (a file saved elsewhere in the tree does that), since a reload drops the
 * handle, the pose and the style below.
 */
async function mount() {
  await page.goto(`${BASE}/?tier=HIGH`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__wjConcierge, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  top = await page.evaluate(() => document.querySelector('#ch02-craft')?.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, y + 2), top);
  await page.waitForSelector('[data-craft-scene][data-webgl="1"] canvas', { timeout: 90000 });
  if (!AT) await page.waitForFunction(() => !!window.__wjCraft, null, { timeout: 10000 });
  // only the object: the labels, the halo, the stills, the orb and the dev badge step out of the
  // frame — and every ground beneath the canvas goes transparent, so the capture carries the
  // object's own alpha and not the page's ink (an ink rectangle behind the object reads as a
  // faintly lighter box on the stage, since the canvas's tone mapping does not return the ink exactly)
  await page.addStyleTag({
    content:
      '.craft-label, .craft-note, .craft-eyebrow, .craft-halo, .craft-closing, .craft-poster, .craft-states, [data-orb], nextjs-portal, .wj-orb, [data-concierge-orb], header, footer, section:not(#ch02-craft), main > *:not(#ch02-craft):not(:has(#ch02-craft)) { visibility: hidden !important; opacity: 0 !important; } #ch02-craft .craft-stage-wrap > *:not(.craft-scene) { visibility: hidden !important; } html, body, #page-root, main, #ch02-craft, .pin-spacer, .craft-stage-wrap, .craft-scene, [data-chrome] { background: transparent !important; }',
  });
  await page.waitForTimeout(3000);
}
await mount();

// the canvas is found afresh for every capture (a dev server's hot reload replaces it) and cut
// from a page capture by its box, since an element capture waits for a "stable" element that a
// scrubbed pin keeps nudging
const shot = async () => {
  await page.waitForSelector('[data-craft-scene][data-webgl="1"] canvas', { timeout: 90000 });
  const clip = await page.evaluate(() => {
    const r = document.querySelector('[data-craft-scene] canvas').getBoundingClientRect();
    return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.round(r.width), height: Math.round(r.height) };
  });
  // SwiftShader on a busy machine can take the better part of a minute over one frame
  return page.screenshot({ type: 'png', omitBackground: true, clip, animations: 'allow', caret: 'initial', timeout: 180000 });
};
/** Two captures agree when no sampled byte differs by more than a shade. */
async function same(a, b) {
  const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer(), sharp(b).raw().toBuffer()]);
  if (ra.length !== rb.length) return false;
  let worst = 0;
  for (let i = 0; i < ra.length; i += 7) {
    const d = Math.abs(ra[i] - rb[i]);
    if (d > worst) worst = d;
    if (worst > 2) return false;
  }
  return true;
}

/** One state's capture, settled: the pose (or the scroll), then captures until two agree. */
async function capture(f) {
  if (AT) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(top + f.p * pin));
  } else {
    // the pose is read by the scene's frame loop; a nudge of the progress asks for the frame
    await page.evaluate((pose) => {
      window.__wjCraft.pose = pose;
      window.__wjCraft.value += 1e-6;
    }, f.pose);
  }
  // the scrub (0.6 s) and then the damped object: SwiftShader draws a frame in the better part
  // of a second, and the object needs some twenty of them to come to rest
  await page.waitForTimeout(3000);
  let prev = await shot();
  let still = 0;
  for (let k = 0; k < 80 && still < 2; k++) {
    await page.waitForTimeout(1500);
    const next = await shot();
    still = (await same(prev, next)) ? still + 1 : 0;
    prev = next;
  }
  return { png: prev, settled: still >= 2 };
}

const captures = [];
for (const f of STATES) {
  const t0 = Date.now();
  let result = null;
  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    try {
      result = await capture(f);
    } catch (err) {
      console.log(`${f.key}: ${String(err).split(String.fromCharCode(10))[0].slice(0, 120)} — the page was reloaded under the run; mounting again (${attempt + 1}/3)`);
      await mount();
    }
  }
  if (!result) throw new Error(`${f.key}: could not be captured`);
  const { png: prev, settled } = result;
  const info = await sharp(prev).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  const box = { left: -info.info.trimOffsetLeft, top: -info.info.trimOffsetTop, width: info.info.width, height: info.info.height };
  captures.push({ ...f, png: prev, box });
  if (val('out')) fs.writeFileSync(path.join(OUT, `raw-${f.key}.png`), prev);
  console.log(`${f.key} ${AT ? 'p=' + f.p : JSON.stringify(f.pose)} ${settled ? 'settled' : 'NOT settled'} box ${box.width}x${box.height}@${box.left},${box.top} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();

// one crop box for every layer: the union of the parts' extents, with a margin
const u = captures.reduce(
  (acc, c) => ({ l: Math.min(acc.l, c.box.left), t: Math.min(acc.t, c.box.top), r: Math.max(acc.r, c.box.left + c.box.width), b: Math.max(acc.b, c.box.top + c.box.height) }),
  { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity },
);
const m = Math.round(Math.max(u.r - u.l, u.b - u.t) * MARGIN);
const crop = { left: Math.max(0, u.l - m), top: Math.max(0, u.t - m), right: Math.min(WIDTH, u.r + m), bottom: Math.min(HEIGHT, u.b + m) };
// even numbers keep the resized widths' rounding identical across states
const W = (crop.right - crop.left) & ~1;
const H = (crop.bottom - crop.top) & ~1;
// where the assembled object's centre sits in the crop (the polished whole): the box is anchored by this point
const assembled = captures.find((c) => c.key === 'polished' || c.key === 'assembled') ?? captures[0];
const anchor = (assembled.box.top + assembled.box.height / 2 - crop.top) / H;
console.log(`union ${u.r - u.l}x${u.b - u.t}@${u.l},${u.t}; crop ${W}x${H}@${crop.left},${crop.top}; aspect ${(W / H).toFixed(4)}; anchor ${(anchor * 100).toFixed(1)}%`);

/**
 * Chromium's capture leaves the stage's ink at a few levels of alpha wherever the canvas is
 * clear (measured: rgba(11,10,9) at alpha 11 in every corner), which the page then paints as a
 * faintly lighter rectangle around the object. Anything that faint is ground, not object, and
 * goes fully transparent; the object's own anti-aliased edge is well above it.
 */
const GROUND_ALPHA = 16;
async function clearGround(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= GROUND_ALPHA) data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const written = [];
for (const c of captures) {
  const frame = await clearGround(await sharp(c.png).extract({ left: crop.left, top: crop.top, width: W, height: H }).png().toBuffer());
  for (const w of WIDTHS) {
    const file = path.join(OUT, `ring-${c.key}-${w}w.webp`);
    await sharp(frame).resize(Math.min(w, W)).webp({ quality: QUALITY, alphaQuality: ALPHA_QUALITY, effort: 6 }).toFile(file);
    written.push({ file, bytes: fs.statSync(file).size, w });
  }
}
for (const w of WIDTHS) {
  const set = written.filter((x) => x.w === w);
  console.log(`${w}w set: ${set.length} layers, ${(set.reduce((a, b) => a + b.bytes, 0) / 1024).toFixed(0)} KB total, ${set.map((x) => (x.bytes / 1024).toFixed(0)).join('/')} KB`);
}
// the record of the run (crop box, states): beside a probe set, else in .cache — never shipped
const manifest = val('out') ? path.join(OUT, 'frames.json') : path.resolve('.cache/craft-frames.json');
fs.mkdirSync(path.dirname(manifest), { recursive: true });
fs.writeFileSync(
  manifest,
  JSON.stringify({ width: W, height: H, aspect: +(W / H).toFixed(4), anchor: +anchor.toFixed(4), crop, quality: QUALITY, alphaQuality: ALPHA_QUALITY, states: captures.map((c) => ({ i: c.i, key: c.key, p: c.p, pose: c.pose, box: c.box })) }, null, 1),
);
console.log('layers →', OUT, `(${W}x${H}, aspect ${(W / H).toFixed(4)}, anchor ${(anchor * 100).toFixed(1)}%); set CRAFT_FRAME_SIZE in craftProgress.ts and --craft-frame-aspect / --craft-frame-anchor in craft.css if they changed`);
