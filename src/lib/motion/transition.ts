'use client';

import { gsap, ScrollTrigger } from './gsap';
import { runtime, scrollTo, startScroll, stopScroll, currentScroll, type FlipKey, type NavigateOptions, type TransitionHandle, markSettledArrival } from '@/state/runtime';
import { sectionsReady } from '@/state/sections';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';

/**
 * Once-only reveals whose trigger has already been reached (in view or above the viewport)
 * jump to their composed state instead of replaying beneath the lifting veil.
 */
export function settleReveals() {
  const pass = () => {
    for (const st of ScrollTrigger.getAll()) {
      if (!st.vars.once) continue;
      const reached = st.isActive || st.progress >= 1;
      if (!reached) continue;
      if (st.animation) st.animation.progress(1);
      else if (st.trigger instanceof HTMLElement && st.trigger.hasAttribute('data-rise')) gsap.set(st.trigger, { autoAlpha: 1, y: 0 });
    }
  };
  pass();
  requestAnimationFrame(pass);
}

export class SupersededError extends Error {
  constructor() {
    super('Superseded');
    this.name = 'Superseded';
  }
}

interface Elements {
  curtain: HTMLElement;
  veil: HTMLElement;
  flipLayer: HTMLElement;
}

const SCROLL_KEY = 'wj:scroll';

function readScrollMemory(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function rememberScroll(path: string, y: number) {
  try {
    const mem = readScrollMemory();
    mem[path] = y;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}

function hrefTarget(href: string) {
  const url = new URL(href, window.location.origin);
  return url.pathname + url.search;
}

function currentTarget() {
  return window.location.pathname + window.location.search;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The tick after the current frame — after GSAP's own root update, so a tween built then starts on a fresh clock. */
const nextTick = () => new Promise<void>((r) => gsap.ticker.add(() => r(), true));

/** Resolves when a tween completes — or, if it was killed, when it would have. */
const whenDone = (t: gsap.core.Tween) => Promise.race([t.then(), delay((t.duration() + t.delay()) * 1000 + 50)]).then(() => undefined);

/* ────────────────────────────────────────────────────────────────────────────────────────
 * Geometry. Every function here only reads; the flight writes transforms and nothing else.
 * ──────────────────────────────────────────────────────────────────────────────────────── */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const cut = (a: Box, b: Box): Box => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, btm - y) };
};

/** `inset(t r b l)` as Chrome computes it — px, or % of the element's own box; anything else is not a clip we can read. */
function insetBox(clipPath: string, box: Box): Box | null {
  const m = /^inset\(([^)]*)\)/.exec(clipPath);
  if (!m) return null;
  const parts = m[1]!.split(/\s+round\s+/)[0]!.trim().split(/\s+/).slice(0, 4);
  const sides: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const v = parseFloat(p);
    if (Number.isNaN(v)) return null;
    if (p.endsWith('%')) sides.push((v / 100) * (i % 2 === 0 ? box.h : box.w));
    else if (p.endsWith('px')) sides.push(v);
    else return null;
  }
  const t = sides[0] ?? 0;
  const r = sides[1] ?? t;
  const b = sides[2] ?? t;
  const l = sides[3] ?? r;
  return { x: box.x + l, y: box.y + t, w: box.w - l - r, h: box.h - t - b };
}

/** The part of an element a visitor can actually see: its box cut by every clipping ancestor. */
function visibleBox(el: Element): Box {
  let box = boxOf(el);
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') box = cut(box, boxOf(a));
    if (cs.clipPath && cs.clipPath !== 'none') {
      const inset = insetBox(cs.clipPath, boxOf(a));
      if (inset) box = cut(box, inset);
    }
  }
  return box;
}

function parsePosition(pos: string, freeX: number, freeY: number): [number, number] {
  const parts = pos.split(/\s+/);
  const one = (p: string | undefined, free: number) => {
    if (!p) return free / 2;
    const v = parseFloat(p);
    if (Number.isNaN(v)) return free / 2;
    return p.endsWith('%') ? (free * v) / 100 : v;
  };
  return [one(parts[0], freeX), one(parts[1], freeY)];
}

/** Where pixels of aspect `aw:ah` are drawn inside `box` under an object-fit rule. */
function fitBox(box: Box, aw: number, ah: number, fit: string, position: string): Box {
  if (!aw || !ah || box.w <= 0 || box.h <= 0) return box;
  let s: number;
  if (fit === 'contain') s = Math.min(box.w / aw, box.h / ah);
  else if (fit === 'cover') s = Math.max(box.w / aw, box.h / ah);
  else if (fit === 'none') s = 1;
  else if (fit === 'scale-down') s = Math.min(1, box.w / aw, box.h / ah);
  else return box;
  const w = aw * s;
  const h = ah * s;
  const [px, py] = parsePosition(position, box.w - w, box.h - h);
  return { x: box.x + px, y: box.y + py, w, h };
}

/** An image's pixel aspect: what has decoded, or what the markup promised. */
function aspectOf(img: HTMLImageElement): [number, number] {
  if (img.naturalWidth && img.naturalHeight) return [img.naturalWidth, img.naturalHeight];
  const w = Number(img.getAttribute('width'));
  const h = Number(img.getAttribute('height'));
  return w && h ? [w, h] : [0, 0];
}

/** The same photograph, whichever width the optimiser served it at. */
export function assetKey(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const inner = u.searchParams.get('url');
    if (u.pathname.startsWith('/_next/image') && inner) return assetKey(inner);
    return u.pathname.replace(/-\d+w(\.\w+)$/, '$1');
  } catch {
    return url;
  }
}

const TRANSPARENT = /^(transparent|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\))$/;

/** The plate an image sits on: the first painted background at or above it. */
function plateOf(img: Element): string {
  let a: Element | null = img;
  for (let i = 0; a && i < 6; i++, a = a.parentElement) {
    const c = getComputedStyle(a).backgroundColor;
    if (c && !TRANSPARENT.test(c)) return c;
  }
  return 'transparent';
}

function effectiveOpacity(el: Element, root: Element): number {
  let o = 1;
  for (let a: Element | null = el; a; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
    o *= parseFloat(cs.opacity) || 0;
    if (a === root) break;
  }
  return o;
}

interface Side {
  img: HTMLImageElement;
  /** The plate: what the visitor sees of the frame, cut by every clip above it. */
  box: Box;
  /** Where the photograph's pixels are drawn (may exceed the box when the fit is cover). */
  drawn: Box;
  aspect: [number, number];
  fit: string;
  position: string;
  plate: string;
  blend: string;
  key: string;
  src: string;
}

/**
 * The image a door is opened from. A figure (a moment or a semantic figure) is read as a whole:
 * the frame is its box, and the photograph is the topmost image the visitor can currently see
 * in it — the second angle after the ring has turned, the drawing before it has developed —
 * so the clone carries the pixels that were on screen, not the ones the markup names first.
 */
function measureSource(sourceEl: HTMLElement): (Side & { hide: HTMLImageElement[] }) | null {
  const frame = sourceEl.closest<HTMLElement>('[data-moment],[data-figure]');
  const root = frame ?? (sourceEl.tagName === 'IMG' ? (sourceEl.parentElement ?? sourceEl) : sourceEl);
  const imgs = [...root.querySelectorAll<HTMLImageElement>('img')];
  if (sourceEl.tagName === 'IMG' && !imgs.includes(sourceEl as HTMLImageElement)) imgs.unshift(sourceEl as HTMLImageElement);
  const loaded = imgs.filter((i) => i.currentSrc && i.naturalWidth > 0);
  let img: HTMLImageElement | null = null;
  for (const i of loaded) if (effectiveOpacity(i, root) >= 0.5) img = i;
  img ??= loaded.find((i) => i.hasAttribute('data-flip-source')) ?? loaded[0] ?? null;
  if (!img) return null;
  const box = visibleBox(frame ?? img);
  if (box.w < 8 || box.h < 8) return null;
  const cs = getComputedStyle(img);
  const aspect = aspectOf(img);
  const drawn = fitBox(boxOf(img), aspect[0], aspect[1], cs.objectFit, cs.objectPosition);
  return { img, box, drawn, aspect, fit: cs.objectFit, position: cs.objectPosition, plate: plateOf(img), blend: cs.mixBlendMode, key: assetKey(img.currentSrc), src: img.currentSrc, hide: imgs };
}

/** The destination frame, measured once the page has laid out: its plate, and where its own photograph will be drawn. */
function measureTarget(el: HTMLElement): Side | null {
  const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null;
  if (!img) return null;
  const box = visibleBox(el);
  if (box.w < 8 || box.h < 8) return null;
  const cs = getComputedStyle(img);
  const aspect = aspectOf(img);
  const src = img.currentSrc || img.src;
  const drawn = fitBox(boxOf(img), aspect[0], aspect[1], cs.objectFit, cs.objectPosition);
  return { img, box, drawn, aspect, fit: cs.objectFit, position: cs.objectPosition, plate: plateOf(img), blend: cs.mixBlendMode, key: assetKey(src), src };
}

/**
 * A door with no image of its own still flies when the piece is on screen: the largest
 * visible `img[data-flip-source]` for the slug, or nothing, in which case the curtain does.
 */
export function findFlipSource(slug: string): HTMLImageElement | null {
  if (typeof document === 'undefined') return null;
  const viewport: Box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  let best: HTMLImageElement | null = null;
  let bestArea = 0;
  for (const img of document.querySelectorAll<HTMLImageElement>(`img[data-flip-source="${CSS.escape(slug)}"]`)) {
    if (!img.currentSrc || !img.naturalWidth) continue;
    const r = boxOf(img);
    const seen = cut(r, viewport);
    const area = seen.w * seen.h;
    if (area < 48 * 48 || area < 0.4 * r.w * r.h) continue;
    if (area > bestArea) {
      best = img;
      bestArea = area;
    }
  }
  return best;
}

function cssPx(name: string, fallback: number) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isNaN(v) ? fallback : v;
}

/**
 * Where the clone flies before the destination exists. Each destination sizes its frame by
 * rules the layout owns — the collection opening's mask, the product page's single column
 * for a cut-out and its 62/38 split for a scene — and these are those rules, from the
 * viewport alone. `ready()` absorbs whatever delta remains against the measured element.
 */
function predictFrame(key: FlipKey, source: Side, frames: number | null): { box: Box; imgBox: Box; fit: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 768;
  if (key === 'collection-hero') {
    const box = mobile ? { x: vw * 0.11, y: vh * 0.15, w: vw * 0.78, h: vh * 0.7 } : { x: vw * 0.19, y: vh * 0.09, w: vw * 0.62, h: vh * 0.82 };
    return { box, imgBox: { x: 0, y: 0, w: vw, h: vh }, fit: 'cover' };
  }
  const navH = cssPx('--nav-h', 72);
  const gutter = Math.min(72, Math.max(20, vw * 0.04));
  // a cut-out is mounted on a 5:4 plate at real margin; a scene fills a 4:5 frame
  const mounted = source.fit === 'contain';
  if (mobile) {
    // the single hero spans the gutters; a track's first slide leaves the next one peeking;
    // both sit beneath the back link, which stands in the header clearance
    const w = frames !== null && frames > 1 ? vw - gutter - 40 : vw - gutter * 2;
    const box = { x: gutter, y: navH + 68, w, h: w * 1.25 };
    return { box, imgBox: box, fit: mounted ? 'contain' : 'cover' };
  }
  /**
   * Which column: a localised photograph belongs to an authored piece, which has a gallery
   * and opens in the 62/38 split; the long tail from the shop's CDN has one photograph and
   * opens in the single centred column — unless the door says how many frames the piece has
   * (`data-flip-frames` on the link or its plate), in which case two or three cut-outs open
   * as the studio pair, two abreast in the split. Without that hint the pair is the one
   * layout this cannot foresee; the glide absorbs it.
   */
  const local = isLocal(source.src);
  const split = local || (frames !== null && frames > 1);
  const column = split ? (vw - gutter * 3) * (vw >= 1280 ? 0.62 : 0.55) : Math.min(vw, 1024) - gutter * 2;
  const studio = !local && frames !== null && frames > 1 && mounted;
  const w = studio ? (column - 24) / 2 : column;
  const x = split ? gutter : (vw - Math.min(vw, 1024)) / 2 + gutter;
  const box = { x, y: navH + 32, w, h: Math.min(mounted ? w * 0.8 : w * 1.25, vh) };
  if (mounted) return { box, imgBox: { x: box.x + box.w * 0.18, y: box.y + box.h * 0.09, w: box.w * 0.64, h: box.h * 0.82 }, fit: 'contain' };
  return { box, imgBox: box, fit: 'cover' };
}

function isLocal(src: string) {
  try {
    return new URL(src, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────────────────────────────
 * The clone. One fixed, clipped plate carrying one or two photographs; every frame writes
 * three transform strings and nothing that lays out.
 * ──────────────────────────────────────────────────────────────────────────────────────── */

interface CloneState {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  ix: number;
  iy: number;
  iw: number;
  ih: number;
  jx: number;
  jy: number;
  jw: number;
  jh: number;
}

interface Clone {
  outer: HTMLDivElement;
  primary: HTMLImageElement;
  second: HTMLImageElement | null;
  state: CloneState;
  base: { w: number; h: number; iw: number; ih: number; jw: number; jh: number };
  source: Side & { hide: HTMLImageElement[] };
  write: () => void;
}

const px = (n: number) => `${n.toFixed(2)}px`;

/**
 * Cover, flight and landing. The clone flies toward the predicted frame over FLIGHT; when the
 * destination reports, the rest of that time — never less than GLIDE_MIN — becomes the glide
 * onto the measured frame, so a fast destination lands in ≈ FLIGHT and a slow one parks at
 * the prediction and settles in GLIDE_MIN once it arrives. The moving time is bounded by
 * FLIGHT + GLIDE_MIN.
 */
const VEIL_IN = 0.3;
const PUSH_AT = 0.16;
const FLIGHT = 0.5;
const GLIDE_MIN = 0.2;
const GLIDE_MAX = 0.36;
const VEIL_OUT = 0.45;
const CLONE_FADE = 0.14;
const DECODE_CAP = 700;

/**
 * Curtain + FLIP route transitions. One in-flight navigation at a time; a second
 * `navigate()` supersedes the first (its `whenReady()` rejects). `ready()` is a no-op
 * unless the location matches the in-flight target.
 */
export class TransitionController implements TransitionHandle {
  inFlight: { href: string; kind: string; flipKey?: FlipKey; epoch: number; target: string; readied?: boolean; startedAt: number } | null = null;
  private epoch = 0;
  private els: Elements | null = null;
  private clone: Clone | null = null;
  private hiddenTarget: HTMLImageElement | null = null;
  private tl: gsap.core.Timeline | null = null;
  private forced: number | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  /** Resolves the cover phase of navigate() even when its timeline is killed. */
  private coverResolve: (() => void) | null = null;
  private popPending = false;

  attach(els: Elements) {
    this.els = els;
    window.addEventListener('popstate', this.onPop);
  }

  detach() {
    window.removeEventListener('popstate', this.onPop);
    this.els = null;
  }

  private onPop = () => {
    this.popPending = true;
  };

  private reduced() {
    return useQualityStore.getState().tier === 'REDUCED';
  }

  whenReady() {
    return this.readyPromise;
  }

  async navigate(href: string, opts: NavigateOptions = {}) {
    if (!this.els) {
      runtime.router?.push(href, { scroll: false });
      return;
    }
    const target = hrefTarget(href);
    if (target === currentTarget() && !this.inFlight) {
      runtime.router?.push(href, { scroll: false });
      return;
    }
    this.supersede();
    this.epoch += 1;
    const epoch = this.epoch;
    // the flight is transform-only, so every tier but REDUCED flies; REDUCED gets the plain veil
    const kind = this.reduced() ? 'veil' : opts.kind === 'flip' && opts.sourceEl ? 'flip' : (opts.kind ?? 'curtain');
    this.inFlight = { href, kind, flipKey: opts.flipKey, epoch, target, startedAt: performance.now() };
    const samePage = new URL(href, window.location.origin).pathname === window.location.pathname;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.readyPromise.catch(() => undefined);

    // the payload can start on its way before the cover is up and the push is made
    runtime.router?.prefetch(href);
    rememberScroll(currentTarget(), currentScroll());
    stopScroll();
    /**
     * Lag smoothing is off for Lenis. The route commit is a long frame — hundreds of
     * milliseconds of hydration and first paint — and a tween running through it would
     * inherit that whole stretch on its next tick and jump to its end: the glide would be a
     * cut. Scrolling is frozen for the whole transition, so smoothing is safe until settle.
     */
    gsap.ticker.lagSmoothing(120, 33);
    document.documentElement.classList.add('is-transitioning');
    document.getElementById('page-root')?.setAttribute('inert', '');
    useSiteStore.getState().closeMenu();

    const { curtain, veil, flipLayer } = this.els;
    // an arrival still fading (a plain one, or the previous flight's) would otherwise fight the cover
    gsap.killTweensOf(veil);
    gsap.killTweensOf(curtain);
    const push = () => {
      if (this.epoch !== epoch) return;
      runtime.router?.push(href, { scroll: false });
    };

    this.tl?.kill();
    const tl = gsap.timeline();
    this.tl = tl;

    if (kind === 'flip' && opts.sourceEl && opts.flipKey) {
      const clone = this.buildClone(opts.sourceEl, opts.flipKey, flipLayer);
      if (clone) {
        this.clone = clone;
        gsap.set(veil, { opacity: 0, pointerEvents: 'auto' });
        tl.to(veil, { opacity: 1, duration: VEIL_IN, ease: 'power2.out' }, 0).call(push, [], PUSH_AT);
      } else {
        this.inFlight.kind = 'curtain';
      }
    }

    if (this.inFlight.kind === 'curtain') {
      gsap.set(curtain, { yPercent: 100, pointerEvents: 'auto', visibility: 'visible' });
      tl.to(curtain, { yPercent: 0, duration: 0.7, ease: 'wj.inOut' }, 0).call(push, [], 0.35);
    } else if (this.inFlight.kind === 'veil') {
      gsap.set(veil, { opacity: 0, pointerEvents: 'auto' });
      tl.to(veil, { opacity: 1, duration: 0.35, ease: 'none' }, 0).call(push, [], 0.2);
    }

    if (samePage) {
      // same route, new query: no destination remounts, so arrive on the push
      tl.call(
        () => {
          if (this.epoch === epoch) this.ready(this.inFlight?.flipKey, null, true);
        },
        [],
        this.inFlight.kind === 'curtain' ? 0.55 : 0.35,
      );
    }

    this.forced = window.setTimeout(() => {
      // last resort: release the page even if the URL never matched the target
      if (this.epoch === epoch && this.inFlight) this.ready(this.inFlight.flipKey, null, true);
    }, 4000);

    await new Promise<void>((resolve) => {
      this.coverResolve = resolve;
      tl.eventCallback('onComplete', () => {
        this.coverResolve = null;
        resolve();
      });
    });
  }

  /**
   * Measures the source once, builds the plate and its photograph in the flip layer at the
   * exact pixels the visitor sees, hides the frame it came from, and sends it toward the
   * predicted destination. Returns null when there is nothing decoded to fly.
   */
  private buildClone(sourceEl: HTMLElement, key: FlipKey, layer: HTMLElement): Clone | null {
    const source = measureSource(sourceEl);
    if (!source) return null;
    const hint = Number(sourceEl.closest('[data-flip-frames]')?.getAttribute('data-flip-frames'));
    const predicted = predictFrame(key, source, hint > 0 ? hint : null);
    const land = fitBox(predicted.imgBox, source.aspect[0], source.aspect[1], predicted.fit, '50% 50%');

    // rasterise at the larger of the two ends, so the flight only ever scales the layer down
    const base = {
      w: Math.max(source.box.w, predicted.box.w),
      h: Math.max(source.box.h, predicted.box.h),
      iw: Math.max(source.drawn.w, land.w),
      ih: Math.max(source.drawn.h, land.h),
      jw: 1,
      jh: 1,
    };
    const plate = source.plate === 'transparent' ? 'transparent' : source.plate;
    const outer = document.createElement('div');
    outer.setAttribute('data-flip-clone', key);
    outer.setAttribute('aria-hidden', 'true');
    Object.assign(outer.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: px(base.w),
      height: px(base.h),
      overflow: 'hidden',
      transformOrigin: '0 0',
      willChange: 'transform',
      pointerEvents: 'none',
      backgroundColor: plate,
      isolation: 'isolate',
    } as CSSStyleDeclaration);
    const primary = document.createElement('img');
    primary.src = source.src;
    primary.alt = '';
    primary.setAttribute('data-flip-clone-img', 'source');
    primary.draggable = false;
    Object.assign(primary.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: px(base.iw),
      height: px(base.ih),
      maxWidth: 'none',
      transformOrigin: '0 0',
      willChange: 'transform',
      // a multiplied cut-out needs a plate beneath it; without one it would multiply into the veil
      mixBlendMode: plate === 'transparent' ? 'normal' : source.blend,
    } as CSSStyleDeclaration);
    outer.appendChild(primary);

    const state: CloneState = {
      bx: source.box.x,
      by: source.box.y,
      bw: source.box.w,
      bh: source.box.h,
      ix: source.drawn.x,
      iy: source.drawn.y,
      iw: source.drawn.w,
      ih: source.drawn.h,
      jx: source.drawn.x,
      jy: source.drawn.y,
      jw: source.drawn.w,
      jh: source.drawn.h,
    };
    const clone: Clone = {
      outer,
      primary,
      second: null,
      state,
      base,
      source,
      write: () => {
        const s = clone.state;
        const sx = s.bw / clone.base.w;
        const sy = s.bh / clone.base.h;
        outer.style.transform = `translate3d(${px(s.bx)}, ${px(s.by)}, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
        primary.style.transform = `translate3d(${px((s.ix - s.bx) / sx)}, ${px((s.iy - s.by) / sy)}, 0) scale(${(s.iw / clone.base.iw / sx).toFixed(5)}, ${(s.ih / clone.base.ih / sy).toFixed(5)})`;
        if (clone.second) clone.second.style.transform = `translate3d(${px((s.jx - s.bx) / sx)}, ${px((s.jy - s.by) / sy)}, 0) scale(${(s.jw / clone.base.jw / sx).toFixed(5)}, ${(s.jh / clone.base.jh / sy).toFixed(5)})`;
      },
    };
    clone.write();
    layer.appendChild(outer);
    for (const img of source.hide) img.style.visibility = 'hidden';

    gsap.to(state, {
      bx: predicted.box.x,
      by: predicted.box.y,
      bw: predicted.box.w,
      bh: predicted.box.h,
      ix: land.x,
      iy: land.y,
      iw: land.w,
      ih: land.h,
      duration: FLIGHT,
      ease: 'power2.inOut',
      overwrite: true,
      onUpdate: clone.write,
    });
    return clone;
  }

  private supersede() {
    if (!this.inFlight) return;
    this.tl?.kill();
    this.coverResolve?.();
    this.coverResolve = null;
    if (this.forced) window.clearTimeout(this.forced);
    this.readyReject?.(new SupersededError());
    this.cleanupClone(true);
    if (this.els) {
      // the reveal half runs outside the timeline; a lifting veil must not keep lifting under the next cover
      gsap.killTweensOf(this.els.veil);
      gsap.killTweensOf(this.els.curtain);
      if (this.inFlight.kind === 'curtain') gsap.set(this.els.curtain, { yPercent: 0 });
      else gsap.set(this.els.veil, { opacity: 1 });
    }
    this.inFlight = null;
  }

  private cleanupClone(restoreSource: boolean) {
    const c = this.clone;
    if (c) {
      gsap.killTweensOf(c.state);
      gsap.killTweensOf(c.outer);
      if (c.second) gsap.killTweensOf(c.second);
      if (restoreSource) for (const img of c.source.hide) img.style.visibility = '';
      c.outer.remove();
    }
    this.clone = null;
    if (this.hiddenTarget) this.hiddenTarget.style.visibility = '';
    this.hiddenTarget = null;
  }

  /** Called by the destination once it has mounted and laid out its frame. */
  ready(flipKey?: FlipKey, targetEl?: HTMLElement | null, force = false) {
    const flight = this.inFlight;
    if (!flight || !this.els) return;
    if (!force && currentTarget() !== flight.target) return;
    // only the first report counts: a later one (an image decoding after the fallback) must not reset the arrival
    if (flight.readied) return;
    flight.readied = true;
    if (this.forced) window.clearTimeout(this.forced);
    this.forced = null;
    const epoch = flight.epoch;
    const { curtain, veil } = this.els;

    void (async () => {
      await Promise.race([sectionsReady(), delay(flight.kind === 'flip' ? 600 : 1200)]);
      if (this.epoch !== epoch) return;
      const saved = this.popPending ? readScrollMemory()[flight.target] : undefined;
      this.popPending = false;
      if ((saved ?? 0) > 0) markSettledArrival();
      scrollTo(saved ?? 0, { immediate: true });
      ScrollTrigger.refresh();
      if ((saved ?? 0) > 0) settleReveals();

      const settle = () => {
        if (this.epoch !== epoch) return;
        gsap.ticker.lagSmoothing(0);
        document.documentElement.classList.remove('is-transitioning');
        document.getElementById('page-root')?.removeAttribute('inert');
        gsap.set(curtain, { pointerEvents: 'none', visibility: 'hidden' });
        gsap.set(veil, { pointerEvents: 'none' });
        this.inFlight = null;
        this.readyResolve?.();
      };

      if (flight.kind === 'flip' && this.clone) {
        await this.land(this.clone, targetEl ?? null, veil, epoch);
        settle();
        return;
      }

      const tl = gsap.timeline({ onComplete: settle });
      this.tl = tl;
      if (flight.kind === 'flip') {
        // the clone was lost to a supersede that never completed; lift the veil plainly
        tl.to(veil, { opacity: 0, duration: VEIL_OUT, ease: 'power2.inOut' }, 0.05).call(startScroll, [], 0.25);
      } else if (flight.kind === 'curtain') {
        tl.to(curtain, { yPercent: -100, duration: 0.8, ease: 'wj.inOut' }, 0.05).call(startScroll, [], 0.5);
      } else {
        tl.to(veil, { opacity: 0, duration: 0.45, ease: 'none' }, 0.05).call(startScroll, [], 0.25);
      }
    })();
  }

  /**
   * The landing. The destination is measured once; the clone's plate glides to it and its
   * photograph to where the destination draws its own. When that is a different photograph,
   * the destination's is crossfaded in over the glide — the last part of the flight — so the
   * hand-over is a dissolve and not a cut. Then the destination's image is shown and the
   * clone fades from over it. The veil lifts as the glide begins, so the page arrives around
   * the settling image.
   */
  private async land(clone: Clone, targetEl: HTMLElement | null, veil: HTMLElement, epoch: number) {
    // the destination has just committed: let its first frame paint before the glide is built on it
    await nextTick();
    if (this.epoch !== epoch) return;
    const flight = this.inFlight;
    const target = targetEl ? measureTarget(targetEl) : null;
    const elapsed = flight ? (performance.now() - flight.startedAt) / 1000 : FLIGHT;
    const glide = Math.min(GLIDE_MAX, Math.max(GLIDE_MIN, FLIGHT - elapsed));
    const s = clone.state;

    const veilOut = gsap.to(veil, { opacity: 0, duration: VEIL_OUT, ease: 'power2.inOut', overwrite: true });
    window.setTimeout(() => {
      if (this.epoch === epoch) startScroll();
    }, glide * 500);

    if (!target) {
      // nothing to land on: the clone fades where it is while the page appears beneath
      gsap.killTweensOf(s);
      await new Promise<void>((r) => gsap.to(clone.outer, { opacity: 0, duration: 0.3, ease: 'none', onComplete: r }));
      if (this.epoch !== epoch) return;
      this.cleanupClone(false);
      await whenDone(veilOut);
      return;
    }

    this.hiddenTarget = target.img;
    const cross = target.key !== clone.source.key;
    const landPrimary = fitBox(boxOf(target.img), clone.source.aspect[0], clone.source.aspect[1], target.fit, target.position);

    if (cross) {
      const second = document.createElement('img');
      second.src = target.src;
      second.alt = '';
      second.setAttribute('data-flip-clone-img', 'target');
      second.draggable = false;
      clone.base.jw = Math.max(target.drawn.w, s.jw);
      clone.base.jh = Math.max(target.drawn.h, s.jh);
      Object.assign(second.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: px(clone.base.jw),
        height: px(clone.base.jh),
        maxWidth: 'none',
        transformOrigin: '0 0',
        willChange: 'transform, opacity',
        opacity: '0',
        mixBlendMode: target.plate === 'transparent' ? 'normal' : target.blend,
      } as CSSStyleDeclaration);
      clone.outer.appendChild(second);
      clone.second = second;
      // the incoming photograph starts where the outgoing one is, so the dissolve is between two images in one place
      s.jx = s.ix;
      s.jy = s.iy;
      s.jw = s.iw;
      s.jh = s.ih;
    }

    const decoded = Promise.race([
      (clone.second ? clone.second.decode() : Promise.resolve()).catch(() => undefined),
      (target.img.complete && target.img.naturalWidth ? Promise.resolve() : target.img.decode()).catch(() => undefined),
      delay(DECODE_CAP),
    ]);

    // one tween carries every dimension: two overwriting tweens on one object would kill each other
    const glided = new Promise<void>((resolve) => {
      gsap.to(s, {
        bx: target.box.x,
        by: target.box.y,
        bw: target.box.w,
        bh: target.box.h,
        ix: landPrimary.x,
        iy: landPrimary.y,
        iw: landPrimary.w,
        ih: landPrimary.h,
        jx: target.drawn.x,
        jy: target.drawn.y,
        jw: target.drawn.w,
        jh: target.drawn.h,
        duration: glide,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: clone.write,
        onComplete: resolve,
      });
    });
    if (target.plate !== clone.source.plate && target.plate !== 'transparent') gsap.to(clone.outer, { backgroundColor: target.plate, duration: glide, ease: 'none' });
    if (clone.second) {
      const second = clone.second;
      void decoded.then(() => {
        if (this.epoch !== epoch || this.clone !== clone) return;
        gsap.to(second, { opacity: 1, duration: glide, ease: 'power1.inOut' });
      });
    }

    await Promise.all([glided, decoded]);
    if (this.epoch !== epoch) return;
    if (clone.second && parseFloat(clone.second.style.opacity) < 1) {
      // the destination's photograph arrived after the glide: finish the dissolve in place
      await new Promise<void>((r) => gsap.to(clone.second, { opacity: 1, duration: 0.2, ease: 'power1.inOut', overwrite: true, onComplete: r }));
      if (this.epoch !== epoch) return;
    }
    target.img.style.visibility = '';
    this.hiddenTarget = null;
    await new Promise<void>((r) => gsap.to(clone.outer, { opacity: 0, duration: CLONE_FADE, ease: 'none', onComplete: r }));
    if (this.epoch !== epoch) return;
    this.cleanupClone(false);
    await whenDone(veilOut);
  }

  /** A route change that did not go through navigate() (back/forward, external). Reveal half only. */
  arrivePlain(pathname: string) {
    if (this.inFlight || !this.els) return;
    const { veil } = this.els;
    const saved = this.popPending ? readScrollMemory()[pathname + window.location.search] : undefined;
    this.popPending = false;
    gsap.set(veil, { opacity: 1, pointerEvents: 'none' });
    void (async () => {
      await Promise.race([sectionsReady(), delay(1000)]);
      if ((saved ?? 0) > 0) markSettledArrival();
      scrollTo(saved ?? 0, { immediate: true });
      ScrollTrigger.refresh();
      if ((saved ?? 0) > 0) settleReveals();
      gsap.to(veil, { opacity: 0, duration: 0.45, ease: 'none', delay: 0.05 });
    })();
  }
}
