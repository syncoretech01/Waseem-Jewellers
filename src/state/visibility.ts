/**
 * Product visibility registry: one shared IntersectionObserver, rAF-batched
 * publishing in reading order (top → bottom, then left → right), so
 * "open the second one" refers to what the visitor can actually see.
 */
import { useSiteStore } from './siteStore';

const entries = new Map<Element, { slug: string; ratio: number }>();
let io: IntersectionObserver | null = null;
let raf = 0;
let overrideList: string[] | null = null;

function onChange(records: IntersectionObserverEntry[]) {
  for (const r of records) {
    const e = entries.get(r.target);
    if (e) e.ratio = r.intersectionRatio;
  }
  schedule();
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(publish);
}

function publish() {
  raf = 0;
  if (overrideList) {
    useSiteStore.getState().setVisibleProducts(overrideList);
    return;
  }
  const visible = [...entries]
    .filter(([, e]) => e.ratio >= 0.2)
    .map(([el, e]) => {
      const r = el.getBoundingClientRect();
      return { slug: e.slug, top: r.top, left: r.left };
    })
    .sort((a, b) => (Math.abs(a.top - b.top) < 48 ? a.left - b.left : a.top - b.top))
    .map((e) => e.slug);
  const unique = visible.filter((s, i) => visible.indexOf(s) === i).slice(0, 12);
  useSiteStore.getState().setVisibleProducts(unique);
}

export function observeProduct(el: Element, slug: string) {
  io ??= new IntersectionObserver(onChange, { threshold: [0, 0.2, 0.5, 0.8] });
  entries.set(el, { slug, ratio: 0 });
  io.observe(el);
  return () => {
    io?.unobserve(el);
    entries.delete(el);
    schedule();
  };
}

/** A chapter that owns the viewport (the spatial slider) publishes its own order. */
export function overrideVisibleProducts(list: string[] | null) {
  overrideList = list;
  schedule();
}

export function productElement(slug: string): HTMLElement | null {
  for (const [el, e] of entries) if (e.slug === slug && el instanceof HTMLElement) return el;
  return document.querySelector<HTMLElement>(`[data-product="${slug}"]`);
}
