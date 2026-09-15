import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/safeStorage';

/** Where a piece was kept from — the one thing a jeweller ringing back would want to know. */
export type SelectionSource = 'page' | 'concierge' | 'ledger' | 'migrated';

export interface SelectionEntry {
  slug: string;
  /** Epoch ms, or 0 for an entry carried over from v1, where the time was never recorded. */
  addedAt: number;
  source: SelectionSource;
}

/** Past forty it has stopped being a selection. Oldest goes first. */
const SELECTION_MAX = 40;

/**
 * Writes the ledger and the slug list together, so they cannot disagree.
 *
 * `wishlist` is derived, not stored — every existing caller reads it, and keeping it as a
 * second source of truth is how one of them ends up rendering a piece the other removed.
 */
const V1 = 'wj:selection:v1';
const V2 = 'wj:selection:v2';

/**
 * Carries a v1 selection across to v2, once, before anything reads either.
 *
 * The version lives in the key name, so zustand looks only under the new one, finds nothing,
 * and `migrate` is never called — a returning visitor would have lost their whole selection on
 * the deploy meant to preserve it. Doing it inside the storage adapter was not enough either:
 * with `skipHydration` the store can persist an empty v2 before rehydration reads anything, and
 * the fallback then finds that empty record instead of the real v1 one. So this runs first,
 * explicitly, and the ordering is the fix.
 *
 * Entries already in v2 win; v1 only contributes slugs that are not there. `addedAt` is 0
 * because v1 never recorded when a piece was kept, and inventing a time would be worse than
 * admitting the gap.
 */
export function migrateSelectionStorage(): void {
  const old = safeStorage.getItem(V1);
  if (old === null) return;
  try {
    const parsed = JSON.parse(old) as { state?: { wishlist?: unknown }; wishlist?: unknown };
    const raw = parsed.state?.wishlist ?? parsed.wishlist;
    const slugs = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
    const currentRaw = safeStorage.getItem(V2);
    const current = currentRaw ? ((JSON.parse(currentRaw) as { state?: { selection?: SelectionEntry[] } }).state?.selection ?? []) : [];
    const have = new Set(current.map((e) => e.slug));
    const merged = [...current, ...slugs.filter((s) => !have.has(s)).map((slug) => ({ slug, addedAt: 0, source: 'migrated' as const }))];
    safeStorage.setItem(V2, JSON.stringify({ state: { selection: merged }, version: 2 }));
  } catch {
    /* a malformed old record is not worth failing a page load over */
  }
  safeStorage.removeItem(V1);
}

const withSelection = (entries: SelectionEntry[]) => {
  const capped = entries.length > SELECTION_MAX ? entries.slice(entries.length - SELECTION_MAX) : entries;
  return { selection: capped, wishlist: capped.map((e) => e.slug) };
};

export type RouteKind = 'home' | 'collection' | 'department' | 'product' | 'other';

export type SectionId =
  | 'loader'
  | 'hero'
  | 'vitrine'
  | 'craft'
  | 'heritage'
  | 'collections'
  | 'bridal'
  | 'bridal-close'
  | 'wall'
  | 'slider'
  | 'duality'
  | 'bespoke'
  | 'footer'
  | 'collection-opening'
  | 'collection-intro'
  | 'department'
  | 'pieces'
  | 'gallery'
  | 'details'
  | 'related';

export interface ConsultationContext {
  open: boolean;
  topic?: 'bridal' | 'bespoke' | 'viewing' | 'general';
  productSlug?: string;
  productSlugs?: string[];
  source?: 'concierge' | 'cta' | 'menu' | 'ledger';
  /**
   * What the visitor said they wanted to spend, carried across from the conversation.
   *
   * All but seventeen pieces are priced on request, so a budget almost never produces a
   * filtered result — but it is the most useful thing a jeweller can be told before ringing
   * back, and losing it at the form boundary means the visitor is asked for it twice.
   */
  budgetPkr?: number;
}

export interface SiteState {
  route: string;
  routeKind: RouteKind;
  pathname: string;
  search: string;
  navEpoch: number;
  section: SectionId | null;
  currentProduct: string | null;
  focusedProduct: string | null;
  visibleProducts: string[];
  selectedCollection: string | null;
  selectedWorld: string | null;
  /** What the visitor has kept, with when and from where. */
  selection: SelectionEntry[];
  /** The slugs alone — every existing caller reads this. */
  wishlist: string[];
  lastOpenedProduct: string | null;
  menuOpen: boolean;
  ledgerOpen: boolean;
  consultation: ConsultationContext;
  spotlight: { slug: string; token: number } | null;
  dualityBias: 'gold' | 'diamond' | null;
  pendingSection: SectionId | null;
  pendingSpotlight: string | null;
  videoPaused: boolean;
  heroInvitationVisible: boolean;
  loaderDone: boolean;
  hydrated: boolean;

  setRoute: (pathname: string, search: string) => void;
  setSection: (id: SectionId | null) => void;
  setCurrentProduct: (slug: string | null) => void;
  setFocusedProduct: (slug: string | null) => void;
  setVisibleProducts: (slugs: string[]) => void;
  setSelectedCollection: (slug: string | null) => void;
  setSelectedWorld: (slug: string | null) => void;
  addToWishlist: (slug: string, source?: SelectionSource) => void;
  removeFromWishlist: (slug: string) => void;
  toggleWishlist: (slug: string, source?: SelectionSource) => void;
  /** Drops entries the catalogue no longer carries. See `pruneSelection` below. */
  pruneSelection: (exists: (slug: string) => boolean) => void;
  setLastOpenedProduct: (slug: string | null) => void;
  openMenu: () => void;
  closeMenu: () => void;
  openLedger: () => void;
  closeLedger: () => void;
  openConsultation: (ctx?: Omit<ConsultationContext, 'open'>) => void;
  closeConsultation: () => void;
  requestSpotlight: (slug: string) => void;
  clearSpotlight: () => void;
  setDualityBias: (bias: 'gold' | 'diamond' | null) => void;
  setPendingSection: (id: SectionId | null) => void;
  setPendingSpotlight: (slug: string | null) => void;
  setVideoPaused: (paused: boolean) => void;
  setHeroInvitationVisible: (visible: boolean) => void;
  setLoaderDone: (done: boolean) => void;
  setHydrated: () => void;
}

/** The five department roots, as paths. Kept here so route classification needs no data import. */
const DEPARTMENT_PATHS = ['/gold', '/diamond', '/bridal', '/men', '/kids'];

export function routeKindOf(pathname: string): RouteKind {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/collections/')) return 'collection';
  if (pathname.startsWith('/jewellery/')) return 'product';
  if (DEPARTMENT_PATHS.some((d) => pathname === d || pathname.startsWith(`${d}/`))) return 'department';
  return 'other';
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set, get) => ({
      route: '/',
      routeKind: 'home',
      pathname: '/',
      search: '',
      navEpoch: 0,
      section: null,
      currentProduct: null,
      focusedProduct: null,
      visibleProducts: [],
      selectedCollection: null,
      selectedWorld: null,
      selection: [],
      wishlist: [],
      lastOpenedProduct: null,
      menuOpen: false,
      ledgerOpen: false,
      consultation: { open: false },
      spotlight: null,
      dualityBias: null,
      pendingSection: null,
      pendingSpotlight: null,
      videoPaused: false,
      heroInvitationVisible: false,
      loaderDone: false,
      hydrated: false,

      setRoute: (pathname, search) => {
        const prev = get();
        // the first publish after hydration must not wipe what the page already set
        const routeChanged = prev.navEpoch > 0 && prev.pathname !== pathname;
        set({
          route: pathname + (search ? `?${search}` : ''),
          pathname,
          search,
          routeKind: routeKindOf(pathname),
          navEpoch: prev.navEpoch + 1,
          ...(routeChanged
            ? {
                section: null,
                visibleProducts: [],
                focusedProduct: null,
                currentProduct: null,
                selectedCollection: null,
                selectedWorld: null,
              }
            : {}),
        });
      },
      setSection: (id) => {
        if (get().section !== id) set({ section: id });
      },
      setCurrentProduct: (slug) => {
        if (get().currentProduct !== slug) set({ currentProduct: slug });
      },
      setFocusedProduct: (slug) => {
        if (get().focusedProduct !== slug) set({ focusedProduct: slug });
      },
      setVisibleProducts: (slugs) => {
        if (!sameList(get().visibleProducts, slugs)) set({ visibleProducts: slugs });
      },
      setSelectedCollection: (slug) => {
        if (get().selectedCollection !== slug) set({ selectedCollection: slug });
      },
      setSelectedWorld: (slug) => {
        if (get().selectedWorld !== slug) set({ selectedWorld: slug });
      },
      addToWishlist: (slug, source = 'page') => {
        if (get().selection.some((e) => e.slug === slug)) return;
        set(withSelection([...get().selection, { slug, addedAt: Date.now(), source }]));
      },
      removeFromWishlist: (slug) => set(withSelection(get().selection.filter((e) => e.slug !== slug))),
      toggleWishlist: (slug, source = 'page') => {
        const kept = get().selection.some((e) => e.slug === slug);
        get()[kept ? 'removeFromWishlist' : 'addToWishlist'](slug, source);
      },
      /**
       * Drops what the catalogue no longer carries. Run once the index has loaded, which is
       * the first moment the question can be answered — before that every slug is unknown,
       * and pruning against an unloaded index would silently empty the ledger.
       */
      pruneSelection: (exists) => {
        const kept = get().selection.filter((e) => exists(e.slug));
        if (kept.length !== get().selection.length) set(withSelection(kept));
      },
      setLastOpenedProduct: (slug) => set({ lastOpenedProduct: slug }),
      openMenu: () => set({ menuOpen: true }),
      closeMenu: () => set({ menuOpen: false }),
      openLedger: () => set({ ledgerOpen: true }),
      closeLedger: () => set({ ledgerOpen: false }),
      openConsultation: (ctx) => set({ consultation: { open: true, ...ctx } }),
      closeConsultation: () => set({ consultation: { ...get().consultation, open: false } }),
      requestSpotlight: (slug) => set({ spotlight: { slug, token: (get().spotlight?.token ?? 0) + 1 } }),
      clearSpotlight: () => set({ spotlight: null }),
      setDualityBias: (bias) => set({ dualityBias: bias }),
      setPendingSection: (id) => set({ pendingSection: id }),
      setPendingSpotlight: (slug) => set({ pendingSpotlight: slug }),
      setVideoPaused: (paused) => set({ videoPaused: paused }),
      setHeroInvitationVisible: (visible) => {
        if (get().heroInvitationVisible !== visible) set({ heroInvitationVisible: visible });
      },
      setLoaderDone: (done) => set({ loaderDone: done }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      /**
       * A ledger, not a cart — and one that survives the catalogue changing underneath it.
       *
       * v1 stored bare slugs and trusted them forever. With 599 listable pieces projected
       * from a snapshot that is meant to be re-synced, a slug in a visitor's selection can
       * simply stop existing: the piece is withdrawn, or renamed, or withheld pending a name
       * from Waseem. The ledger then held a reference to nothing, and the only way to find
       * out was a card that rendered blank.
       *
       * v2 keeps when and from where each piece was kept — useful to a jeweller ringing back
       * — and `pruneSelection` drops what no longer resolves once the index has loaded. The
       * cap is forty: past that it has stopped being a selection.
       */
      name: V2,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ selection: s.selection }),
      skipHydration: true,
      /**
       * Only the ledger is stored; the slug list is derived from it here. Deriving on
       * rehydrate rather than persisting both is what stops the two disagreeing after a
       * migration, which is exactly when they would.
       */
      onRehydrateStorage: () => (state) => {
        if (state) state.selection = state.selection ?? [];
        if (state) state.wishlist = (state.selection ?? []).map((e) => e.slug);
      },
      migrate: (persisted, from) => {
        const p = (persisted ?? {}) as { wishlist?: unknown; selection?: unknown };
        if (from >= 2) return p;
        // v1: a bare slug list. The time it was kept is genuinely unknown, so it is not invented.
        const slugs = Array.isArray(p.wishlist) ? p.wishlist.filter((x): x is string => typeof x === 'string') : [];
        return { selection: slugs.map((slug) => ({ slug, addedAt: 0, source: 'migrated' as const })) };
      },
    },
  ),
);

export const useWishlist = () => useSiteStore((s) => s.wishlist);
export const useIsSaved = (slug: string) => useSiteStore((s) => s.wishlist.includes(slug));
