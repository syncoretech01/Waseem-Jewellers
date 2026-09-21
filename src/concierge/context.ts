import { getRow, priceLabelOf, refOf } from '@/data/clientIndex';
import { useConciergeStore, type PieceCard } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import type { PieceRow } from '@/lib/facets';
import type { ProductBrief, SiteContext } from './types';

/**
 * Everything the concierge knows about a piece comes from the client index — rows, not
 * products. The full catalogue is a megabyte and belongs to the server; the browser gets a
 * hundred bytes a piece, fetched once when the concierge opens.
 */
export function briefOf(r: PieceRow): ProductBrief {
  return {
    slug: r.s,
    name: r.t,
    house: r.cp,
    category: r.c ?? 'jewellery',
    material: r.m ?? 'gold',
    priceLabel: priceLabelOf(r),
    image: refOf(r),
  };
}

export function briefOfSlug(slug: string | null | undefined): ProductBrief | null {
  if (!slug) return null;
  const r = getRow(slug);
  return r ? briefOf(r) : null;
}

export function cardsOf(rows: PieceRow[]): PieceCard[] {
  return rows.map((r, i) => ({
    slug: r.s,
    name: r.t,
    collection: r.cp ?? 'Waseem Jewellers',
    priceLabel: priceLabelOf(r),
    // the reference, so the card renders through the optimiser rather than the original
    image: refOf(r),
    ordinal: i + 1,
  }));
}

function viewport(): SiteContext['viewport'] {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1280 ? 'tablet' : 'desktop';
}

/** The front-end truth the concierge (mock or model) reasons over. */
export function buildSiteContext(): SiteContext {
  const s = useSiteStore.getState();
  const c = useConciergeStore.getState();
  return {
    route: s.route,
    routeKind: s.routeKind,
    section: s.section,
    currentProduct: briefOfSlug(s.currentProduct),
    focusedProduct: briefOfSlug(s.focusedProduct),
    visibleProducts: s.visibleProducts.map(briefOfSlug).filter((b): b is ProductBrief => Boolean(b)),
    selectedCollection: s.selectedCollection,
    selectedWorld: s.selectedWorld,
    recentResults: c.recentResults.map((r) => briefOfSlug(r.slug)).filter((b): b is ProductBrief => Boolean(b)),
    recentCollections: c.recentCollections.map((r) => r.slug),
    lastOpenedProduct: s.lastOpenedProduct,
    conciergeState: c.state,
    mode: c.mode,
    viewport: viewport(),
    localHour: new Date().getHours(),
    gallery: s.gallery && s.gallery.slug === s.currentProduct ? { count: s.gallery.count, index: s.gallery.index } : null,
    gate: s.gate,
    highlightedCategory: s.highlightedCategory,
    menuOpen: s.menuOpen,
    appointmentOpen: s.consultation.open,
  };
}
