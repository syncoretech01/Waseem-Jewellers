import type { ToolDef } from '../types';

/**
 * Where "take me to…" can land. The homepage chapters, the department and product page
 * sections, and two targets that are not sections of their own: `gate` is the Gold / Diamond
 * gate chapter, `kinds` is the row of kinds inside the window chapter.
 */
const SECTIONS = ['hero', 'vitrine', 'kinds', 'craft', 'bangle', 'gate', 'gold', 'goldwork', 'light', 'diamond', 'bridal', 'collections', 'heritage', 'menkids', 'bespoke', 'footer', 'department', 'pieces', 'gallery', 'details', 'related'];
const COLLECTIONS = ['bridal', 'rukh-e-jana', 'aks-e-noor', 'rang-e-jamal', 'dewan', 'royal-wedding'];
const DEPARTMENTS = ['gold', 'diamond', 'bridal', 'men', 'kids'];
/**
 * The places a visitor names rather than the paths they resolve to: "take me to gold",
 * "go back", "where are your showrooms". `navigate` accepts either.
 */
const NAV_TARGETS = ['home', 'back', 'gold', 'diamond', 'bridal', 'men', 'kids', 'bridal-collection', 'locations', 'appointment'];
const OCCASIONS = ['bridal', 'bespoke', 'viewing', 'gift'];
const WINDOWS = ['afternoon', 'evening'];
/** A showroom as the visitor says it — an id or a name; the tool resolves it and refuses what matches none. */
const SHOWROOM = { type: 'string' as const, description: 'Liberty Market, MM Alam Road or DHA — the name the visitor used, or the id liberty, mm-alam, dha' };
const ISO_DATE = { type: 'string' as const, pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD, today or later; turn "Saturday" or "the 20th" into a date before calling' };

/**
 * The kinds a piece is actually classified as.
 *
 * The stored kinds, plus the two words a visitor uses for two of them.
 *
 * This list used to offer 'set' and 'choker' and nothing mapped them, so both matched no piece
 * at all — while omitting `bridal-set`, which 23 pieces carry and which the validator therefore
 * refused outright. Both halves are fixed here rather than by narrowing: a visitor really does
 * say "choker" and "set", the keyless extractor really does produce them, and
 * `canonicalCategory` maps them to the necklace and the bridal-set the shop actually stores.
 *
 * 'tikka' and 'nath' are absent for a different reason: the taxonomy has them, but no piece is
 * classified as either today. Offering a kind with nothing behind it is how a concierge ends up
 * apologising for an empty room it walked the visitor into.
 */
const CATEGORIES = ['bridal-set', 'set', 'necklace', 'choker', 'earrings', 'ring', 'bangle', 'bracelet', 'pendant', 'chain', 'nose-pin', 'cufflink'];

/**
 * One registry, JSON-schema parameters. The same array feeds the keyless planner, the text
 * model (the turn route) and the direct Realtime voice tool projection. The latter exposes
 * only its deliberately small safe subset; every execution still comes back through this
 * registry and its validator.
 */
export const TOOL_DEFS: readonly ToolDef[] = [
  {
    name: 'searchProducts',
    description: 'Bring pieces from the Waseem catalogue onto the page — "show rings", "rings", "bridal necklaces", "kuch halka dikhao". A bare kind of jewellery ("Rings." "Bangles." "Jhumke.") is this call with that category. Prefer this before opening a piece by name.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'free words from the visitor' },
        category: { type: 'string', enum: CATEGORIES },
        material: { type: 'string', enum: ['gold', 'diamond', 'polki', 'kundan', 'emerald', 'pearl', 'sapphire'] },
        /**
         * Deliberately no `collection` filter.
         *
         * Sixty-nine pieces carry a campaign and five of them are listable: the rest are the
         * unnamed campaign products withheld until Waseem supplies names. Filtering the
         * catalogue by campaign therefore returns an empty tray for seven of the nine
         * campaigns, and a model offered the argument will use it and then have to explain
         * the emptiness. A visitor who asks about a campaign wants the campaign — which is a
         * story page, reached with showCollection — not a filtered grid of nothing.
         */
        department: { type: 'string', enum: DEPARTMENTS },
        purity: { type: 'string', enum: ['18K', '21K', '22K'] },
        style: { type: 'string', enum: ['bridal', 'traditional', 'contemporary', 'everyday', 'statement'] },
        // both are read by the tool and were never declared, so the sanitiser — correctly —
        // began dropping them the moment it started rebuilding args from the schema
        occasion: { type: 'string', enum: ['wedding', 'mehndi', 'baraat', 'walima', 'engagement', 'everyday', 'gift'] },
        maxWeightGrams: { type: 'number', minimum: 0, maximum: 500, description: 'only pieces that publish a weight can satisfy this' },
        maxPricePkr: { type: 'number', minimum: 0, maximum: 100000000, description: 'only fixed, published prices can satisfy this; never infer a price for price-on-request pieces' },
        excludeSlugs: { type: 'array', items: { type: 'string', format: 'piece-slug', pattern: '^[a-z0-9][a-z0-9-]{2,80}$' }, maxItems: 12, description: 'recently recommended or opened pieces to avoid when the visitor asks for another or something different' },
        limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 },
      },
    },
    runtime: 'browser',
  },
  { name: 'showCollection', description: 'Take the visitor into a collection world.', parameters: { type: 'object', properties: { slug: { type: 'string', enum: COLLECTIONS } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'focusProduct', description: 'Draw attention to a piece on the current page without opening it.', parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } }, required: ['slug'] }, runtime: 'browser' },
  {
    name: 'openProduct',
    description: 'Open the page of one piece — "open it", "second one", "doosra kholo", "the first". An ordinal names one of the pieces just shown; "it" / "this one" / "yeh" is the piece in view, else the piece last spoken about, else the first piece just shown. Never ask which when one of those exists.',
    parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } }, required: ['slug'] },
    runtime: 'browser',
  },
  {
    name: 'scrollToProductDetails',
    description: 'On the current product page, scroll only to its published product-information and details area — “scroll down”, “show the details”, “open this product and scroll down”. Refuse unless a product page is open.',
    parameters: { type: 'object', properties: {} },
    runtime: 'browser',
  },
  { name: 'showSimilarPieces', description: 'Pieces in the same spirit as a piece (defaults to the piece in view).', parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' }, limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 } } }, runtime: 'browser' },
  {
    name: 'scrollToSection',
    description:
      'Glide to a chapter — "show me the craft", "where are your showrooms" (heritage), "the kinds" (kinds), "the gold and diamond gate" (gate). A homepage chapter is reached from any page; the visitor is taken home first.',
    parameters: { type: 'object', properties: { section: { type: 'string', enum: SECTIONS } }, required: ['section'] },
    runtime: 'browser',
  },
  {
    name: 'openPrivateConsultation',
    description: 'Open the appointment form — a visit to a Lahore showroom, optionally about a piece.',
    parameters: { type: 'object', properties: { topic: { type: 'string', enum: ['bridal', 'bespoke', 'viewing', 'general'] }, productSlug: { type: 'string', format: 'piece-slug' } } },
    runtime: 'browser',
  },
  {
    name: 'openAppointment',
    description: 'Open the appointment form — "book an appointment", "appointment", "I want to visit", "appointment book karo", "mulaqat". Use fillAppointment instead when the visitor has already given a detail.',
    parameters: { type: 'object', properties: { topic: { type: 'string', enum: ['bridal', 'bespoke', 'viewing', 'general'] }, productSlug: { type: 'string', format: 'piece-slug' } } },
    runtime: 'browser',
  },
  { name: 'showBridal', description: 'Open the bridal collection.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  {
    name: 'showDepartment',
    description: 'Open a department of the shop — Gold, Diamond, Bridal, Men or Kids — each a real page of its own pieces. A single word that names a department ("Gold." "Diamond." "Bridal." "Sona.") is this call, immediately.',
    parameters: { type: 'object', properties: { department: { type: 'string', enum: DEPARTMENTS } }, required: ['department'] },
    runtime: 'browser',
  },
  // deprecated aliases for showDepartment — kept so fixtures and a model's habits keep working
  { name: 'showGold', description: 'Deprecated. Prefer showDepartment with department "gold".', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  { name: 'showDiamond', description: 'Deprecated. Prefer showDepartment with department "diamond".', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  {
    name: 'showMatchingPieces',
    description: 'Pieces that would be worn WITH a piece — earrings for a necklace, a ring for a bangle. Not the same as showSimilarPieces, which finds more of the same kind. Name a category to ask for one kind of companion.',
    parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' }, category: { type: 'string', enum: CATEGORIES }, limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 } } },
    runtime: 'browser',
  },
  {
    name: 'refineResults',
    description:
      'Narrow what is already on screen, or answer "something lighter/heavier than this". Weight comparisons use published gross weights where they exist and otherwise compare the form of the piece; never state a weight this does not return.',
    parameters: {
      type: 'object',
      properties: {
        weight: { type: 'string', enum: ['lighter', 'heavier'], description: 'relative to the piece in view' },
        category: { type: 'string', enum: CATEGORIES },
        material: { type: 'string', enum: ['gold', 'diamond', 'polki', 'kundan', 'emerald', 'pearl', 'sapphire'] },
        purity: { type: 'string', enum: ['18K', '21K', '22K'] },
        maxWeightGrams: { type: 'number', minimum: 0, maximum: 500 },
        limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 },
      },
    },
    runtime: 'browser',
  },
  {
    name: 'filterProducts',
    description: 'Apply filters to a department page. The filters are written into the page URL, so the page and this conversation always show the same set.',
    parameters: {
      type: 'object',
      properties: {
        department: { type: 'string', enum: DEPARTMENTS },
        category: { type: 'string', enum: CATEGORIES },
        material: { type: 'string', enum: ['gold', 'diamond', 'polki', 'kundan', 'emerald', 'pearl', 'sapphire'] },
        purity: { type: 'string', enum: ['18K', '21K', '22K'] },
        weight: { type: 'string', enum: ['<5', '5-15', '15-30', '30-60', '60+'] },
        occasion: { type: 'string', enum: ['wedding', 'mehndi', 'baraat', 'walima', 'engagement', 'everyday', 'gift'] },
        // no campaign here either, and for the same reason as searchProducts above
        sort: { type: 'string', enum: ['featured', 'weight-asc', 'weight-desc', 'carat-desc'] },
      },
    },
    runtime: 'browser',
  },
  { name: 'clearFilters', description: 'Remove every filter from the current department page.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  {
    name: 'showPriceGuidance',
    description:
      'What Waseem publishes about the price of a piece. All but seventeen pieces are priced on request, so this usually opens the appointment form rather than stating a figure. Never quote a price this does not return.',
    parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' }, budgetPkr: { type: 'number', minimum: 0, maximum: 100000000 } } },
    runtime: 'browser',
  },
  {
    name: 'getProductFacts',
    description:
      'Read only published product facts: gross weight / weight / wazan / وزن / grams / گرام / tola, purity / karat, diamond carats, material, reference, and published price or price on request. Defaults to the piece in view, then the most recently shown piece. Use for “What is the weight?”, “Is ka wazan kitna hai?”, “Yeh kitne gram ka hai?”, “اس کا وزن کتنا ہے؟”, and price questions. Never estimate; state when a fact is not published.',
    parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } } },
    runtime: 'browser',
  },
  {
    name: 'navigate',
    description:
      'Take the visitor somewhere — "back" / "go back" / "wapas" (back), "home", "take me to gold", "the bridal collection", "where are your showrooms" (locations), "the appointment form" (appointment). Give a target, or a path for a page the targets do not name.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: NAV_TARGETS, description: 'the place as the visitor names it; back returns to the previous page' },
        path: { type: 'string', description: '/, /<department>, /<department>/<kind>, /collections/<slug> or /jewellery/<slug>' },
      },
    },
    runtime: 'browser',
  },
  {
    name: 'goBack',
    description: 'Return to the previous page — “go back”, “back”, “wapas”.',
    parameters: { type: 'object', properties: {} },
    runtime: 'browser',
  },
  // ── operating the site: the chrome, the gallery, the gate, the window ──────────────────
  { name: 'openMenu', description: 'Open the site menu — "open the menu", "menu kholo".', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  { name: 'closeMenu', description: 'Close the site menu.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  { name: 'closeConcierge', description: 'Close this conversation panel — "close", "that is all", "band karo", "bas". Say goodbye in one short line first.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  {
    name: 'setGalleryFrame',
    description: 'On a piece\'s page, show one photograph of it — "the second photo", "doosri tasveer", "show me the back". Zero-based: the second photograph is index 1. Refused off a piece\'s page.',
    parameters: { type: 'object', properties: { index: { type: 'integer', minimum: 0, maximum: 11, description: '0 is the first photograph' } }, required: ['index'] },
    runtime: 'browser',
  },
  {
    name: 'activateGate',
    description: 'Open one side of the Gold / Diamond gate on the homepage — "show me the gold side", "diamond wala". Takes the visitor to that chapter, home first if needed.',
    parameters: { type: 'object', properties: { material: { type: 'string', enum: ['gold', 'diamond'] } }, required: ['material'] },
    runtime: 'browser',
  },
  {
    name: 'highlightCategory',
    description: 'Point out one kind of jewellery in the window chapter\'s row of kinds — "where are the bangles", "show me the kinds of rings you have". Takes the visitor there, home first if needed.',
    parameters: { type: 'object', properties: { category: { type: 'string', enum: CATEGORIES } }, required: ['category'] },
    runtime: 'browser',
  },
  // ── the appointment: prepared in the open, sent only on the visitor's word ─────────────
  {
    name: 'fillAppointment',
    description:
      'Write what the visitor has told you into the appointment form, opening it if it is closed — name, telephone, showroom, occasion, date, time, a note, the pieces. While the form is open, a bare answer is the field it answers: "Liberty" / "MM Alam" / "DHA" is the showroom, a name is the name, a number is the telephone, "bridal" is the occasion. "This piece" is the piece in view. Returns the draft and what is still missing; ask for the missing fields one at a time. Never invent a value.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string', description: 'as the visitor gave it; digits, spaces, dashes, a leading plus' },
        email: { type: 'string' },
        showroom: SHOWROOM,
        occasion: { type: 'string', enum: OCCASIONS },
        date: ISO_DATE,
        window: { type: 'string', enum: WINDOWS, description: 'afternoon is 12–4, evening is 4–9:30' },
        message: { type: 'string', description: 'a note for the team in the visitor\'s words' },
        productSlugs: { type: 'array', items: { type: 'string', format: 'piece-slug', pattern: '^[a-z0-9][a-z0-9-]{2,80}$' }, maxItems: 8 },
      },
    },
    runtime: 'browser',
  },
  {
    name: 'reviewAppointment',
    description:
      'Read the appointment form back before sending: the showroom, the occasion, the date and time, the pieces by name, and what is still missing. Call it, then confirm the whole request in one sentence and ask whether to send it — never send without that answer.',
    parameters: { type: 'object', properties: {} },
    runtime: 'browser',
  },
  {
    name: 'submitAppointment',
    description:
      'Send the appointment request — only after the visitor has answered yes to a confirming question in this conversation; pass confirmed true only then. Refused otherwise, and refused while a required field is missing. Afterwards say exactly what the result says: "prepared" means the request is kept on the device with a reference and WhatsApp is the next step, nothing was sent; "delivered" means our team has it and will confirm. Never say booked or confirmed.',
    parameters: { type: 'object', properties: { confirmed: { type: 'boolean', description: 'true only when the visitor has just said yes to sending' } }, required: ['confirmed'] },
    runtime: 'browser',
  },
  /**
   * Read-only and on the server, where a booking provider would be. None is configured
   * today, and the tool says so rather than inventing a free slot.
   */
  {
    name: 'checkAvailability',
    description: 'Whether a showroom publishes free times for a date. Today none does: the answer says our team confirms times. Never state a time this does not return; offer to prepare the appointment request instead (fillAppointment), which our team answers.',
    parameters: { type: 'object', properties: { showroom: SHOWROOM, date: ISO_DATE }, required: ['showroom', 'date'] },
    runtime: 'server',
  },
  /**
   * Read-only, and executed on the server where the catalogue is. A tool that only consults
   * data should not make a round trip through a browser to answer.
   */
  {
    name: 'compareProducts',
    description: 'Compare two or three pieces on the specifications Waseem publishes. An unpublished figure comes back as null; say so rather than filling it in.',
    parameters: {
      type: 'object',
      properties: {
        slugs: { type: 'array', items: { type: 'string', format: 'piece-slug', pattern: '^[a-z0-9][a-z0-9-]{2,80}$' }, minItems: 2, maxItems: 3 },
      },
      required: ['slugs'],
    },
    runtime: 'server',
  },
  {
    name: 'comparePieces',
    description:
      'Set two or three pieces side by side for the visitor — kind, purity, gross weight, carats, price and reference exactly as published; an unpublished figure is shown as a dash. Use this to SHOW a comparison; compareProducts only returns the figures to you.',
    parameters: {
      type: 'object',
      properties: {
        slugs: { type: 'array', items: { type: 'string', format: 'piece-slug', pattern: '^[a-z0-9][a-z0-9-]{2,80}$' }, minItems: 2, maxItems: 3 },
      },
      required: ['slugs'],
    },
    runtime: 'browser',
  },
  {
    name: 'explainSpecification',
    description: "Explain what a piece's published specification means — purity, weight, clarity — using general facts about the material.",
    parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug', pattern: '^[a-z0-9][a-z0-9-]{2,80}$' } }, required: ['slug'] },
    runtime: 'server',
  },
  {
    name: 'deepSearch',
    description: 'Search the whole catalogue when the four pieces already shown are not enough.',
    parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 12, default: 8 } }, required: ['query'] },
    runtime: 'server',
  },
  {
    name: 'getCurrentContext',
    description: 'What the visitor is looking at right now: the page, the chapter, the piece in view and how many photographs it has, whether the appointment form is open and what is in it.',
    parameters: { type: 'object', properties: {} },
    runtime: 'browser',
  },
];
