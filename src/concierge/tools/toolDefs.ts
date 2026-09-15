import type { ToolDef } from '../types';

const SECTIONS = ['hero', 'craft', 'heritage', 'collections', 'bridal', 'wall', 'slider', 'duality', 'bespoke', 'footer', 'department', 'pieces', 'related'];
const COLLECTIONS = ['bridal', 'rukh-e-jana', 'aks-e-noor', 'rang-e-jamal', 'dewan', 'royal-wedding'];
const DEPARTMENTS = ['gold', 'diamond', 'bridal', 'men', 'kids'];

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

/** One registry, JSON-schema parameters. The same array feeds the mock and, later, the Realtime session. */
export const TOOL_DEFS: readonly ToolDef[] = [
  {
    name: 'searchProducts',
    description: 'Find pieces in the Waseem catalogue. Prefer this before opening a piece by name.',
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
        limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 },
      },
    },
    runtime: 'browser',
  },
  { name: 'showCollection', description: 'Take the visitor into a collection world.', parameters: { type: 'object', properties: { slug: { type: 'string', enum: COLLECTIONS } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'focusProduct', description: 'Draw attention to a piece on the current page without opening it.', parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'openProduct', description: "Open a piece's own page.", parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'showSimilarPieces', description: 'Pieces in the same spirit as a piece (defaults to the piece in view).', parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' }, limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 } } }, runtime: 'browser' },
  { name: 'saveToWishlist', description: "Keep a piece in the visitor's selection (defaults to the piece in view).", parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } } }, runtime: 'browser' },
  { name: 'removeFromWishlist', description: "Remove a piece from the visitor's selection.", parameters: { type: 'object', properties: { slug: { type: 'string', format: 'piece-slug' } } }, runtime: 'browser' },
  { name: 'openWishlist', description: "Show the visitor's selection.", parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  { name: 'scrollToSection', description: 'Glide to a chapter of the current page.', parameters: { type: 'object', properties: { section: { type: 'string', enum: SECTIONS } }, required: ['section'] }, runtime: 'browser' },
  {
    name: 'openPrivateConsultation',
    description: 'Open the appointment form — a visit to a Lahore showroom, optionally about a piece.',
    parameters: { type: 'object', properties: { topic: { type: 'string', enum: ['bridal', 'bespoke', 'viewing', 'general'] }, productSlug: { type: 'string', format: 'piece-slug' } } },
    runtime: 'browser',
  },
  { name: 'showBridal', description: 'Open the bridal collection.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  {
    name: 'showDepartment',
    description: 'Open a department of the shop: Gold, Diamond, Bridal, Men or Kids. Each is a real page with its own pieces, filters and counts.',
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
  { name: 'navigate', description: 'Move to a page of the site.', parameters: { type: 'object', properties: { path: { type: 'string', description: '/, /<department>, /<department>/<kind>, /collections/<slug> or /jewellery/<slug>' } }, required: ['path'] }, runtime: 'browser' },
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
  { name: 'getCurrentContext', description: 'What the visitor is looking at right now.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
];

/** The flat shape the OpenAI Realtime session expects for `session.tools`. */
export function realtimeTools() {
  return TOOL_DEFS.map((t) => ({ type: 'function' as const, name: t.name, description: t.description, parameters: t.parameters }));
}
