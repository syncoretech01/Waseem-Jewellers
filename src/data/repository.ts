import type { Category, Department, Product } from './types';
import { PRODUCTS, LISTABLE_PRODUCTS, CATALOGUE_DATE } from './products';
import { searchCatalogue, similarTo, type SearchQuery } from './search';

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
  /** Inclusive lower bound, exclusive upper, in grams. */
  weight?: [number, number];
  occasion?: string;
  campaign?: string;
  sort?: 'featured' | 'newest' | 'weight-asc' | 'weight-desc' | 'carat-desc';
  offset?: number;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface FacetCounts {
  category: Record<string, number>;
  material: Record<string, number>;
  purity: Record<string, number>;
  weight: Record<string, number>;
  occasion: Record<string, number>;
  campaign: Record<string, number>;
}

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
  departments(): Promise<{ department: Department; count: number }[]>;
}

const WEIGHT_BANDS: Record<string, [number, number]> = {
  '<5': [0, 5],
  '5-15': [5, 15],
  '15-30': [15, 30],
  '30-60': [30, 60],
  '60+': [60, Infinity],
};

const bandOf = (g?: number) => (g === undefined ? undefined : Object.entries(WEIGHT_BANDS).find(([, [lo, hi]]) => g >= lo && g < hi)?.[0]);

function matches(p: Product, q: FacetQuery): boolean {
  if (q.category && p.category !== q.category) return false;
  if (q.material && p.material !== q.material) return false;
  if (q.purity && p.spec.purity !== q.purity) return false;
  if (q.occasion && !p.occasions.includes(q.occasion as Product['occasions'][number])) return false;
  if (q.campaign && p.campaignSlug !== q.campaign) return false;
  if (q.weight) {
    const g = p.spec.grossWeightGrams;
    if (g === undefined || g < q.weight[0] || g >= q.weight[1]) return false;
  }
  return true;
}

/** No price sort: only 2% of the catalogue carries one, so it would sort noise. */
function order(items: Product[], sort: FacetQuery['sort']): Product[] {
  const by = [...items];
  switch (sort) {
    case 'weight-asc':
      return by.sort((a, b) => (a.spec.grossWeightGrams ?? Infinity) - (b.spec.grossWeightGrams ?? Infinity));
    case 'weight-desc':
      return by.sort((a, b) => (b.spec.grossWeightGrams ?? -1) - (a.spec.grossWeightGrams ?? -1));
    case 'carat-desc':
      return by.sort((a, b) => (b.spec.diamondCarat ?? -1) - (a.spec.diamondCarat ?? -1));
    case 'newest':
      return by;
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
    return page(order(this.inDepartment(department).filter((p) => matches(p, q)), q.sort), q);
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
   * Complementary categories from the same campaign or set — distinct from `similar`,
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
    };
    const wanted = new Set(anchor.category ? (COMPLEMENT[anchor.category] ?? []) : []);
    if (!wanted.size) return [];
    return LISTABLE_PRODUCTS.filter(
      (p) =>
        p.slug !== slug &&
        p.category &&
        wanted.has(p.category) &&
        (p.campaignSlug === anchor.campaignSlug || p.departments.some((d) => anchor.departments.includes(d))),
    )
      .sort((a, b) => (a.completeness.tier === 'flagship' ? -1 : 0) - (b.completeness.tier === 'flagship' ? -1 : 0))
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
      return base.filter((p) => matches(p, rest));
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
    return all.map((department) => ({ department, count: this.inDepartment(department).length }));
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

export const WEIGHT_BAND_RANGES = WEIGHT_BANDS;
