import { create } from 'zustand';

export type RouteKind = 'home' | 'collection' | 'department' | 'product' | 'other';

export type SectionId =
  | 'loader'
  | 'hero'
  | 'vitrine'
  | 'craft'
  | 'bangle'
  | 'goldwork'
  | 'light'
  | 'heritage'
  | 'collections'
  | 'bridal'
  | 'gold'
  | 'diamond'
  | 'menkids'
  | 'bespoke'
  /** The Gold / Diamond gate chapter on the homepage. */
  | 'gate'
  | 'footer'
  | 'collection-opening'
  | 'collection-intro'
  | 'department'
  | 'pieces'
  | 'gallery'
  | 'details'
  | 'related';

/**
 * What the concierge has gathered for the appointment form, field by field.
 *
 * Held in memory only — never persisted, never sent anywhere by the store. The form reads it
 * and shows it; the visitor sees every value before anything is submitted, and a submission
 * still goes through the form's own button logic with its validation intact.
 */
export interface ConsultationDraft {
  name?: string;
  phone?: string;
  email?: string;
  /** A showroom id from `SITE.showrooms`. */
  showroom?: string;
  occasion?: 'bridal' | 'bespoke' | 'viewing' | 'gift';
  /** YYYY-MM-DD. */
  date?: string;
  window?: 'afternoon' | 'evening';
  message?: string;
  productSlugs?: string[];
}

export type ConsultationDraftField = keyof ConsultationDraft;

/**
 * What actually happened to a submission the concierge asked for.
 *
 * `prepared` — kept on the device with a reference; nothing was transmitted.
 * `delivered` — the server sink took it. `failed` — it was sent and did not arrive; the
 * reference and the WhatsApp line are still the visitor's. `invalid` — the form refused it,
 * and `missing` names the fields.
 */
export interface ConsultationOutcome {
  nonce: number;
  status: 'prepared' | 'delivered' | 'failed' | 'invalid';
  reference?: string;
  whatsappHref?: string;
  missing?: string[];
}

export interface ConsultationContext {
  open: boolean;
  topic?: 'bridal' | 'bespoke' | 'viewing' | 'general';
  productSlug?: string;
  productSlugs?: string[];
  source?: 'concierge' | 'cta' | 'menu';
  /**
   * What the visitor said they wanted to spend, carried across from the conversation.
   *
   * All but seventeen pieces are priced on request, so a budget almost never produces a
   * filtered result — but it is the most useful thing a jeweller can be told before ringing
   * back, and losing it at the form boundary means the visitor is asked for it twice.
   */
  budgetPkr?: number;
  /** What the concierge has filled in so far. See `ConsultationDraft`. */
  draft?: ConsultationDraft;
  /**
   * When each draft field was last written, so the form can tell a value the concierge set
   * after the visitor typed from one it set before — the later hand wins, whichever it is.
   */
  draftAt?: Partial<Record<ConsultationDraftField, number>>;
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
  lastOpenedProduct: string | null;
  menuOpen: boolean;
  consultation: ConsultationContext;
  spotlight: { slug: string; token: number } | null;
  pendingSection: SectionId | null;
  pendingSpotlight: string | null;
  videoPaused: boolean;
  heroInvitationVisible: boolean;
  loaderDone: boolean;
  /** Which side of the Gold / Diamond gate chapter is open, when the concierge chose one. */
  gate: 'gold' | 'diamond' | null;
  /** A kind the window chapter should draw attention to — a category slug. */
  highlightedCategory: string | null;
  /** A request to show one frame of a product gallery; the gallery acts on it and clears it. */
  galleryRequest: { slug: string; index: number; at: number } | null;
  /** The gallery in view, published by the product page: how many frames, and which is showing. */
  gallery: { slug: string; count: number; index: number } | null;
  /** Bumped when the concierge asks the appointment form to submit itself. See `requestConsultationSubmit`. */
  consultationSubmitNonce: number;
  /** The last submission's truthful outcome, keyed by the nonce that asked for it. */
  consultationOutcome: ConsultationOutcome | null;

  setRoute: (pathname: string, search: string) => void;
  setSection: (id: SectionId | null) => void;
  setCurrentProduct: (slug: string | null) => void;
  setFocusedProduct: (slug: string | null) => void;
  setVisibleProducts: (slugs: string[]) => void;
  setSelectedCollection: (slug: string | null) => void;
  setSelectedWorld: (slug: string | null) => void;
  setLastOpenedProduct: (slug: string | null) => void;
  openMenu: () => void;
  closeMenu: () => void;
  openConsultation: (ctx?: Omit<ConsultationContext, 'open'>) => void;
  closeConsultation: () => void;
  requestSpotlight: (slug: string) => void;
  clearSpotlight: () => void;
  setPendingSection: (id: SectionId | null) => void;
  setPendingSpotlight: (slug: string | null) => void;
  setVideoPaused: (paused: boolean) => void;
  setHeroInvitationVisible: (visible: boolean) => void;
  setLoaderDone: (done: boolean) => void;
  setGate: (material: 'gold' | 'diamond' | null) => void;
  setHighlightedCategory: (category: string | null) => void;
  requestGalleryFrame: (slug: string, index: number) => void;
  clearGalleryRequest: () => void;
  setGallery: (gallery: { slug: string; count: number; index: number } | null) => void;
  /** Merges into the draft; a field given as undefined is left alone, as null is cleared. */
  setConsultationDraft: (patch: Partial<Record<ConsultationDraftField, ConsultationDraft[ConsultationDraftField] | null>>) => void;
  clearConsultationDraft: () => void;
  /**
   * Asks the open form to run the same submit its button runs, and returns the nonce the
   * outcome will carry. The store never submits anything itself: the form does, with its
   * validation, honeypot and timing rules exactly as they are for a visitor's own click.
   */
  requestConsultationSubmit: () => number;
  setConsultationOutcome: (outcome: ConsultationOutcome | null) => void;
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

export const useSiteStore = create<SiteState>()((set, get) => ({
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
  lastOpenedProduct: null,
  menuOpen: false,
  consultation: { open: false },
  spotlight: null,
  pendingSection: null,
  pendingSpotlight: null,
  videoPaused: false,
  heroInvitationVisible: false,
  loaderDone: false,
  gate: null,
  highlightedCategory: null,
  galleryRequest: null,
  gallery: null,
  consultationSubmitNonce: 0,
  consultationOutcome: null,

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
  setLastOpenedProduct: (slug) => set({ lastOpenedProduct: slug }),
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
  // the draft the concierge gathered survives a reopening from any door — the ENQUIRE
  // button, the menu, the concierge — unless the caller replaces it
  openConsultation: (ctx) =>
    set({
      consultation: {
        open: true,
        draft: get().consultation.draft,
        draftAt: get().consultation.draftAt,
        ...ctx,
      },
    }),
  closeConsultation: () => set({ consultation: { ...get().consultation, open: false } }),
  requestSpotlight: (slug) => set({ spotlight: { slug, token: (get().spotlight?.token ?? 0) + 1 } }),
  clearSpotlight: () => set({ spotlight: null }),
  setPendingSection: (id) => set({ pendingSection: id }),
  setPendingSpotlight: (slug) => set({ pendingSpotlight: slug }),
  setVideoPaused: (paused) => set({ videoPaused: paused }),
  setHeroInvitationVisible: (visible) => {
    if (get().heroInvitationVisible !== visible) set({ heroInvitationVisible: visible });
  },
  setLoaderDone: (done) => set({ loaderDone: done }),
  setGate: (material) => {
    if (get().gate !== material) set({ gate: material });
  },
  setHighlightedCategory: (category) => {
    if (get().highlightedCategory !== category) set({ highlightedCategory: category });
  },
  requestGalleryFrame: (slug, index) => set({ galleryRequest: { slug, index, at: Date.now() } }),
  clearGalleryRequest: () => {
    if (get().galleryRequest) set({ galleryRequest: null });
  },
  setGallery: (gallery) => {
    const cur = get().gallery;
    if (cur === gallery) return;
    if (cur && gallery && cur.slug === gallery.slug && cur.count === gallery.count && cur.index === gallery.index) return;
    set({ gallery });
  },
  setConsultationDraft: (patch) => {
    const c = get().consultation;
    const draft: ConsultationDraft = { ...c.draft };
    const draftAt = { ...c.draftAt };
    const now = Date.now();
    for (const [key, value] of Object.entries(patch) as [ConsultationDraftField, unknown][]) {
      if (value === undefined) continue;
      if (value === null) delete draft[key];
      else (draft as Record<string, unknown>)[key] = value;
      draftAt[key] = now;
    }
    set({ consultation: { ...c, draft, draftAt } });
  },
  clearConsultationDraft: () => {
    const c = get().consultation;
    if (!c.draft && !c.draftAt) return;
    const { draft: _draft, draftAt: _draftAt, ...rest } = c;
    void _draft;
    void _draftAt;
    set({ consultation: rest });
  },
  requestConsultationSubmit: () => {
    const nonce = get().consultationSubmitNonce + 1;
    set({ consultationSubmitNonce: nonce, consultationOutcome: null });
    return nonce;
  },
  setConsultationOutcome: (outcome) => set({ consultationOutcome: outcome }),
}));
