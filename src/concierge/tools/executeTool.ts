'use client';

import { WORLDS, WORLD_BY_SLUG } from '@/data/worlds';
import { COLLECTION_BY_SLUG } from '@/data/collections';
import { getRow, getRows, searchRows, similarRows } from '@/data/clientIndex';
import { asCategory, asDepartment, asKarat, asMaterial } from '@/data/vocabulary';
import { DEPARTMENT_LABEL, CATEGORY_PLURAL } from '@/data/labels';
import type { Category } from '@/data/types';
import { SECTION_LABELS, sectionElement } from '@/state/sections';
import { productElement } from '@/state/visibility';
import { runtime, scrollTo } from '@/state/runtime';
import { useSiteStore, type SectionId } from '@/state/siteStore';
import { useConciergeStore, type CollectionCard } from '@/state/conciergeStore';
import { countInWords, capitalise } from '@/lib/format';
import { buildSiteContext, cardsOf } from '../context';
import { CONCIERGE } from '../copy';
import type { SiteContext, ToolName, ToolOutcome } from '../types';
import type { PieceRow } from '@/lib/facets';

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

function resolveAnchor(args: Record<string, unknown>, ctx: SiteContext): PieceRow | undefined {
  const explicit = str(args.slug);
  const slug = explicit ?? ctx.currentProduct?.slug ?? ctx.focusedProduct?.slug ?? ctx.recentResults[0]?.slug ?? undefined;
  return slug ? getRow(slug) : undefined;
}

function worldCards(): CollectionCard[] {
  return WORLDS.map((w, i) => ({ slug: w.slug, name: w.name, image: { kind: 'local' as const, id: w.imagery.hero }, href: w.href, ordinal: i + 1 }));
}

/** One pluralisation, shared with every other surface that names a kind. */
function describeQuery(args: Record<string, unknown>) {
  const style = str(args.style);
  const material = str(args.material);
  const department = asDepartment(args.department);
  const category = asCategory(args.category);
  const kind = category ? (CATEGORY_PLURAL[category as Category] ?? category).toLowerCase() : 'pieces';
  const parts = [style === 'bridal' ? 'bridal' : style === 'traditional' ? 'traditional' : style, material, department ? DEPARTMENT_LABEL[department].toLowerCase() : undefined, kind];
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
      /**
       * Narrowed, not cast. `collection` used to be handed to `world` through `as never`,
       * which meant a collection slug scored −100 against every product and the tool
       * silently returned nothing at all.
       */
      const collection = str(args.collection);
      void collection;
      const results = searchRows({
        query: str(args.query),
        category: asCategory(args.category),
        material: asMaterial(args.material),
        department: asDepartment(args.department),
        purity: asKarat(args.purity),
        occasion: str(args.occasion),
        maxWeightGrams: typeof args.maxWeightGrams === 'number' ? args.maxWeightGrams : undefined,
        limit,
      });
      const what = describeQuery(args);
      if (results.length === 0) {
        return { result: { count: 0, items: [] }, label: CONCIERGE.labels.nothing, runningLabel: CONCIERGE.labels.searching(what) };
      }
      const cards = cardsOf(results);
      const count = capitalise(countInWords(results.length));
      const houses = [...new Set(results.map((p) => p.cp).filter((h): h is string => Boolean(h)))];
      return {
        result: { count: results.length, items: results.map((p) => ({ slug: p.s, name: p.t, house: p.cp, priceLabel: cards.find((c) => c.slug === p.s)?.priceLabel })), houses },
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
      // bridal means the story; the index of every bridal piece is the department at /bridal
      if (onRoute && !world) {
        const el = sectionElement('pieces');
        if (el) scrollTo(el, { offset: -24, duration: 1.6 });
      } else {
        await navigate(href);
      }
      const card: CollectionCard = world
        ? { slug: world.slug, name: world.name, image: { kind: 'local', id: world.imagery.hero }, href: world.href, ordinal: WORLDS.indexOf(world) + 1 }
        : { slug: 'bridal', name: 'Bridal', image: { kind: 'local', id: COLLECTION_BY_SLUG.bridal?.opening.still ?? 'p03-hero' }, href: COLLECTION_ROUTE, ordinal: 0 };
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
      const el = productElement(product.s);
      if (el) {
        scrollTo(el, { offset: -(window.innerHeight - el.getBoundingClientRect().height) / 2, duration: 1.4 });
        const host = el.closest<HTMLElement>('[data-world], article, li, div') ?? el;
        host.classList.add('is-spotlit');
        window.setTimeout(() => host.classList.remove('is-spotlit'), 2600);
        site.setFocusedProduct(product.s);
      } else {
        // not on this page: go where the piece actually lives, not to the one collection
        site.setPendingSpotlight(product.s);
        await navigate(product.d[0] ? `/${product.d[0]}` : COLLECTION_ROUTE);
      }
      return {
        result: { ok: true, slug: product.s },
        runningLabel: CONCIERGE.labels.showing(product.t),
        label: CONCIERGE.labels.shown(product.t),
        ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'focused' },
        compact: true,
      };
    }

    case 'openProduct': {
      const product = resolveAnchor(args, ctx);
      if (!product) return { result: { error: 'unknown product' }, label: '' };
      const el = productElement(product.s);
      const img = el?.querySelector('img') ?? null;
      site.setLastOpenedProduct(product.s);
      await navigate(`/jewellery/${product.s}`, img ? 'flip' : 'curtain', img);
      return {
        result: { ok: true, slug: product.s, href: `/jewellery/${product.s}` },
        runningLabel: CONCIERGE.labels.opening(product.t),
        label: CONCIERGE.labels.opened(product.t),
        navigateTo: `/jewellery/${product.s}`,
        ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'opened' },
        compact: true,
      };
    }

    case 'showSimilarPieces': {
      const anchor = resolveAnchor(args, ctx);
      if (!anchor) return { result: { needsPiece: true }, label: '' };
      const results = similarRows(anchor.s, Math.min(Number(args.limit ?? 4), 6));
      if (ctx.routeKind === 'product') {
        const el = sectionElement('related');
        if (el) scrollTo(el, { offset: -24, duration: 1.4 });
      }
      const count = capitalise(countInWords(results.length));
      return {
        result: { anchor: anchor.s, items: results.map((p) => ({ slug: p.s, name: p.t })) },
        runningLabel: CONCIERGE.labels.similar,
        label: CONCIERGE.labels.similarDone(count),
        ui: { kind: 'pieces', title: `In the spirit of the ${anchor.t}`, pieces: cardsOf(results) },
      };
    }

    case 'saveToWishlist': {
      const product = resolveAnchor(args, ctx);
      if (!product) return { result: { needsPiece: true }, label: '' };
      const already = site.wishlist.includes(product.s);
      if (!already) site.addToWishlist(product.s);
      return {
        result: { ok: true, slug: product.s, already },
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
      const product = slug ? getRow(slug) : undefined;
      if (!product) return { result: { needsPiece: true }, label: '' };
      site.removeFromWishlist(product.s);
      return { result: { ok: true, slug: product.s }, runningLabel: CONCIERGE.labels.removing, label: CONCIERGE.labels.removed, ui: { kind: 'piece', piece: cardsOf([product])[0]!, verb: 'removed' } };
    }

    case 'openWishlist': {
      const pieces = getRows(site.wishlist);
      site.openLedger();
      const n = countInWords(pieces.length);
      return {
        result: { count: pieces.length, items: pieces.map((p) => ({ slug: p.s, name: p.t })) },
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

    /**
     * One resolver, three names. `showGold` and `showDiamond` survive as deprecated aliases
     * so existing fixtures and a model's habits keep working, but they no longer open an
     * edit of the bridal collection — those departments are real now, and the tray and the
     * page are the same set of pieces rather than two different answers to one question.
     */
    case 'showDepartment':
    case 'showGold':
    case 'showDiamond': {
      const department = name === 'showGold' ? 'gold' : name === 'showDiamond' ? 'diamond' : (asDepartment(args.department) ?? 'gold');
      const results = searchRows({ department, limit: 4 });
      const label = DEPARTMENT_LABEL[department];
      // on the homepage the duality chapter *is* the door to gold and diamond: set the side
      // it should open on, then bring the visitor to it
      if (ctx.routeKind === 'home' && (department === 'gold' || department === 'diamond')) {
        site.setDualityBias(department);
        const el = sectionElement('duality');
        if (el) scrollTo(el, { duration: 1.6 });
      } else if (ctx.route.split('?')[0] === `/${department}`) {
        const el = sectionElement('pieces');
        if (el) scrollTo(el, { offset: -24, duration: 1.6 });
      } else {
        await navigate(`/${department}`);
      }
      return {
        result: { department, items: results.map((p) => ({ slug: p.s, name: p.t })) },
        runningLabel: CONCIERGE.labels.navigating(label),
        label,
        ui: { kind: 'pieces', title: label, pieces: cardsOf(results) },
      };
    }

    case 'navigate': {
      const path = str(args.path) ?? '/';
      const ok =
        path === '/' ||
        /^\/collections\/[a-z0-9-]+(\?.*)?$/.test(path) ||
        /^\/jewellery\/[a-z0-9-]+$/.test(path) ||
        /^\/(gold|diamond|bridal|men|kids)(\/[a-z-]+)?(\?.*)?$/.test(path);
      if (!ok) return { result: { error: 'invalid path' }, label: '' };
      const department = asDepartment(path.split('?')[0]?.split('/')[1]);
      const label = path === '/'
        ? 'Waseem Jewellers'
        : department
          ? DEPARTMENT_LABEL[department]
          : path.startsWith('/collections')
            ? 'Bridal'
            : (getRow(path.split('/')[2] ?? '')?.t ?? 'the piece');
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
