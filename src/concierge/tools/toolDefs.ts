import type { ToolDef } from '../types';

const SECTIONS = ['hero', 'craft', 'heritage', 'collections', 'bridal', 'wall', 'slider', 'duality', 'bespoke', 'footer', 'department', 'pieces', 'related'];
const COLLECTIONS = ['bridal', 'rukh-e-jana', 'aks-e-noor', 'rang-e-jamal', 'dewan', 'royal-wedding'];
const DEPARTMENTS = ['gold', 'diamond', 'bridal', 'men', 'kids'];

/** One registry, JSON-schema parameters. The same array feeds the mock and, later, the Realtime session. */
export const TOOL_DEFS: readonly ToolDef[] = [
  {
    name: 'searchProducts',
    description: 'Find pieces in the Waseem catalogue. Prefer this before opening a piece by name.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'free words from the visitor' },
        category: { type: 'string', enum: ['necklace', 'choker', 'set', 'earrings', 'ring', 'bangle', 'bracelet', 'pendant', 'chain', 'nose-pin', 'cufflink'] },
        material: { type: 'string', enum: ['gold', 'diamond', 'polki', 'kundan', 'emerald', 'pearl', 'sapphire'] },
        collection: { type: 'string', enum: COLLECTIONS },
        department: { type: 'string', enum: DEPARTMENTS },
        purity: { type: 'string', enum: ['18K', '21K', '22K'] },
        style: { type: 'string', enum: ['bridal', 'traditional', 'contemporary', 'everyday', 'statement'] },
        limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 },
      },
    },
    runtime: 'browser',
  },
  { name: 'showCollection', description: 'Take the visitor into a collection world.', parameters: { type: 'object', properties: { slug: { type: 'string', enum: COLLECTIONS } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'focusProduct', description: 'Draw attention to a piece on the current page without opening it.', parameters: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'openProduct', description: "Open a piece's own page.", parameters: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] }, runtime: 'browser' },
  { name: 'showSimilarPieces', description: 'Pieces in the same spirit as a piece (defaults to the piece in view).', parameters: { type: 'object', properties: { slug: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 6, default: 4 } } }, runtime: 'browser' },
  { name: 'saveToWishlist', description: "Keep a piece in the visitor's selection (defaults to the piece in view).", parameters: { type: 'object', properties: { slug: { type: 'string' } } }, runtime: 'browser' },
  { name: 'removeFromWishlist', description: "Remove a piece from the visitor's selection.", parameters: { type: 'object', properties: { slug: { type: 'string' } } }, runtime: 'browser' },
  { name: 'openWishlist', description: "Show the visitor's selection.", parameters: { type: 'object', properties: {} }, runtime: 'browser' },
  { name: 'scrollToSection', description: 'Glide to a chapter of the current page.', parameters: { type: 'object', properties: { section: { type: 'string', enum: SECTIONS } }, required: ['section'] }, runtime: 'browser' },
  {
    name: 'openPrivateConsultation',
    description: 'Open the private consultation form.',
    parameters: { type: 'object', properties: { topic: { type: 'string', enum: ['bridal', 'bespoke', 'viewing', 'general'] }, productSlug: { type: 'string' } } },
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
  { name: 'navigate', description: 'Move to a page of the site.', parameters: { type: 'object', properties: { path: { type: 'string', description: '/, /<department>, /<department>/<kind>, /collections/<slug> or /jewellery/<slug>' } }, required: ['path'] }, runtime: 'browser' },
  { name: 'getCurrentContext', description: 'What the visitor is looking at right now.', parameters: { type: 'object', properties: {} }, runtime: 'browser' },
];

/** The flat shape the OpenAI Realtime session expects for `session.tools`. */
export function realtimeTools() {
  return TOOL_DEFS.map((t) => ({ type: 'function' as const, name: t.name, description: t.description, parameters: t.parameters }));
}
