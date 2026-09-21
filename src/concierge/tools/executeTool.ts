'use client';

import { WORLDS, WORLD_BY_SLUG } from '@/data/worlds';
import { COLLECTION_BY_SLUG } from '@/data/collections';
import { getRow, getRows, isKnownSlug, lighterRows, matchingRows, priceLabelOf, searchRows, similarRows } from '@/data/clientIndex';
import { validateToolCall } from './validate';
import { asDepartment, asKarat, asMaterial, canonicalCategory } from '@/data/vocabulary';
import { DEPARTMENT_LABEL, CATEGORY_LABEL, CATEGORY_PLURAL, campaignSlugOf } from '@/data/labels';
import { EMPTY_FACETS, facetPhrases, parseFacets, serialiseFacets, type FacetState, type SortKey } from '@/lib/facets';
import type { Category, Department } from '@/data/types';
import { SECTION_LABELS, sectionElement, sectionsReady } from '@/state/sections';
import { productElement } from '@/state/visibility';
import { runtime, scrollTo } from '@/state/runtime';
import { useSiteStore, type ConsultationDraft, type ConsultationOutcome, type SectionId } from '@/state/siteStore';
import { useConciergeStore, type CollectionCard, type CompareRow } from '@/state/conciergeStore';
import { countInWords, capitalise } from '@/lib/format';
import { buildSiteContext, cardsOf } from '../context';
import { requestConcierge } from '../bridge';
import { CONCIERGE } from '../copy';
import { checkDate, describeDraft, isOccasion, isWindow, missingFields, PHONE_RE, resolveShowroom } from './appointment';
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

/**
 * "Go back." The router's own history step, which the transition layer receives as a
 * popstate and answers with its reveal half (`arrivePlain`) — the same arrival a visitor's
 * back button gets. Resolves once the route has actually changed, or after a short wait
 * when there was nowhere to go back to, so the model is told where the visitor stands.
 */
function goBack(from: string): Promise<string> {
  if (runtime.router) runtime.router.back();
  else window.history.back();
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const now = useSiteStore.getState().pathname;
      if (now !== from) return resolve(now);
      if (performance.now() - started > 2500) return resolve(now);
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

/** After a navigation: the curtain has lifted and the destination's sections are registered. */
async function arrived() {
  await runtime.transition?.whenReady().catch(() => undefined);
  await Promise.race([sectionsReady(), new Promise((r) => setTimeout(r, 1200))]);
}

/**
 * A chapter of the homepage, from wherever the visitor is.
 *
 * The glide is issued here, after the arrival, rather than left to the homepage's own
 * pending-section effect — and the smooth scroller is told to measure the new page first.
 * Without that it clamps the target to the *previous* page's height: arriving from a
 * department page, "the showrooms" stopped seven thousand pixels short, at exactly the old
 * page's last scrollable pixel.
 */
async function glideToChapter(el: () => HTMLElement | null, onHome: boolean, offset = 0) {
  if (!onHome) {
    await navigate('/');
    await arrived();
  }
  runtime.lenis?.resize();
  const target = el();
  if (target) scrollTo(target, { offset, duration: 1.6 });
  return Boolean(target);
}

/**
 * The row of kinds inside the window chapter. It is not a section of its own, so it is
 * found within the window: marked `data-kinds` where the chapter marks it, else the one
 * navigation the chapter contains, else the chapter itself.
 */
function kindsElement(): HTMLElement | null {
  const window_ = sectionElement('vitrine');
  if (!window_) return null;
  return window_.querySelector<HTMLElement>('[data-kinds]') ?? window_.querySelector<HTMLElement>('nav') ?? window_;
}

/**
 * The form's verdict on a submission the concierge asked for, matched by nonce. The form
 * answers with what actually happened; waiting on it is how the tool's sentence stays true.
 */
function awaitOutcome(nonce: number, timeoutMs = 20000): Promise<ConsultationOutcome | null> {
  return new Promise((resolve) => {
    const current = useSiteStore.getState().consultationOutcome;
    if (current?.nonce === nonce) return resolve(current);
    let done = false;
    const finish = (o: ConsultationOutcome | null) => {
      if (done) return;
      done = true;
      off();
      window.clearTimeout(timer);
      resolve(o);
    };
    const off = useSiteStore.subscribe((s) => {
      if (s.consultationOutcome?.nonce === nonce) finish(s.consultationOutcome);
    });
    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
}

/** The form's topic that best matches an occasion; the form itself preselects the occasion from it. */
const topicOf = (occasion: string | undefined): 'bridal' | 'bespoke' | 'viewing' => (occasion === 'bridal' ? 'bridal' : occasion === 'bespoke' ? 'bespoke' : 'viewing');

const uniq = (list: string[]) => [...new Set(list)];

/** The department the visitor is standing in, read from the route rather than kept twice. */
const departmentOf = (ctx: SiteContext): Department | undefined => asDepartment(ctx.route.split('?')[0]?.split('/')[1]);

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
  const category = canonicalCategory(args.category);
  const kind = category ? (CATEGORY_PLURAL[category as Category] ?? category).toLowerCase() : 'pieces';
  const parts = [style === 'bridal' ? 'bridal' : style === 'traditional' ? 'traditional' : style, material, department ? DEPARTMENT_LABEL[department].toLowerCase() : undefined, kind];
  return parts.filter(Boolean).join(' ');
}

/**
 * Every Stage 1 tool is a visible browser action. Never throws: unknown tools return an
 * error object so a model (or the mock) can recover.
 *
 * The validator runs here as well as on the server, and the duplication is the whole point.
 * The realtime voice engine holds its own data channel to the model and never passes
 * through our route at all, so on that path this is not defence in depth — it is the only
 * gate there is. Running it here also means the keyless engine is held to the same rule as
 * the model: neither can act on a slug the catalogue does not carry.
 */
export async function executeTool(name: ToolName, rawArgs: Record<string, unknown>): Promise<ToolOutcome> {
  const verdict = validateToolCall(name, rawArgs, { isKnownSlug });
  if (!verdict.ok) return { result: { error: verdict.error.code, message: verdict.error.message }, label: '' };
  const args = verdict.args;
  const ctx = buildSiteContext();
  const site = useSiteStore.getState();

  switch (name) {
    case 'searchProducts': {
      const limit = Math.min(Number(args.limit ?? 4), 6);
      /**
       * The campaign filter is gone rather than fixed, and the reasoning is worth keeping.
       *
       * `collection` was handed to `world` through `as never`, scoring −100 against every
       * product; removing the cast left the value unread, so the argument was decorative.
       * Wiring it properly needed a translation as well — the campaign worlds and the shop's
       * collection handles disagree on three of six spellings. But once wired it returned an
       * empty tray anyway, because the campaign pieces are withheld pending their names. An
       * argument that cannot succeed is worse than one that does nothing, so the schema no
       * longer offers it. `campaignSlugOf` survives for the facet URL, where the values come
       * from counts of real pieces and can only name a campaign that has some.
       */
      const results = searchRows({
        query: str(args.query),
        category: canonicalCategory(args.category),
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

    case 'scrollToSection': {
      const wanted = str(args.section);
      if (!wanted) return { result: { error: 'unknown section' }, label: '' };
      /**
       * The row of kinds is inside the window chapter rather than a chapter of its own, so
       * it has no registration to glide to; it is found within the window once the page is
       * there. Every other target is a registered section.
       */
      if (wanted === 'kinds') {
        const found = await glideToChapter(kindsElement, ctx.routeKind === 'home', -96);
        return {
          result: { ok: true, section: 'kinds', found },
          runningLabel: CONCIERGE.labels.going(CONCIERGE.labels.kinds),
          label: CONCIERGE.labels.kinds,
          ui: { kind: 'navigation', label: CONCIERGE.labels.kinds, href: '/' },
          compact: ctx.viewport !== 'desktop',
        };
      }
      const id = wanted as SectionId;
      const label = SECTION_LABELS[id] ?? id;
      const el = sectionElement(id);
      let found = true;
      if (id === 'footer') {
        // the footer waits beneath every route
        scrollTo(document.documentElement.scrollHeight, { duration: 1.6 });
      } else if (el && (ctx.routeKind === 'home' || ['pieces', 'related', 'gallery', 'details', 'department'].includes(id))) {
        scrollTo(el, { duration: 1.6 });
      } else {
        // a homepage chapter from anywhere else: home first, then the glide
        found = await glideToChapter(() => sectionElement(id), ctx.routeKind === 'home');
      }
      return {
        result: { ok: true, section: id, found },
        runningLabel: CONCIERGE.labels.going(label),
        label: CONCIERGE.labels.gone(label),
        ui: id === 'heritage' ? { kind: 'house' } : id === 'collections' ? { kind: 'collections', collections: worldCards() } : { kind: 'navigation', label, href: '/' },
        compact: ctx.viewport !== 'desktop',
      };
    }

    case 'openPrivateConsultation':
    case 'openAppointment': {
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
      // on the homepage every department has a chapter of its own pieces: bring the visitor to it
      if (ctx.routeKind === 'home') {
        const el = sectionElement(department === 'gold' || department === 'diamond' ? department : department === 'bridal' ? 'bridal' : 'menkids');
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


    /**
     * Side by side, from what is published and nothing else. A missing figure is a dash the
     * visitor can ask about — never a number borrowed from a similar piece.
     */
    case 'comparePieces': {
      const slugs = Array.isArray(args.slugs) ? (args.slugs as unknown[]).filter((s): s is string => typeof s === 'string') : [];
      const rows = getRows([...new Set(slugs)]).slice(0, 3);
      if (rows.length < 2) return { result: { needsPieces: true }, label: '' };
      const axis = (label: string, read: (r: PieceRow) => string | undefined): CompareRow => ({ axis: label, values: rows.map((r) => read(r) ?? null) });
      const table = [
        axis('Kind', (r) => (r.c ? CATEGORY_LABEL[r.c as Category] : undefined)),
        axis('Purity', (r) => r.k),
        axis('Gross weight', (r) => (r.w !== undefined ? `${r.w.toFixed(3)} g` : undefined)),
        axis('Diamonds', (r) => (r.ct !== undefined ? `${r.ct} ct` : undefined)),
        axis('Price', (r) => (r.p > 0 ? priceLabelOf(r) : undefined)),
        axis('Reference', (r) => r.rf),
      ].filter((row) => row.values.some((v) => v !== null));
      return {
        result: { pieces: rows.map((r) => ({ slug: r.s, name: r.t })), rows: table },
        runningLabel: CONCIERGE.labels.compare,
        label: CONCIERGE.labels.compareDone,
        ui: { kind: 'compare', title: rows.map((r) => r.t).join(' · '), pieces: cardsOf(rows), rows: table },
      };
    }

    /**
     * What would be worn *with* the piece — the question `showSimilarPieces` does not answer.
     * A visitor looking at a necklace and asking "what goes with this" wants earrings, and
     * being handed four more necklaces is the moment a concierge stops sounding like a person.
     */
    case 'showMatchingPieces': {
      const anchor = resolveAnchor(args, ctx);
      if (!anchor) return { result: { needsPiece: true }, label: '' };
      const limit = Math.min(Number(args.limit ?? 4), 6);
      const want = canonicalCategory(args.category);
      // "matching earrings": the companions of that one kind, when any exist; else every companion
      const all = matchingRows(anchor.s, want ? 24 : limit);
      const ofKind = want ? all.filter((r) => r.c === want) : [];
      const results = (ofKind.length ? ofKind : all).slice(0, limit);
      if (!results.length) {
        return {
          result: { anchor: anchor.s, count: 0, items: [], note: 'No complementary piece in the listable collection. Say so; do not offer a piece of the same kind instead.' },
          label: CONCIERGE.labels.matchingNone,
          runningLabel: CONCIERGE.labels.matching,
        };
      }
      return {
        result: { anchor: anchor.s, count: results.length, items: results.map((r) => ({ slug: r.s, name: r.t, kind: r.c })) },
        runningLabel: CONCIERGE.labels.matching,
        label: CONCIERGE.labels.matchingDone(anchor.t),
        ui: { kind: 'pieces', title: `Worn with the ${anchor.t}`, pieces: cardsOf(results) },
      };
    }

    /**
     * "Something lighter." The honesty ladder lives here, and what it returns to the model
     * carries `basis` so the sentence can match the evidence: a published comparison may be
     * stated as weight, a comparison of form may only be stated as form. Neither branch ever
     * produces a gram figure the shop has not published.
     */
    case 'refineResults': {
      const direction = str(args.weight);
      if (direction === 'lighter' || direction === 'heavier') {
        const anchor = resolveAnchor(args, ctx);
        if (!anchor) return { result: { needsPiece: true }, label: '' };
        const { basis, rows, anchorWeight } = lighterRows(anchor.s, direction, Math.min(Number(args.limit ?? 4), 6));
        if (basis === 'none') {
          return {
            result: {
              anchor: anchor.s,
              basis,
              count: 0,
              items: [],
              note: 'Neither a published weight nor a comparable form. Say that a consultant can weigh the pieces at a viewing; do not estimate.',
            },
            label: CONCIERGE.labels.weightUnknown,
            runningLabel: CONCIERGE.labels.refining,
          };
        }
        const heavier = direction === 'heavier';
        const label =
          basis === 'published'
            ? heavier
              ? CONCIERGE.labels.heavierDone
              : CONCIERGE.labels.lighterDone
            : heavier
              ? CONCIERGE.labels.heavierByForm
              : CONCIERGE.labels.lighterByForm;
        return {
          result: {
            anchor: anchor.s,
            basis,
            anchorWeightGrams: anchorWeight,
            count: rows.length,
            items: rows.map((r) => ({ slug: r.s, name: r.t, kind: r.c, grossWeightGrams: r.w })),
            note:
              basis === 'published'
                ? 'These weights are published. You may state them.'
                : 'Waseem publishes no weight for the piece in view, so this comparison is of form, not of grams. Say "lighter in form" and offer a consultant; never state or estimate a weight.',
          },
          runningLabel: CONCIERGE.labels.refining,
          label,
          ui: { kind: 'pieces', title: label, pieces: cardsOf(rows) },
        };
      }

      // no comparative: an ordinary narrowing of the same question
      const results = searchRows({
        category: canonicalCategory(args.category),
        material: asMaterial(args.material),
        purity: asKarat(args.purity),
        maxWeightGrams: typeof args.maxWeightGrams === 'number' ? args.maxWeightGrams : undefined,
        department: departmentOf(ctx),
        limit: Math.min(Number(args.limit ?? 4), 6),
      });
      const what = describeQuery(args);
      if (!results.length) return { result: { count: 0, items: [] }, label: CONCIERGE.labels.nothing, runningLabel: CONCIERGE.labels.refining };
      return {
        result: { count: results.length, items: results.map((r) => ({ slug: r.s, name: r.t })) },
        runningLabel: CONCIERGE.labels.refining,
        label: CONCIERGE.labels.found(capitalise(countInWords(results.length)), what),
        ui: { kind: 'pieces', title: `${capitalise(countInWords(results.length))} ${what}`, pieces: cardsOf(results) },
      };
    }

    /**
     * Filters go into the URL, not into a state this conversation holds privately.
     *
     * That is the whole design: the department page reads its facets from the query string,
     * so a filter the concierge applies is one the visitor can see in the drawer, undo with
     * the back button, and send to someone else in a link. A concierge holding its own
     * parallel filter state would be a second answer to the same question.
     */
    case 'filterProducts':
    case 'clearFilters': {
      const clearing = name === 'clearFilters';
      const department = asDepartment(args.department) ?? departmentOf(ctx) ?? 'gold';
      const [path, search = ''] = ctx.route.split('?');
      const onDepartment = path === `/${department}`;
      const current = onDepartment ? parseFacets(search) : { ...EMPTY_FACETS };
      const campaign = str(args.campaign);
      const next: FacetState = clearing
        ? { ...EMPTY_FACETS }
        : {
            ...current,
            category: canonicalCategory(args.category) ?? current.category,
            material: asMaterial(args.material) ?? current.material,
            purity: asKarat(args.purity) ?? current.purity,
            weight: str(args.weight) ?? current.weight,
            occasion: str(args.occasion) ?? current.occasion,
            campaign: campaign ? campaignSlugOf(campaign) : current.campaign,
            sort: (str(args.sort) as SortKey | undefined) ?? current.sort,
            // a changed filter is a different set of pieces: the ledger starts again
            shown: EMPTY_FACETS.shown,
          };
      const query = serialiseFacets(next);
      const href = query ? `/${department}?${query}` : `/${department}`;
      await navigate(href);
      const phrases = facetPhrases(next);
      const phrase = phrases.length ? [DEPARTMENT_LABEL[department], ...phrases.map((f) => f.label)].join(' · ') : DEPARTMENT_LABEL[department];
      return {
        result: { department, filters: Object.fromEntries(phrases.map((f) => [f.key, f.value])), href },
        runningLabel: CONCIERGE.labels.filtering,
        label: clearing ? CONCIERGE.labels.cleared : CONCIERGE.labels.filtered(phrase),
        navigateTo: href,
        ui: { kind: 'navigation', label: phrase, href },
        compact: true,
      };
    }

    /**
     * Price, in a shop where all but seventeen pieces carry none.
     *
     * The honest surface is not a number and not a refusal — it is the consultation, with
     * whatever the visitor said about their budget carried into it, so the conversation
     * continues on the other side rather than starting again. A budget is a fact about the
     * visitor, which is the one kind of figure this tool may pass on.
     */
    case 'showPriceGuidance': {
      const anchor = resolveAnchor(args, ctx);
      const budget = typeof args.budgetPkr === 'number' && args.budgetPkr > 0 ? Math.round(args.budgetPkr) : undefined;
      const published = anchor && anchor.p > 0 ? anchor.p : undefined;
      if (anchor && published !== undefined) {
        return {
          result: { slug: anchor.s, pricePkr: published, note: 'A published price, confirmed at a viewing. Gold moves daily; do not present it as fixed.' },
          runningLabel: CONCIERGE.labels.price,
          label: `Rs. ${new Intl.NumberFormat('en-US').format(published)}`,
          ui: { kind: 'piece', piece: cardsOf([anchor])[0]!, verb: 'focused' },
          compact: true,
        };
      }
      site.openConsultation({ topic: 'viewing', productSlug: anchor?.s, source: 'concierge', budgetPkr: budget });
      return {
        result: {
          slug: anchor?.s ?? null,
          pricePkr: null,
          budgetCarried: budget ?? null,
          note: 'Waseem publishes no price for this piece. Say it is on request and that a consultant will confirm it. Never estimate a figure or a range.',
        },
        runningLabel: CONCIERGE.labels.price,
        label: CONCIERGE.labels.priceOnRequest,
        ui: { kind: 'consultation', topic: 'viewing' },
        compact: true,
      };
    }
    /**
     * "Take me to gold." A target is the place as the visitor names it; a path is for the
     * pages the targets do not cover. Two of the targets are not pages at all — the
     * showrooms are a chapter, the appointment is a form — and each is answered by the tool
     * that owns it, validator and all.
     */
    case 'navigate': {
      const target = str(args.target);
      if (target === 'back') {
        const from = ctx.route.split('?')[0] ?? '/';
        const now = await goBack(from);
        const moved = now !== from;
        return {
          result: moved ? { ok: true, target, path: now } : { ok: false, target, path: now, note: 'There was no earlier page to return to. Offer the homepage instead.' },
          runningLabel: CONCIERGE.labels.back,
          label: moved ? CONCIERGE.labels.backDone : '',
          navigateTo: moved ? now : undefined,
          compact: moved,
        };
      }
      if (target === 'locations') return executeTool('scrollToSection', { section: 'heritage' });
      if (target === 'appointment') return executeTool('openAppointment', {});
      const department_ = asDepartment(target);
      const path = target === 'home' ? '/' : target === 'bridal-collection' ? COLLECTION_ROUTE : department_ ? `/${department_}` : str(args.path);
      if (!path) return { result: { error: 'NO_DESTINATION', message: 'give a target or a path' }, label: '' };
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

    /**
     * The chrome. Each of these is one visitor sentence — "open the menu", "close", "the
     * second photo" — and each does exactly what the visitor's own hand would.
     */
    case 'openMenu':
      site.openMenu();
      return { result: { ok: true, menuOpen: true }, label: CONCIERGE.labels.menu, compact: true };

    case 'closeMenu':
      site.closeMenu();
      return { result: { ok: true, menuOpen: false }, label: CONCIERGE.labels.menuClosed };

    case 'closeConcierge':
      // after the goodbye has been said, not under it: the panel closes as the keyless engine's
      // "Until next time." does, and a spoken goodbye is given a little longer to finish
      window.setTimeout(() => requestConcierge({ action: 'close' }), useConciergeStore.getState().mode === 'voice' ? 2600 : 1600);
      return { result: { ok: true, note: 'The panel closes in a moment. Say goodbye in one short line and nothing more.' }, label: CONCIERGE.labels.closing };

    case 'setGalleryFrame': {
      const slug = ctx.currentProduct?.slug;
      if (ctx.routeKind !== 'product' || !slug) return { result: { error: 'NOT_ON_A_PIECE', message: 'the visitor is not on a piece\'s page; open one first' }, label: '' };
      const index = Math.max(0, Math.round(Number(args.index ?? 0)));
      const gallery = site.gallery && site.gallery.slug === slug ? site.gallery : null;
      if (gallery && index >= gallery.count) {
        return { result: { error: 'NO_SUCH_FRAME', count: gallery.count, message: `this piece has ${gallery.count} photograph${gallery.count === 1 ? '' : 's'}` }, label: '' };
      }
      site.requestGalleryFrame(slug, index);
      const of = gallery?.count ?? index + 1;
      return {
        result: { ok: true, slug, index, count: gallery?.count ?? null },
        runningLabel: CONCIERGE.labels.framing,
        label: CONCIERGE.labels.frame(index + 1, of),
        compact: ctx.viewport !== 'desktop',
      };
    }

    case 'activateGate': {
      const material = str(args.material) === 'diamond' ? 'diamond' : 'gold';
      site.setGate(material);
      const found = await glideToChapter(() => sectionElement('gate'), ctx.routeKind === 'home');
      const label = CONCIERGE.labels.gate(material);
      return {
        result: { ok: true, material, found },
        runningLabel: CONCIERGE.labels.going(label),
        label,
        ui: { kind: 'navigation', label, href: '/' },
        compact: ctx.viewport !== 'desktop',
      };
    }

    case 'highlightCategory': {
      const category = canonicalCategory(args.category);
      if (!category) return { result: { error: 'unknown kind' }, label: '' };
      site.setHighlightedCategory(category);
      const outcome = await executeTool('scrollToSection', { section: 'kinds' });
      const label = CATEGORY_PLURAL[category as Category] ?? category;
      return { ...outcome, result: { ok: true, category, label }, label, ui: { kind: 'navigation', label, href: '/' } };
    }

    /**
     * The appointment, in three steps that the visitor can watch.
     *
     * `fillAppointment` writes into the form — the form, not a private state: every value is
     * on screen in the field it belongs to, and a value the visitor typed themselves is not
     * overwritten. `reviewAppointment` reads the form back so the confirming sentence is
     * built from the same words the visitor sees. `submitAppointment` runs the form's own
     * button, and only after the visitor has said yes; what it returns is what the form
     * reports, so the sentence after it cannot claim more than happened.
     */
    case 'fillAppointment': {
      const draft = site.consultation.draft ?? {};
      const patch: Partial<ConsultationDraft> = {};
      const problems: Record<string, string> = {};
      const name = str(args.name);
      if (name) {
        if (name.length < 2) problems.name = 'a name of at least two letters';
        else patch.name = name.slice(0, 80);
      }
      const phone = str(args.phone);
      if (phone) {
        if (!PHONE_RE.test(phone)) problems.phone = 'a telephone number we can reach: digits, with the code';
        else patch.phone = phone.slice(0, 32);
      }
      const email = str(args.email);
      if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.email = 'an email address, or none';
        else patch.email = email.slice(0, 120);
      }
      const showroomWord = str(args.showroom);
      if (showroomWord) {
        const id = resolveShowroom(showroomWord);
        if (id) patch.showroom = id;
        else problems.showroom = 'one of Liberty Market, MM Alam Road or DHA';
      }
      if (isOccasion(args.occasion)) patch.occasion = args.occasion;
      const date = str(args.date);
      if (date) {
        const verdict = checkDate(date);
        if (verdict.ok) patch.date = verdict.date;
        else problems.date = verdict.reason;
      }
      if (isWindow(args.window)) patch.window = args.window;
      const message = str(args.message);
      if (message) patch.message = message.slice(0, 1200);
      const given = Array.isArray(args.productSlugs) ? (args.productSlugs as unknown[]).filter((s): s is string => typeof s === 'string') : [];
      const slugs = uniq([...(draft.productSlugs ?? []), ...given]).filter((s) => Boolean(getRow(s))).slice(0, 40);
      if (slugs.length) patch.productSlugs = slugs;
      if (Object.keys(patch).length) site.setConsultationDraft(patch);
      const wasOpen = site.consultation.open;
      const occasion = patch.occasion ?? draft.occasion;
      if (!wasOpen) site.openConsultation({ topic: topicOf(occasion), productSlug: ctx.currentProduct?.slug, source: 'concierge' });
      const after = useSiteStore.getState().consultation.draft;
      const described = describeDraft(after, (s) => getRow(s)?.t);
      const refused = Object.keys(problems).length ? `Not written: ${Object.entries(problems).map(([k, why]) => `${k} (${why})`).join('; ')}. Ask again. ` : '';
      const next = described.missing.length ? `Still needed before it can be sent: ${described.missing.join(', ')}. Ask for one at a time.` : 'Everything required is filled. Read it back with reviewAppointment and ask whether to send.';
      return {
        result: {
          ok: true,
          formOpen: true,
          draft: described,
          missing: described.missing,
          ...(Object.keys(problems).length ? { problems } : {}),
          note: refused + next,
        },
        runningLabel: CONCIERGE.labels.filling,
        label: Object.keys(patch).length ? CONCIERGE.labels.filled : CONCIERGE.labels.consultationDone,
        ui: { kind: 'consultation', topic: topicOf(occasion) },
        compact: true,
      };
    }

    case 'reviewAppointment': {
      if (!site.consultation.open) site.openConsultation({ topic: topicOf(site.consultation.draft?.occasion), productSlug: ctx.currentProduct?.slug, source: 'concierge' });
      const described = describeDraft(useSiteStore.getState().consultation.draft, (s) => getRow(s)?.t);
      return {
        result: {
          formOpen: true,
          draft: described,
          missing: described.missing,
          note: described.missing.length
            ? `Not ready: ${described.missing.join(', ')} still needed. Ask for them; do not offer to send yet.`
            : 'Ready. Confirm the showroom, the date and the pieces in one sentence and ask whether to send the request. Call submitAppointment only after a yes.',
        },
        runningLabel: CONCIERGE.labels.reviewing,
        label: CONCIERGE.labels.review,
        ui: { kind: 'consultation', topic: topicOf(described.occasion?.value) },
        compact: true,
      };
    }

    case 'submitAppointment': {
      if (args.confirmed !== true) {
        return { result: { error: 'NOT_CONFIRMED', message: 'ask the visitor whether to send the request; call again with confirmed true only after they say yes' }, label: '' };
      }
      // the draft can say no before the form has to; the form's own validation still runs
      const early = missingFields(site.consultation.draft);
      if (early.length && !site.consultation.open) {
        site.openConsultation({ topic: topicOf(site.consultation.draft?.occasion), productSlug: ctx.currentProduct?.slug, source: 'concierge' });
        return { result: { error: 'INCOMPLETE', missing: early, note: 'The form is open. Ask for the missing details, then review and confirm again.' }, label: CONCIERGE.labels.missing, ui: { kind: 'consultation' }, compact: true };
      }
      if (!site.consultation.open) site.openConsultation({ topic: topicOf(site.consultation.draft?.occasion), productSlug: ctx.currentProduct?.slug, source: 'concierge' });
      const nonce = useSiteStore.getState().requestConsultationSubmit();
      const outcome = await awaitOutcome(nonce);
      if (!outcome) return { result: { error: 'NO_ANSWER', message: 'the form did not answer; ask the visitor to press the button themselves' }, label: '' };
      if (outcome.status === 'invalid') {
        // no missing field and still refused: the form is not at its fields — it already shows an acknowledgement
        if (!outcome.missing?.length) {
          return { result: { error: 'FORM_NOT_READY', message: 'the form is not showing its fields; it may already show an acknowledgement. Ask the visitor to close it and begin a new request if they want another.' }, label: '' };
        }
        return { result: { error: 'INCOMPLETE', missing: outcome.missing, note: 'The form shows what is missing. Ask for it, then review and confirm again.' }, label: CONCIERGE.labels.missing, ui: { kind: 'consultation' }, compact: true };
      }
      const reference = outcome.reference ?? '';
      // no provider books anything today; a reference is not a booking, and the result says so
      const booked = false;
      if (outcome.status === 'delivered') {
        return {
          result: { status: 'delivered', reference, transmitted: true, booked, note: `Sent. Say: the request has been sent with reference ${reference}, and our team will confirm the time. Never say booked or confirmed.` },
          runningLabel: CONCIERGE.labels.sending,
          label: CONCIERGE.labels.delivered(reference),
          ui: { kind: 'consultation' },
          compact: true,
        };
      }
      if (outcome.status === 'failed') {
        return {
          result: { status: 'failed', reference, transmitted: false, booked, whatsappHref: outcome.whatsappHref ?? null, note: `Not delivered. Say plainly that the request did not reach our team, that it is kept on this device under reference ${reference}, and that WhatsApp is the way to send it.` },
          runningLabel: CONCIERGE.labels.sending,
          label: CONCIERGE.labels.notSent(reference),
          ui: { kind: 'consultation' },
          compact: true,
        };
      }
      return {
        result: {
          status: 'prepared',
          reference,
          transmitted: false,
          booked,
          whatsappHref: outcome.whatsappHref ?? null,
          note: `Nothing was sent. Say: the request is prepared with reference ${reference}, and sending it on WhatsApp is the next step. Never say booked, confirmed or received.`,
        },
        runningLabel: CONCIERGE.labels.sending,
        label: CONCIERGE.labels.prepared(reference),
        ui: { kind: 'consultation' },
        compact: true,
      };
    }

    case 'getCurrentContext': {
      const described = describeDraft(site.consultation.draft, (s) => getRow(s)?.t);
      return {
        result: {
          // first, so the result's key budget on the model path never trims them
          appointment: { open: site.consultation.open, draft: described, missing: described.missing },
          ...ctx,
        },
        label: '',
      };
    }

    default:
      return { result: { error: `Unknown tool ${String(name)}` }, label: '' };
  }
}

export { useConciergeStore };
