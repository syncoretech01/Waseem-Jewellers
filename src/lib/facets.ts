import type { Category, Department, Material, MediaRole, Occasion } from '@/data/types';
import { CATEGORY_LABEL, CATEGORY_PLURAL, DEPARTMENT_LABEL, MATERIAL_LABEL, OCCASION_LABEL, campaignLabel } from '@/data/labels';

/**
 * Faceted discovery, and the one place its rules live.
 *
 * The URL is the state. Every control writes a query string and the view is read back from
 * it, so a reload, a pasted link, the back button and a link the concierge emits all land on
 * the same page. Nothing here touches the DOM or the catalogue, so the department page, the
 * search page and the repository can all share it.
 *
 * Weight is a real axis in this market and the best-covered specification Waseem publishes
 * (583 of 656). Price is not an axis at all: sixteen products carry one.
 */

export type SortKey = 'featured' | 'weight-asc' | 'weight-desc' | 'carat-desc';

export const SORT_LABEL: Record<SortKey, string> = {
  featured: 'Featured',
  'weight-asc': 'Lightest first',
  'weight-desc': 'Heaviest first',
  'carat-desc': 'Most diamond',
};

/**
 * There is deliberately no "newest". The shop publishes no date this catalogue keeps, and a
 * sort that quietly returns the file's own order while calling itself newest is a lie in the UI.
 */

export const WEIGHT_BANDS: Record<string, [number, number]> = {
  '<5': [0, 5],
  '5-15': [5, 15],
  '15-30': [15, 30],
  '30-60': [30, 60],
  '60+': [60, Infinity],
};

export const WEIGHT_BAND_ORDER = ['<5', '5-15', '15-30', '30-60', '60+'] as const;

export const WEIGHT_BAND_LABEL: Record<string, string> = {
  '<5': 'Under 5 g',
  '5-15': '5 – 15 g',
  '15-30': '15 – 30 g',
  '30-60': '30 – 60 g',
  '60+': 'Over 60 g',
};

export const bandOf = (g?: number): string | undefined =>
  g === undefined ? undefined : WEIGHT_BAND_ORDER.find((k) => g >= WEIGHT_BANDS[k]![0] && g < WEIGHT_BANDS[k]![1]);

/** The facet keys, in the order they are offered. Kind leads, because it is what a visitor came for. */
export const FACET_KEYS = ['category', 'material', 'purity', 'weight', 'occasion', 'campaign'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export const FACET_LABEL: Record<FacetKey, string> = {
  category: 'Kind',
  material: 'Material',
  purity: 'Purity',
  weight: 'Weight',
  occasion: 'Occasion',
  campaign: 'Collection',
};

export interface FacetState {
  category?: string;
  material?: string;
  purity?: string;
  weight?: string;
  occasion?: string;
  campaign?: string;
  sort: SortKey;
  /** How many pieces the ledger has revealed. A multiple of PAGE, and shareable. */
  shown: number;
}

export const PAGE = 24;

export const EMPTY_FACETS: FacetState = { sort: 'featured', shown: PAGE };

/**
 * The shape both tiers of data satisfy: the repository adapts a full `Product`, the browser
 * adapts a slim row. One predicate, two adapters — so a facet can never mean one thing on
 * the server and another in the drawer.
 */
export interface Facetable {
  category?: string;
  material?: string;
  purity?: string;
  weightGrams?: number;
  occasions: readonly string[];
  campaign?: string;
}

/**
 * The wire format between a department page and its index: one row per listable piece,
 * short keys, everything a grid cell and a facet count need and nothing else — about a
 * hundred bytes apiece, so a department of 267 costs the payload some 30 kB.
 *
 * The repository projects these from the *merged* catalogue, never from the generated
 * snapshot: a piece Waseem has not named is withheld, and a piece an editor has named
 * carries that name and that slug. A row built from the snapshot alone would link ten
 * pieces to slugs that no longer exist.
 */
export interface PieceRow {
  /** slug */ s: string;
  /** name — authored where one exists, otherwise as published */ t: string;
  /** item code, where Waseem publishes one — the only thing telling two "Gold Pendant"s apart */ rf?: string;
  /** departments */ d: string[];
  /** category */ c?: string;
  /** material */ m?: string;
  /** purity */ k?: string;
  /** gross weight, grams */ w?: number;
  /** diamond carat */ ct?: number;
  /** occasions */ o: string[];
  /** campaign */ cp?: string;
  /** price in PKR, 0 when on request */ p: number;
  /** hero: an asset id when local, a source url when remote */ h: string;
  /** hero width, remote only */ hw?: number;
  /** hero height, remote only */ hh?: number;
  /** hero role — a scene is shown full-bleed, a cut-out is mounted */ r: MediaRole;
}

/**
 * A named set of pieces the wall can show. It lives here rather than with the repository
 * because it is a shape the browser holds, and importing it from a server module would drag
 * the catalogue's ban across a type-only import.
 */
export interface WallCut {
  id: string;
  label: string;
  rows: PieceRow[];
}

/**
 * The homepage's product surfaces, chosen the way a jeweller dresses a window: pieces
 * photographed as pieces (never a portrait), each with its purity and weight published, one
 * of every kind. Every count is the site's own — the number a visitor finds when they walk
 * through the door.
 */
export interface ShowcaseCategory {
  category: string;
  label: string;
  /** the pieces of the kind behind the door — the count the page it opens will show */
  total: number;
  /** the department page the kind opens on: the first, in the order the shop is walked, that has a page for it */
  href: string;
  /** the piece that fronts the kind */
  hero: PieceRow;
  /** a second piece of the kind, shown under the hand */
  alt?: PieceRow;
  /** a local asset that fronts the kind instead of the hero's own photograph — a jewellery-only crop of it */
  image?: string;
}
export interface ShowcaseDepartment {
  department: string;
  label: string;
  count: number;
  /** pieces photographed as pieces, one kind after another */
  rows: PieceRow[];
  categories: { category: string; label: string; count: number; href: string }[];
}
export interface Showcase {
  window: PieceRow[];
  categories: ShowcaseCategory[];
  departments: ShowcaseDepartment[];
}

export const fromRow = (r: PieceRow): Facetable => ({
  category: r.c,
  material: r.m,
  purity: r.k,
  weightGrams: r.w,
  occasions: r.o,
  campaign: r.cp,
});

export function matchesFacets(item: Facetable, f: Partial<FacetState>): boolean {
  if (f.category && item.category !== f.category) return false;
  if (f.material && item.material !== f.material) return false;
  if (f.purity && item.purity !== f.purity) return false;
  if (f.occasion && !item.occasions.includes(f.occasion)) return false;
  if (f.campaign && item.campaign !== f.campaign) return false;
  if (f.weight) {
    const band = WEIGHT_BANDS[f.weight];
    if (!band) return false;
    const g = item.weightGrams;
    if (g === undefined || g < band[0] || g >= band[1]) return false;
  }
  return true;
}

export const valueOf = (item: Facetable, key: FacetKey): string | readonly string[] | undefined =>
  key === 'weight' ? bandOf(item.weightGrams) : key === 'occasion' ? item.occasions : item[key];

/**
 * Each facet is counted against every *other* facet, so a value that would return nothing is
 * never offered. That is the difference between a filter that helps and one that dead-ends.
 */
export function facetCounts<T extends Facetable>(items: readonly T[], f: Partial<FacetState>): Record<FacetKey, Record<string, number>> {
  const out = Object.fromEntries(FACET_KEYS.map((k) => [k, {} as Record<string, number>])) as Record<FacetKey, Record<string, number>>;
  for (const key of FACET_KEYS) {
    const rest: Partial<FacetState> = { ...f };
    delete rest[key];
    for (const item of items) {
      if (!matchesFacets(item, rest)) continue;
      for (const v of [valueOf(item, key)].flat()) if (v) out[key][v] = (out[key][v] ?? 0) + 1;
    }
  }
  return out;
}

export function sortRows<T extends { w?: number; ct?: number }>(rows: readonly T[], sort: SortKey): T[] {
  const by = [...rows];
  switch (sort) {
    // a piece with no published weight sorts last either way — it is not light, it is unstated
    case 'weight-asc':
      return by.sort((a, b) => (a.w ?? Infinity) - (b.w ?? Infinity));
    case 'weight-desc':
      return by.sort((a, b) => (b.w ?? -1) - (a.w ?? -1));
    case 'carat-desc':
      return by.sort((a, b) => (b.ct ?? -1) - (a.ct ?? -1));
    default:
      return by;
  }
}

// ── the URL ─────────────────────────────────────────────────────────────────

const isSort = (s: string | null): s is SortKey => s !== null && s in SORT_LABEL;

export function parseFacets(search: string | URLSearchParams): FacetState {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const get = (k: FacetKey) => p.get(k) ?? undefined;
  const shown = Number(p.get('shown'));
  const sort = p.get('sort');
  return {
    category: get('category'),
    material: get('material'),
    purity: get('purity'),
    weight: get('weight'),
    occasion: get('occasion'),
    campaign: get('campaign'),
    sort: isSort(sort) ? sort : 'featured',
    shown: Number.isFinite(shown) && shown >= PAGE ? Math.min(Math.ceil(shown / PAGE) * PAGE, 2000) : PAGE,
  };
}

/** Keeps every other parameter an arrival carried (`?world=`, `?ref=`) rather than dropping it. */
export function serialiseFacets(f: FacetState, keep?: string | URLSearchParams): string {
  const p = new URLSearchParams(typeof keep === 'string' ? keep : (keep ?? ''));
  for (const k of FACET_KEYS) {
    const v = f[k];
    if (v) p.set(k, v);
    else p.delete(k);
  }
  if (f.sort === 'featured') p.delete('sort');
  else p.set('sort', f.sort);
  if (f.shown <= PAGE) p.delete('shown');
  else p.set('shown', String(f.shown));
  return p.toString();
}

export const activeCount = (f: FacetState) => FACET_KEYS.filter((k) => f[k]).length;

/**
 * Parameters from a shape of the site that no longer exists.
 *
 * `?edit=gold` was Stage 1's curated view of the bridal collection. The config redirect
 * sends those links to the department they meant, but Next forwards the source query to the
 * destination whether it matched or not, so the dead parameter arrives with them. It means
 * nothing here, and left alone it would ride along through every facet a visitor then
 * touched, so the page clears it once on arrival.
 */
const RETIRED_PARAMS = ['edit'];

export function stripRetired(search: string): string | null {
  const p = new URLSearchParams(search);
  if (!RETIRED_PARAMS.some((k) => p.has(k))) return null;
  for (const k of RETIRED_PARAMS) p.delete(k);
  return p.toString();
}

/**
 * A facet value named the way a person would say it. Kind is the exception: it is
 * pluralised, because in a sentence about a set of pieces "rings" is what you would write.
 *
 * Nothing here is case-folded by its caller. `21K` is how Waseem writes the purity and how a
 * jeweller says it; lower-casing it to fit a sentence turns a specification into a typo.
 */
export function facetValueLabel(key: FacetKey, value: string, plural = false): string {
  if (key === 'category') {
    const table = plural ? CATEGORY_PLURAL : CATEGORY_LABEL;
    return table[value as Category] ?? value;
  }
  if (key === 'material') return MATERIAL_LABEL[value as Material] ?? value;
  if (key === 'weight') return WEIGHT_BAND_LABEL[value] ?? value;
  if (key === 'occasion') return OCCASION_LABEL[value as Occasion] ?? value;
  if (key === 'campaign') return campaignLabel(value);
  return value;
}

/**
 * The applied facets read back as a line of prose rather than a row of chips —
 * "Gold · rings · 21K · 15 – 30 g · 42 pieces". It is the heading and the removable control
 * at once, which is why the drawer can stay shut.
 */
export function facetPhrases(f: FacetState): { key: FacetKey; value: string; label: string }[] {
  return FACET_KEYS.flatMap((key) => {
    const value = f[key];
    return value ? [{ key, value, label: facetValueLabel(key, value, key === 'category') }] : [];
  });
}

/** The page's own title, honest about how many pieces stand behind it. */
export function facetTitle(department: Department | undefined, f: FacetState, total: number, exclude?: FacetKey): string {
  const parts = [
    department ? DEPARTMENT_LABEL[department] : 'Jewellery',
    ...facetPhrases(f)
      .filter((p) => p.key !== exclude)
      .map((p) => p.label),
  ];
  return `${parts.join(' · ')} · ${total} ${total === 1 ? 'piece' : 'pieces'}`;
}
