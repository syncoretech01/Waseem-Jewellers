/**
 * Section registry. Every chapter / page section registers here; the current
 * section is the one whose rect contains the viewport centre-line (pinned
 * elements win because they are registered with `pinned: true`). It also
 * mirrors the active chapter's theme onto the chrome — every `[data-chrome]` wrapper in
 * Providers — so the nav, the orb, the salon and the cursor read as the chapter beneath them.
 *
 * The theme used to be written to <html>. A theme is a set of inherited custom properties,
 * and changing one on the root makes the browser propagate new values to every element in
 * the document — 65 ms of style recalculation on a 4,700-node page, at every chapter
 * boundary, inside the visitor's scroll. The chapters carry their own `data-theme`, so only
 * the fixed chrome ever needed the flip; written to its wrappers it costs a few hundred nodes.
 */
import { useSiteStore, type SectionId } from './siteStore';

export const SECTION_LABELS: Record<SectionId, string> = {
  loader: 'Waseem Jewellers',
  hero: 'Waseem Jewellers',
  vitrine: 'The Window',
  craft: 'The Craft',
  bangle: 'The Bangle',
  gate: 'Gold and Diamond',
  goldwork: 'Goldwork',
  light: 'One Suite, One Light',
  heritage: 'Since 1952',
  collections: 'Signature Collections',
  bridal: 'Bridal',
  gold: 'Gold',
  diamond: 'Diamond',
  menkids: 'Men and Kids',
  bespoke: 'Bespoke',
  footer: 'Visit Us',
  'collection-opening': 'Bridal',
  'collection-intro': 'Bridal',
  department: 'The Collection',
  pieces: 'The Pieces',
  gallery: 'The Piece',
  details: 'Details',
  related: 'Worn Together',
};

export type SectionTheme = 'dark' | 'ivory';

interface Entry {
  id: SectionId;
  el: HTMLElement;
  theme: SectionTheme;
  pinned: boolean;
  ready: boolean;
  /** The section's box in page coordinates, as the observer last measured it (coarse pointers). */
  top: number;
  height: number;
  measured: boolean;
}

const entries = new Map<HTMLElement, Entry>();
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
let raf = 0;
let currentTheme: SectionTheme = 'dark';

function writeChromeTheme(theme: SectionTheme) {
  document.querySelectorAll<HTMLElement>('[data-chrome]').forEach((el) => el.setAttribute('data-theme', theme));
}
let scrollBound = false;

/**
 * On a coarse pointer the registry never measures inside the scroll. The finger scrolls the
 * page natively, so every frame of a fling is the compositor's; the one thing that can still
 * stall it is the main thread being asked for layout in the scroll's own frame — which is what
 * a `getBoundingClientRect()` per section per scroll event was, after any tween had dirtied a
 * style. The observer already measures every section when it crosses a threshold; those boxes
 * are kept in page coordinates and the centre-line test runs against them with no read at all.
 * A layout change that moves a section without crossing a threshold — an accordion opening
 * above the rails — changes the page's height, and one ResizeObserver on the body remeasures
 * everything then, outside the scroll. Pinned chapters move with the viewport and keep the
 * live read; there are none on a product page.
 */
const coarse = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-coarse');

function measure(e: Entry) {
  const r = e.el.getBoundingClientRect();
  const y = window.scrollY;
  if (coarse) lastY = y;
  e.top = r.top + y;
  e.height = r.height;
  e.measured = true;
}

function onIntersect(records: IntersectionObserverEntry[]) {
  if (coarse) {
    // the observer's rectangles are viewport-relative at delivery, which is this frame's scroll
    lastY = window.scrollY;
    for (const r of records) {
      const e = entries.get(r.target as HTMLElement);
      if (!e) continue;
      e.top = r.boundingClientRect.top + lastY;
      e.height = r.boundingClientRect.height;
      e.measured = true;
    }
  }
  schedule();
}

function remeasureAll() {
  rootBottomCache = -1;
  viewportH = 0;
  for (const e of entries.values()) measure(e);
  schedule();
}

let readyResolve: (() => void) | null = null;
let readyPromise: Promise<void> = new Promise<void>((resolve) => {
  readyResolve = resolve;
});
let readyTimer: ReturnType<typeof setTimeout> | null = null;

function resetReady() {
  readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
}

function checkReady() {
  if (readyTimer) clearTimeout(readyTimer);
  readyTimer = setTimeout(() => {
    const all = [...entries.values()];
    if (all.length > 0 && all.every((e) => e.ready)) readyResolve?.();
  }, 80);
}

/** Resolves once every registered section has reported its structure (pins) ready. */
export function sectionsReady() {
  return readyPromise;
}

export function markSectionReady(el: HTMLElement) {
  const e = entries.get(el);
  if (e) {
    e.ready = true;
    checkReady();
  }
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(evaluate);
}

/**
 * The scroll position, taken in the scroll event itself on a coarse pointer. `scrollY` is a
 * layout-flushing read in Chromium; in the event it is already flushed by the listeners
 * before this one, whereas in the frame's rAF it would land after the tickers' writes and
 * force a second style pass. The observer's own callbacks carry no scroll, so they reuse it.
 */
let lastY = 0;
function onScroll() {
  if (coarse) lastY = window.scrollY;
  schedule();
}

/** Whether the viewport's centre-line (in page coordinates) falls inside the section. */
function holdsMid(e: Entry, mid: number, scrollY: number): boolean {
  if (coarse && !e.pinned) {
    if (!e.measured) measure(e);
    return e.top <= mid && e.top + e.height > mid;
  }
  const r = e.el.getBoundingClientRect();
  return r.top + scrollY <= mid && r.bottom + scrollY > mid;
}

/** The viewport's height, kept from the last resize on a coarse pointer: `innerHeight` is a layout read in Chromium. */
let viewportH = 0;
function viewportHeight(): number {
  if (!coarse) return window.innerHeight;
  if (!viewportH) viewportH = window.innerHeight;
  return viewportH;
}

/** The page's bottom edge in page coordinates: cached on a coarse pointer, read live elsewhere. */
let rootBottomCache = -1;
function rootBottom(scrollY: number): number {
  if (coarse && rootBottomCache >= 0) return rootBottomCache;
  const root = document.getElementById('page-root');
  const bottom = root ? root.getBoundingClientRect().bottom + scrollY : Infinity;
  if (coarse) rootBottomCache = bottom;
  return bottom;
}

function evaluate() {
  raf = 0;
  const scrollY = coarse ? lastY : window.scrollY;
  const mid = scrollY + viewportHeight() / 2;
  let best: Entry | null = null;
  for (const e of entries.values()) {
    if (holdsMid(e, mid, scrollY)) {
      if (!best || (e.pinned && !best.pinned)) best = e;
    }
  }
  if (!best) {
    // beneath the page: the fixed footer (ink) is what the visitor sees
    if (rootBottom(scrollY) <= mid) {
      useSiteStore.getState().setSection('footer');
      if (currentTheme !== 'dark') {
        currentTheme = 'dark';
        writeChromeTheme('dark');
      }
    }
    return;
  }
  useSiteStore.getState().setSection(best.id);
  if (best.theme !== currentTheme) {
    currentTheme = best.theme;
    writeChromeTheme(best.theme);
  }
}

export function registerSection(el: HTMLElement, id: SectionId, theme: SectionTheme, pinned = false) {
  if (entries.size === 0) resetReady();
  io ??= new IntersectionObserver(onIntersect, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  entries.set(el, { id, el, theme, pinned, ready: !pinned, top: 0, height: 0, measured: false });
  io.observe(el);
  el.setAttribute('data-section', id);
  if (!el.hasAttribute('data-theme')) el.setAttribute('data-theme', theme);
  // a section arriving changes the page's height: the cached boxes are measured again, once, outside the scroll
  rootBottomCache = -1;
  if (coarse && !ro && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(remeasureAll);
    ro.observe(document.body);
  }
  if (!scrollBound) {
    if (coarse) lastY = window.scrollY;
    window.addEventListener('scroll', onScroll, { passive: true });
    if (coarse) window.addEventListener('resize', remeasureAll);
    scrollBound = true;
  }
  schedule();
  checkReady();
  return () => {
    io?.unobserve(el);
    entries.delete(el);
    rootBottomCache = -1;
    if (entries.size === 0) {
      window.removeEventListener('scroll', onScroll);
      if (coarse) window.removeEventListener('resize', remeasureAll);
      scrollBound = false;
      io?.disconnect();
      io = null;
      ro?.disconnect();
      ro = null;
    }
  };
}

export function reevaluateSections() {
  schedule();
}

export function setChromeTheme(theme: SectionTheme) {
  currentTheme = theme;
  writeChromeTheme(theme);
}

export function sectionElement(id: SectionId): HTMLElement | null {
  for (const e of entries.values()) if (e.id === id) return e.el;
  return document.querySelector<HTMLElement>(`[data-section="${id}"]`);
}
