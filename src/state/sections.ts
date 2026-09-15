/**
 * Section registry. Every chapter / page section registers here; the current
 * section is the one whose rect contains the viewport centre-line (pinned
 * elements win because they are registered with `pinned: true`). It also
 * mirrors the active chapter's theme onto <html data-theme> for the chrome.
 */
import { useSiteStore, type SectionId } from './siteStore';

export const SECTION_LABELS: Record<SectionId, string> = {
  loader: 'Waseem Jewellers',
  hero: 'Waseem Jewellers',
  vitrine: 'In the Vitrine',
  craft: 'The Craft',
  heritage: 'Since 1952',
  collections: 'Signature Collections',
  bridal: 'Bridal',
  'bridal-close': 'Bridal',
  wall: 'The Pieces',
  slider: 'The Collection',
  duality: 'The Bridal Edits',
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
}

const entries = new Map<HTMLElement, Entry>();
let io: IntersectionObserver | null = null;
let raf = 0;
let currentTheme: SectionTheme = 'dark';
let scrollBound = false;

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

function evaluate() {
  raf = 0;
  const mid = window.innerHeight / 2;
  let best: Entry | null = null;
  for (const e of entries.values()) {
    const r = e.el.getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid) {
      if (!best || (e.pinned && !best.pinned)) best = e;
    }
  }
  if (!best) {
    // beneath the page: the fixed footer (ink) is what the visitor sees
    const root = document.getElementById('page-root');
    if (root && root.getBoundingClientRect().bottom <= mid) {
      useSiteStore.getState().setSection('footer');
      if (currentTheme !== 'dark') {
        currentTheme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
    return;
  }
  useSiteStore.getState().setSection(best.id);
  if (best.theme !== currentTheme) {
    currentTheme = best.theme;
    document.documentElement.setAttribute('data-theme', best.theme);
  }
}

export function registerSection(el: HTMLElement, id: SectionId, theme: SectionTheme, pinned = false) {
  if (entries.size === 0) resetReady();
  io ??= new IntersectionObserver(schedule, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  entries.set(el, { id, el, theme, pinned, ready: !pinned });
  io.observe(el);
  el.setAttribute('data-section', id);
  if (!el.hasAttribute('data-theme')) el.setAttribute('data-theme', theme);
  if (!scrollBound) {
    window.addEventListener('scroll', schedule, { passive: true });
    scrollBound = true;
  }
  schedule();
  checkReady();
  return () => {
    io?.unobserve(el);
    entries.delete(el);
    if (entries.size === 0) {
      window.removeEventListener('scroll', schedule);
      scrollBound = false;
      io?.disconnect();
      io = null;
    }
  };
}

export function reevaluateSections() {
  schedule();
}

export function setChromeTheme(theme: SectionTheme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
}

export function sectionElement(id: SectionId): HTMLElement | null {
  for (const e of entries.values()) if (e.id === id) return e.el;
  return document.querySelector<HTMLElement>(`[data-section="${id}"]`);
}
