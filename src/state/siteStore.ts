import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type RouteKind = 'home' | 'collection' | 'department' | 'product' | 'other';

export type SectionId =
  | 'loader'
  | 'hero'
  | 'craft'
  | 'heritage'
  | 'collections'
  | 'bridal'
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
}

interface SiteState {
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
  addToWishlist: (slug: string) => void;
  removeFromWishlist: (slug: string) => void;
  toggleWishlist: (slug: string) => void;
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
      addToWishlist: (slug) => {
        if (!get().wishlist.includes(slug)) set({ wishlist: [...get().wishlist, slug] });
      },
      removeFromWishlist: (slug) => set({ wishlist: get().wishlist.filter((s) => s !== slug) }),
      toggleWishlist: (slug) => {
        const list = get().wishlist;
        set({ wishlist: list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug] });
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
      name: 'wj:selection:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ wishlist: s.wishlist }),
      skipHydration: true,
    },
  ),
);

export const useWishlist = () => useSiteStore((s) => s.wishlist);
export const useIsSaved = (slug: string) => useSiteStore((s) => s.wishlist.includes(slug));
