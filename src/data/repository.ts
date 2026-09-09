import type { Category, Department, Product } from './types';
import { PRODUCTS, LISTABLE_PRODUCTS, CATALOGUE_DATE } from './products';
import { searchCatalogue, similarTo, type SearchQuery } from './search';
import { nameOf } from './labels';
import { bandOf, matchesFacets, type Facetable, type PieceRow, type SortKey } from '@/lib/facets';

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
}

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
    const COMPLEMENT: Partial<Record<Category, Category[]>> = {
      necklace: ['earrings', 'ring', 'bangle', 'tikka'],
      earrings: ['necklace', 'ring', 'pendant'],
      ring: ['earrings', 'pendant', 'bracelet'],
      bangle: ['necklace', 'earrings', 'ring'],
      bracelet: ['ring', 'pendant', 'earrings'],
      pendant: ['chain', 'earrings', 'ring'],
      chain: ['pendant'],
      'bridal-set': ['ring', 'bangle', 'tikka'],
      'nose-pin': ['earrings', 'ring', 'pendant'],
      cufflink: ['ring', 'bracelet'],
      tikka: ['necklace', 'earrings', 'nath'],
      nath: ['tikka', 'earrings', 'necklace'],
    };
    const wanted = new Set(anchor.category ? (COMPLEMENT[anchor.category] ?? []) : []);
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
    return from.map(rowOf);
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
