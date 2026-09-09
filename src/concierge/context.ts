import { getImage, getProduct } from '@/data';
import { formatPrice } from '@/lib/format';
import { useConciergeStore, type PieceCard } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import type { Product } from '@/data/types';
import type { ProductBrief, SiteContext } from './types';

export function briefOf(p: Product): ProductBrief {
  return {
    slug: p.slug,
    name: p.editorialTitle,
    house: p.house,
    category: p.category,
    material: p.material,
    priceLabel: formatPrice(p.price),
    image: getImage(p.media.hero).src,
  };
}

export function briefOfSlug(slug: string | null | undefined): ProductBrief | null {
  if (!slug) return null;
  const p = getProduct(slug);
  return p ? briefOf(p) : null;
}

export function cardsOf(products: Product[]): PieceCard[] {
  return products.map((p, i) => ({
    slug: p.slug,
    name: p.editorialTitle,
    collection: p.house ?? 'Waseem Jewellers',
    priceLabel: formatPrice(p.price),
    image: getImage(p.media.hero).src,
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
    wishlist: s.wishlist.map(briefOfSlug).filter((b): b is ProductBrief => Boolean(b)),
    recentResults: c.recentResults.map((r) => briefOfSlug(r.slug)).filter((b): b is ProductBrief => Boolean(b)),
    recentCollections: c.recentCollections.map((r) => r.slug),
    lastOpenedProduct: s.lastOpenedProduct,
    conciergeState: c.state,
    mode: c.mode,
    viewport: viewport(),
    localHour: new Date().getHours(),
  };
}
