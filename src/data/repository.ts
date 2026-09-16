import type { Category, Department, Product } from './types';
import { PRODUCTS, LISTABLE_PRODUCTS, CATALOGUE_DATE } from './products';
import { searchCatalogue, similarTo, type SearchQuery } from './search';
import { complementsOf } from '@/lib/relations';
import { nameOf, CATEGORY_PLURAL, DEPARTMENT_LABEL } from './labels';
import { bandOf, matchesFacets, type Facetable, type PieceRow, type Showcase, type ShowcaseCategory, type ShowcaseDepartment, type SortKey, type WallCut } from '@/lib/facets';

/**
 * The seam every page, route and tool reads the catalogue through.
 *
 * Nothing above this line imports the snapshot. That matters more than it looks: pages
 * written directly against generated data would have to be rewritten the day the source
 * changes, and every call site is `await`-shaped here precisely so a live adapter can take
 * this interface without touching a single page.
 *
 * `SnapshotRepository` is synchronous underneath and wraps in `Promise.resolve`, so the
 * shape costs nothing at runtime today.
 */

export interface FacetQuery {
  category?: Category;
  material?: string;
  purity?: string;
  /** A band key from `@/lib/facets` — the same bands the drawer and the audit use. */
  weight?: string;
  occasion?: string;
  campaign?: string;
  sort?: SortKey;
  offset?: number;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export type FacetCounts = Record<string, Record<string, number>>;

export interface CatalogueRepository {
  readonly source: 'snapshot' | 'live';
  readonly generatedAt: string;
  getProduct(slug: string): Promise<Product | undefined>;
  getProducts(slugs: readonly string[]): Promise<Product[]>;
  listDepartment(department: Department, q?: FacetQuery): Promise<Page<Product>>;
  listCategory(department: Department, category: Category, q?: FacetQuery): Promise<Page<Product>>;
  search(q: SearchQuery): Promise<Product[]>;
  similar(slug: string, limit?: number): Promise<Product[]>;
  matching(slug: string, limit?: number): Promise<Product[]>;
  setMembers(slug: string): Promise<Product[]>;
  facets(department: Department, q?: FacetQuery): Promise<FacetCounts>;
  /** Listable slugs only — a withheld piece has no page. */
  allSlugs(): Promise<string[]>;
  /** Only departments with enough behind them to open. */
  departments(): Promise<{ department: Department; count: number }[]>;
  /** Only categories with a page of their own, by the same predicate the routes use. */
  categories(department: Department): Promise<{ category: Category; count: number }[]>;
  /** The rows a facet UI runs on, for one department or the whole catalogue. */
  rows(department?: Department): Promise<PieceRow[]>;
  /** The homepage wall's cuts — a fixed layout, a changing set of pieces. */
  wallCuts(perCut?: number): Promise<WallCut[]>;
  /** The homepage's product surfaces: pieces photographed as pieces, with facts, of every kind. */
  showcase(): Promise<Showcase>;
}

/**
 * The wall's cuts are derived, not hand-listed: a hand-listed cut is a slug list that rots
 * the day Waseem withdraws a piece. `WallCut` itself lives in `@/lib/facets`, with the row
 * shape it carries.
 */

/**
 * A department or a category opens only when there is enough behind it to be worth walking
 * into. The routes, the menu and the category line all consume the same predicate, so a
 * destination that does not exist can be neither linked nor reached.
 */
export const DEPARTMENT_MIN = 12;
export const CATEGORY_MIN = 12;

/**
 * A piece, reduced to what an index needs.
 *
 * Projected from the merged catalogue rather than the generated snapshot, because the two
 * disagree exactly where it matters: the ten authored pieces carry an editor's slug and an
 * editor's name, and seven of them are listable only because an editor supplied the name
 * the shop had not. A row built from the snapshot would link them all to nothing.
 */
const rowOf = (p: Product): PieceRow => ({
  s: p.slug,
  t: nameOf(p),
  rf: p.reference,
  d: p.departments,
  c: p.category,
  m: p.material,
  k: p.spec.purity,
  w: p.spec.grossWeightGrams,
  ct: p.spec.diamondCarat,
  o: p.occasions,
  cp: p.campaignSlug,
  p: p.price.kind === 'fixed' ? p.price.pkr : 0,
  h: p.media.hero.ref.kind === 'local' ? p.media.hero.ref.id : p.media.hero.ref.src,
  hw: p.media.hero.ref.kind === 'remote' ? p.media.hero.ref.width : undefined,
  hh: p.media.hero.ref.kind === 'remote' ? p.media.hero.ref.height : undefined,
  r: p.media.hero.role,
});

/** The same projection, for a caller that already holds products. */
export const toRow = rowOf;

const facetableOf = (p: Product): Facetable => ({
  category: p.category,
  material: p.material,
  purity: p.spec.purity,
  weightGrams: p.spec.grossWeightGrams,
  occasions: p.occasions,
  campaign: p.campaignSlug,
});

/** No price sort: sixteen of 656 carry a price, so it would sort noise. */
function order(items: Product[], sort: FacetQuery['sort']): Product[] {
  const by = [...items];
  switch (sort) {
    case 'weight-asc':
      return by.sort((a, b) => (a.spec.grossWeightGrams ?? Infinity) - (b.spec.grossWeightGrams ?? Infinity));
    case 'weight-desc':
      return by.sort((a, b) => (b.spec.grossWeightGrams ?? -1) - (a.spec.grossWeightGrams ?? -1));
    case 'carat-desc':
      return by.sort((a, b) => (b.spec.diamondCarat ?? -1) - (a.spec.diamondCarat ?? -1));
    default:
      // authored rank first, then how much is known about a piece, so the best-served lead
      return by.sort((a, b) => {
        const rank = (a.featuredRank ?? 999) - (b.featuredRank ?? 999);
        if (rank !== 0) return rank;
        const tier = { flagship: 0, catalogue: 1, thin: 2 };
        return tier[a.completeness.tier] - tier[b.completeness.tier];
      });
  }
}

const page = <T>(items: T[], q: FacetQuery = {}): Page<T> => {
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 24;
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
};

const tally = (items: Product[], get: (p: Product) => string | string[] | undefined) => {
  const m: Record<string, number> = {};
  for (const p of items) for (const v of [get(p)].flat()) if (v) m[v] = (m[v] ?? 0) + 1;
  return m;
};

class SnapshotRepository implements CatalogueRepository {
  readonly source = 'snapshot' as const;
  readonly generatedAt = CATALOGUE_DATE;

  private readonly bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));

  async getProduct(slug: string) {
    return this.bySlug.get(slug);
  }

  async getProducts(slugs: readonly string[]) {
    return slugs.map((s) => this.bySlug.get(s)).filter((p): p is Product => Boolean(p));
  }

  private inDepartment(d: Department) {
    return LISTABLE_PRODUCTS.filter((p) => p.departments.includes(d));
  }

  async listDepartment(department: Department, q: FacetQuery = {}) {
    return page(order(this.inDepartment(department).filter((p) => matchesFacets(facetableOf(p), q)), q.sort), q);
  }

  async listCategory(department: Department, category: Category, q: FacetQuery = {}) {
    return this.listDepartment(department, { ...q, category });
  }

  async search(q: SearchQuery) {
    return searchCatalogue(q);
  }

  async similar(slug: string, limit = 4) {
    return similarTo(slug, limit);
  }

  /**
   * Complementary categories from the same campaign or department — distinct from `similar`,
   * which finds more of the same kind. Authored `complementary` wins where it exists.
   */
  async matching(slug: string, limit = 4) {
    const anchor = this.bySlug.get(slug);
    if (!anchor) return [];
    if (anchor.complementary.length) return (await this.getProducts(anchor.complementary)).slice(0, limit);
    // the table is shared with the browser's slim rows, so the two can never disagree
    const wanted = complementsOf(anchor.category);
    if (!wanted.size) return [];
    /**
     * A shared *campaign* means two pieces were photographed for the same line. Both being
     * campaign-less means nothing at all, and testing it with `===` said otherwise: 640
     * pieces carry no campaign, so every one of them "shared" one with every other, and a
     * men's bracelet was answered with children's rings.
     */
    const sameCampaign = (p: Product) => anchor.campaignSlug !== undefined && p.campaignSlug === anchor.campaignSlug;
    const sameDepartment = (p: Product) => p.departments.some((d) => anchor.departments.includes(d));
    // lower is nearer: the same line first, then the same department, then the best-served
    const rank = (p: Product) => (sameCampaign(p) ? 0 : 2) + (sameDepartment(p) ? 0 : 4) + (p.completeness.tier === 'flagship' ? 0 : 1);
    return LISTABLE_PRODUCTS.filter((p) => p.slug !== slug && p.category && wanted.has(p.category) && (sameCampaign(p) || sameDepartment(p)))
      .sort((a, b) => rank(a) - rank(b) || (a.featuredRank ?? 999) - (b.featuredRank ?? 999))
      .slice(0, limit);
  }

  async setMembers(slug: string) {
    const anchor = this.bySlug.get(slug);
    if (!anchor?.setId) return [];
    return LISTABLE_PRODUCTS.filter((p) => p.setId === anchor.setId && p.slug !== slug);
  }

  async facets(department: Department, q: FacetQuery = {}) {
    // each facet is counted against the others, so a value that would return nothing is
    // never offered
    const base = this.inDepartment(department);
    const without = (key: keyof FacetQuery) => {
      const rest = { ...q };
      delete rest[key];
      return base.filter((p) => matchesFacets(facetableOf(p), rest));
    };
    return {
      category: tally(without('category'), (p) => p.category),
      material: tally(without('material'), (p) => p.material),
      purity: tally(without('purity'), (p) => p.spec.purity),
      weight: tally(without('weight'), (p) => bandOf(p.spec.grossWeightGrams)),
      occasion: tally(without('occasion'), (p) => p.occasions),
      campaign: tally(without('campaign'), (p) => p.campaignSlug),
    };
  }

  async allSlugs() {
    return LISTABLE_PRODUCTS.map((p) => p.slug);
  }

  async departments() {
    const all: Department[] = ['gold', 'diamond', 'bridal', 'men', 'kids'];
    return all
      .map((department) => ({ department, count: this.inDepartment(department).length }))
      .filter((d) => d.count >= DEPARTMENT_MIN);
  }

  /**
   * A category earns a page of its own only if it clears the floor *and* the department has
   * more than one such category. Bridal is entirely bridal sets, and a page that repeats its
   * own department under a second name is a dead end wearing a heading.
   */
  async categories(department: Department) {
    const counts = tally(this.inDepartment(department), (p) => p.category);
    const qualifying = Object.entries(counts)
      .filter(([, n]) => n >= CATEGORY_MIN)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category: category as Category, count }));
    return qualifying.length > 1 ? qualifying : [];
  }

  async rows(department?: Department) {
    const from = department ? this.inDepartment(department) : LISTABLE_PRODUCTS;
    /**
     * Featured order, not file order.
     *
     * The browser's index inherits whatever sequence this returns, and everything downstream
     * of it — the concierge's four results, the ledger, the story — reads the head of that
     * sequence. Unordered, "show me a gold ring" answered with children's rings, because they
     * happened to come first in the catalogue.
     */
    return order(from, 'featured').map(rowOf);
  }

  /**
   * What a window shows: the piece, not the model. A photograph of a piece on a plain ground
   * with its purity and weight published is the only thing that qualifies, and one of every
   * kind is chosen in the order a jeweller lays a window — the heavy gold first, then the
   * stones. Authored rank leads within a kind, then how much is published about the piece.
   */
  async showcase(): Promise<Showcase> {
    const shown = (p: Product) => p.media.hero.role === 'packshot' && Boolean(p.spec.grossWeightGrams || p.spec.purity) && (p.media.hero.ref.kind === 'local' || (p.media.hero.ref.width ?? 0) >= 1800);
    const pool = order(LISTABLE_PRODUCTS.filter(shown), 'featured');
    const byKind = new Map<Category, Product[]>();
    for (const p of pool) if (p.category) byKind.set(p.category, [...(byKind.get(p.category) ?? []), p]);

    const WINDOW: [Category, Department | undefined][] = [
      ['bangle', 'gold'],
      ['necklace', 'gold'],
      ['ring', 'diamond'],
      ['earrings', 'gold'],
      ['bridal-set', undefined],
      ['pendant', 'diamond'],
      ['bracelet', 'gold'],
      ['chain', 'gold'],
      ['ring', 'gold'],
      ['cufflink', 'men'],
      ['pendant', 'gold'],
    ];
    const used = new Set<string>();
    const take = (category: Category, department?: Department) => {
      const p = (byKind.get(category) ?? []).find((x) => !used.has(x.slug) && (!department || x.departments.includes(department)));
      if (p) used.add(p.slug);
      return p;
    };
    const window = WINDOW.map(([c, d]) => take(c, d)).filter((p): p is Product => Boolean(p)).map(rowOf);

    // a kind's door is the department page where it is largest; the count is the whole catalogue's
    const departments = await this.departments();
    const perDepartment = await Promise.all(departments.map(async ({ department }) => ({ department, categories: await this.categories(department) })));
    const categories: ShowcaseCategory[] = [];
    const totals = tally(LISTABLE_PRODUCTS, (p) => p.category);
    // a kind's door and its face come from the first department, in the order the shop is
    // walked, that has a page for it: rings are fronted by a gold ring, not a child's
    const WALK: Department[] = ['gold', 'diamond', 'men', 'kids'];
    for (const [category, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
      const home = WALK.find((department) => perDepartment.find((d) => d.department === department)?.categories.some((c) => c.category === category));
      const hero = byKind.get(category as Category)?.find((p) => !home || p.departments.includes(home));
      if (!hero || !home) continue;
      categories.push({ category, label: CATEGORY_PLURAL[category as Category], total, href: `/${home}/${category}`, hero: rowOf(hero) });
    }

    // the kind that leads each tray: what reads largest on a plate, then the rest in the order a
    // counter is laid — the department's own kinds follow in size order after these
    const LEAD: Record<Department, Category[]> = {
      gold: ['bangle', 'necklace', 'bracelet', 'earrings', 'pendant', 'chain', 'ring'],
      diamond: ['ring', 'necklace', 'pendant', 'earrings', 'bracelet', 'bangle', 'nose-pin', 'chain'],
      bridal: ['bridal-set', 'necklace', 'earrings'],
      men: ['bracelet', 'ring', 'cufflink'],
      kids: ['bracelet', 'ring'],
    };
    const showcaseDepartments: ShowcaseDepartment[] = perDepartment.map(({ department, categories: cats }) => {
      const inD = pool.filter((p) => p.departments.includes(department));
      // one kind after another, so six pieces are six kinds where the department has them
      const lanes = new Map<string, Product[]>();
      for (const p of inD) lanes.set(p.category ?? '', [...(lanes.get(p.category ?? '') ?? []), p]);
      const rows: Product[] = [];
      const lead = LEAD[department];
      const order_ = [...lanes.keys()].sort((a, b) => {
        const ia = lead.indexOf(a as Category);
        const ib = lead.indexOf(b as Category);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return (lanes.get(b)?.length ?? 0) - (lanes.get(a)?.length ?? 0);
      });
      for (let i = 0; rows.length < 8 && i < 8; i++) for (const k of order_) {
        const p = lanes.get(k)?.[i];
        if (p && rows.length < 8) rows.push(p);
      }
      const count = this.inDepartment(department).length;
      return {
        department,
        label: DEPARTMENT_LABEL[department],
        count,
        rows: rows.map(rowOf),
        categories: cats.map((c) => ({ category: c.category, label: CATEGORY_PLURAL[c.category], count: c.count, href: `/${department}/${c.category}` })),
      };
    });

    return { window, categories, departments: showcaseDepartments };
  }

  async wallCuts(perCut = 10) {
    const cuts: WallCut[] = [{ id: 'selected', label: 'Selected', rows: order(LISTABLE_PRODUCTS, 'featured').slice(0, perCut).map(rowOf) }];
    for (const { department } of await this.departments()) {
      const inD = order(this.inDepartment(department), 'featured');
      // a cut that cannot fill the composition would leave holes in it
      if (inD.length < perCut) continue;
      cuts.push({ id: department, label: DEPARTMENT_LABEL[department], rows: inD.slice(0, perCut).map(rowOf) });
    }
    return cuts;
  }
}

let instance: CatalogueRepository | null = null;

/**
 * `CATALOGUE_SOURCE` selects the implementation. Only `snapshot` exists today; a live
 * adapter drops in here without a page changing.
 */
export function getRepository(): CatalogueRepository {
  instance ??= new SnapshotRepository();
  return instance;
}
