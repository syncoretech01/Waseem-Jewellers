'use client';

import { getProduct, productsBySlugs, WORLDS, WORLD_BY_SLUG, getCollection, getImage } from '@/data';
import { searchCatalogue, similarTo } from '@/data/search';
import { SECTION_LABELS, sectionElement } from '@/state/sections';
import { productElement } from '@/state/visibility';
import { runtime, scrollTo } from '@/state/runtime';
import { useSiteStore, type SectionId } from '@/state/siteStore';
import { useConciergeStore, type CollectionCard } from '@/state/conciergeStore';
import { countInWords, capitalise } from '@/lib/format';
import { buildSiteContext, cardsOf } from '../context';
import { CONCIERGE } from '../copy';
import type { SiteContext, ToolName, ToolOutcome } from '../types';
import type { Product } from '@/data/types';

const COLLECTION_ROUTE = '/collections/bridal';

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function navigate(href: string, kind: 'curtain' | 'flip' = 'curtain', sourceEl?: HTMLElement | null) {
  const t = runtime.transition;
  if (t) return t.navigate(href, kind === 'flip' ? { kind, sourceEl, flipKey: 'product-hero' } : { kind });
  runtime.router?.push(href, { scroll: false });
  return Promise.resolve();
}

function resolveAnchor(args: Record<string, unknown>, ctx: SiteContext): Product | undefined {
  const explicit = str(args.slug);
  const slug = explicit ?? ctx.currentProduct?.slug ?? ctx.focusedProduct?.slug ?? ctx.recentResults[0]?.slug ?? undefined;
  return slug ? getProduct(slug) : undefined;
}

function worldCards(): CollectionCard[] {
  return WORLDS.map((w, i) => ({ slug: w.slug, name: w.name, image: getImage(w.imagery.hero).src, href: w.href, ordinal: i + 1 }));
}

function describeQuery(args: Record<string, unknown>) {
  const style = str(args.style);
  const material = str(args.material);
  const category = str(args.category);
  const parts = [style === 'bridal' ? 'bridal' : style === 'traditional' ? 'traditional' : style, material, category ? (category === 'set' ? 'sets' : category === 'ring' ? 'rings' : category === 'necklace' || category === 'choker' ? 'necklaces' : category) : 'pieces'];
  return parts.filter(Boolean).join(' ');
}

/**
 * Every Stage 1 tool is a visible browser action. Never throws: unknown tools return an
 * error object so a model (or the mock) can recover.
 */
export async function executeTool(name: ToolName, args: Record<string, unknown>): Promise<ToolOutcome> {
  const ctx = buildSiteContext();
  const site = useSiteStore.getState();

  switch (name) {
    case 'searchProducts': {
      const limit = Math.min(Number(args.limit ?? 4), 6);
      const results = searchCatalogue({
        query: str(args.query),
        category: str(args.category) as never,
        material: str(args.material) as never,
        world: str(args.collection) as never,
        style: str(args.style) as never,
        limit,
      });
      const what = describeQuery(args);
      if (results.length === 0) {
        return { result: { count: 0, items: [] }, label: CONCIERGE.labels.nothing, runningLabel: CONCIERGE.labels.searching(what) };
      }
      const cards = cardsOf(results);
      const count = capitalise(countInWords(results.length));
      const houses = [...new Set(results.map((p) => p.house).filter((h): h is string => Boolean(h)))];
      return {
        result: { count: results.length, items: results.map((p) => ({ slug: p.slug, name: p.editorialTitle, house: p.house, priceLabel: cards.find((c) => c.slug === p.slug)?.priceLabel })), houses },
        label: CONCIERGE.labels.found(count, what),
        runningLabel: CONCIERGE.labels.searching(what),
        ui: { kind: 'pieces', title: `${count} ${what}`, pieces: cards },
      };
    }

    case 'showBridal':
    case 'showCollection': {
      const slug = name === 'showBridal' ? 'bridal' : (str(args.slug) ?? 'bridal');
      const world = WORLD_BY_SLUG[slug];
      const href = world ? world.href : COLLECTION_ROUTE;
      const onRoute = ctx.route.startsWith(COLLECTION_ROUTE);
      if (onRoute && !world) {
        const el = sectionElement('pieces');
        if (el) scrollTo(el, { offset: -24, duration: 1.6 });
      } else {
        await navigate(href);
      }
      const card: CollectionCard = world
        ? { slug: world.slug, name: world.name, image: getImage(world.imagery.hero).src, href: world.href, ordinal: WORLDS.indexOf(world) + 1 }
        : { slug: 'bridal', name: 'The Bridal House', image: getImage(getCollection('bridal')?.opening.still ?? 'p03-hero').src, href: COLLECTION_ROUTE, ordinal: 0 };
      return {
        result: { ok: true, collection: slug, href },
        runningLabel: world ? CONCIERGE.labels.opening(world.name) : CONCIERGE.labels.bridal,
        label: world ? CONCIERGE.labels.opened(world.name) : CONCIERGE.labels.bridalDone,
        navigateTo: href,
        ui: { kind: 'collection', collection: card },
        compact: true,
      };
    }

    case 'focusProduct': {
      const product = resolveAnchor(args, ctx);
      if (!product) return { result: { error: 'unknown product' }, label: '' };
      const el = productElement(product.slug);
      if (el) {
        scrollTo(el, { offset: -(window.innerHeight - el.getBoundingClientRect().height) / 2, duration: 1.4 });
        const host = el.closest<HTMLElement>('[data-world], article, li, div') ?? el;
        host.classList.add('is-spotlit');
        window.setTimeout(() => host.classList.remove('is-spotlit'), 2600);
        site.setFocusedProduct(product.slug);
      } else {
        site.setPendingSpotlight(product.slug);
        await navigate(COLLECTION_ROUTE);
      }
      return {
        result: { ok: true, slug: product.slug },
        runningLabel: CONCIERGE.labels.showing(product.editorialTitle),
        label: CONCIERGE.labels.shown(product.editorialTitle),
        ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'focused' },
        compact: true,
      };
    }

    case 'openProduct': {
      const product = resolveAnchor(args, ctx);
      if (!product) return { result: { error: 'unknown product' }, label: '' };
      const el = productElement(product.slug);
      const img = el?.querySelector('img') ?? null;
      site.setLastOpenedProduct(product.slug);
      await navigate(`/jewellery/${product.slug}`, img ? 'flip' : 'curtain', img);
      return {
        result: { ok: true, slug: product.slug, href: `/jewellery/${product.slug}` },
        runningLabel: CONCIERGE.labels.opening(product.editorialTitle),
        label: CONCIERGE.labels.opened(product.editorialTitle),
        navigateTo: `/jewellery/${product.slug}`,
        ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'opened' },
        compact: true,
      };
    }

    case 'showSimilarPieces': {
      const anchor = resolveAnchor(args, ctx);
      if (!anchor) return { result: { needsPiece: true }, label: '' };
      const results = similarTo(anchor.slug, Math.min(Number(args.limit ?? 4), 6));
      if (ctx.routeKind === 'product') {
        const el = sectionElement('related');
        if (el) scrollTo(el, { offset: -24, duration: 1.4 });
      }
      const count = capitalise(countInWords(results.length));
      return {
        result: { anchor: anchor.slug, items: results.map((p) => ({ slug: p.slug, name: p.editorialTitle })) },
        runningLabel: CONCIERGE.labels.similar,
        label: CONCIERGE.labels.similarDone(count),
        ui: { kind: 'pieces', title: `In the spirit of the ${anchor.editorialTitle}`, pieces: cardsOf(results) },
      };
    }

    case 'saveToWishlist': {
      const product = resolveAnchor(args, ctx);
      if (!product) return { result: { needsPiece: true }, label: '' };
      const already = site.wishlist.includes(product.slug);
      if (!already) site.addToWishlist(product.slug);
      return {
        result: { ok: true, slug: product.slug, already },
        runningLabel: CONCIERGE.labels.keeping,
        label: already ? CONCIERGE.labels.alreadyKept : CONCIERGE.labels.kept,
        ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'saved' },
      };
    }

    case 'removeFromWishlist': {
      // "remove it" means a piece that is kept: the named one, else the piece in view, else the last shown
      const explicit = str(args.slug);
      const candidates = [explicit, ctx.focusedProduct?.slug, ctx.currentProduct?.slug, ...ctx.recentResults.map((r) => r.slug)].filter((s): s is string => !!s);
      const slug = candidates.find((s) => site.wishlist.includes(s));
      const product = slug ? getProduct(slug) : undefined;
      if (!product) return { result: { needsPiece: true }, label: '' };
      site.removeFromWishlist(product.slug);
      return { result: { ok: true, slug: product.slug }, runningLabel: CONCIERGE.labels.removing, label: CONCIERGE.labels.removed, ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'removed' } };
    }

    case 'openWishlist': {
      const pieces = productsBySlugs(site.wishlist);
      site.openLedger();
      const n = countInWords(pieces.length);
      return {
        result: { count: pieces.length, items: pieces.map((p) => ({ slug: p.slug, name: p.editorialTitle })) },
        runningLabel: CONCIERGE.labels.selection,
        label: pieces.length ? CONCIERGE.labels.selectionDone(pieces.length, n) : CONCIERGE.labels.selectionEmpty,
        ui: { kind: 'wishlist', pieces: cardsOf(pieces) },
        compact: true,
      };
    }

    case 'scrollToSection': {
      const id = str(args.section) as SectionId | undefined;
      if (!id) return { result: { error: 'unknown section' }, label: '' };
      const label = SECTION_LABELS[id] ?? id;
      const el = sectionElement(id);
      if (id === 'footer') {
        // the footer waits beneath every route
        scrollTo(document.documentElement.scrollHeight, { duration: 1.6 });
      } else if (el && (ctx.routeKind === 'home' || ['pieces', 'related', 'gallery', 'details'].includes(id))) {
        scrollTo(el, { duration: 1.6 });
      } else {
        site.setPendingSection(id);
        await navigate('/');
      }
      return {
        result: { ok: true, section: id },
        runningLabel: CONCIERGE.labels.going(label),
        label: CONCIERGE.labels.gone(label),
        ui: id === 'heritage' ? { kind: 'house' } : id === 'collections' ? { kind: 'collections', collections: worldCards() } : { kind: 'navigation', label, href: '/' },
        compact: ctx.viewport !== 'desktop',
      };
    }

    case 'openPrivateConsultation': {
      const topic = (str(args.topic) as 'bridal' | 'bespoke' | 'viewing' | 'general' | undefined) ?? 'viewing';
      const productSlug = str(args.productSlug) ?? ctx.currentProduct?.slug ?? undefined;
      site.openConsultation({ topic, productSlug, source: 'concierge' });
      return {
        result: { ok: true, topic, productSlug },
        runningLabel: CONCIERGE.labels.consultation,
        label: CONCIERGE.labels.consultationDone,
        ui: { kind: 'consultation', topic },
        compact: true,
      };
    }

    case 'showGold':
    case 'showDiamond': {
      const material = name === 'showGold' ? 'gold' : 'diamond';
      const results = searchCatalogue({ material, limit: 4 });
      if (ctx.routeKind === 'home') {
        site.setDualityBias(material);
        const el = sectionElement('duality');
        if (el) scrollTo(el, { duration: 1.6 });
      } else if (!ctx.route.includes(`edit=${material}`)) {
        await navigate(`${COLLECTION_ROUTE}?edit=${material}`);
      }
      return {
        result: { material, items: results.map((p) => ({ slug: p.slug, name: p.editorialTitle })) },
        runningLabel: material === 'gold' ? CONCIERGE.labels.gold : CONCIERGE.labels.diamond,
        label: material === 'gold' ? CONCIERGE.labels.goldDone : CONCIERGE.labels.diamondDone,
        ui: { kind: 'pieces', title: material === 'gold' ? 'The gold edit' : 'The diamond edit', pieces: cardsOf(results) },
      };
    }

    case 'navigate': {
      const path = str(args.path) ?? '/';
      const ok = path === '/' || /^\/collections\/[a-z0-9-]+(\?.*)?$/.test(path) || /^\/jewellery\/[a-z0-9-]+$/.test(path);
      if (!ok) return { result: { error: 'invalid path' }, label: '' };
      const label = path === '/' ? 'The House' : path.startsWith('/collections') ? 'The Bridal House' : (getProduct(path.split('/')[2] ?? '')?.editorialTitle ?? 'the piece');
      await navigate(path);
      return { result: { ok: true, path }, runningLabel: CONCIERGE.labels.navigating(label), label, navigateTo: path, ui: { kind: 'navigation', label, href: path }, compact: true };
    }

    case 'getCurrentContext':
      return { result: ctx, label: '' };

    default:
      return { result: { error: `Unknown tool ${String(name)}` }, label: '' };
  }
}

export function ordinalFromWord(word: string): number | null {
  const map: Record<string, number> = { first: 1, '1st': 1, one: 1, second: 2, '2nd': 2, two: 2, third: 3, '3rd': 3, three: 3, fourth: 4, '4th': 4, four: 4, fifth: 5, '5th': 5, five: 5, sixth: 6, '6th': 6, six: 6 };
  return map[word] ?? null;
}

/** "Open the second one" resolves against recent results, then recent collections, then what is visible. */
export function resolveOrdinal(n: number, ctx: SiteContext): { kind: 'product'; slug: string } | { kind: 'collection'; slug: string } | null {
  const idx = n === -1 ? -1 : n - 1;
  const pick = <T,>(list: T[]) => (idx === -1 ? list[list.length - 1] : list[idx]);
  const r = pick(ctx.recentResults);
  if (r) return { kind: 'product', slug: r.slug };
  const c = pick(ctx.recentCollections);
  if (c) return { kind: 'collection', slug: c };
  const v = pick(ctx.visibleProducts);
  if (v) return { kind: 'product', slug: v.slug };
  return null;
}

export { useConciergeStore };
