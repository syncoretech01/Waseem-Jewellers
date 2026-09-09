import { findByName, similarTo } from '@/data/search';
import { getProduct, productsBySlugs, WORLDS, nameOf, describe } from '@/data';
import { formatPrice, countInWords, capitalise } from '@/lib/format';
import { CONCIERGE } from '../../copy';
import { ordinalFromWord, resolveOrdinal } from '../../tools/executeTool';
import { corePlan } from './corePlan';
import type { SiteContext, ToolName, ToolOutcome } from '../../types';

/** A plan the mock executes: zero or more tool calls, then a reply built from their outcomes. */
export interface Plan {
  id: string;
  tools: { name: ToolName; args: Record<string, unknown> }[];
  reply: (outcomes: ToolOutcome[], ctx: SiteContext) => string;
}

// ── normalisation ─────────────────────────────────────────────────────────────

const SYNONYMS: [RegExp, string][] = [
  [/\b(dikhao|dikhaiye|dikha|dikhana|dikhayen)\b/g, 'show'],
  [/\b(batao|bataiye|batayen)\b/g, 'tell'],
  [/\b(kholo|khol|kholiye)\b/g, 'open'],
  [/\b(chahiye|chaiye|chahiyeh)\b/g, 'want'],
  [/\bhaar\b/g, 'necklace'],
  [/\b(jhumka|jhumkay|jhumke|jhumki|bali|baliyan)\b/g, 'earrings'],
  [/\b(angoothi|anguthi)\b/g, 'ring'],
  [/\b(kangan|choorian|chooriyan|churiyan)\b/g, 'bangles'],
  [/\b(sona|sone|sonay)\b/g, 'gold'],
  [/\b(heera|heeray|heere)\b/g, 'diamond'],
  [/\b(dulhan|shaadi|shadi|barat|baraat|walima|mehndi)\b/g, 'bridal'],
  [/\b(riwayati|purana|purani)\b/g, 'traditional'],
  [/\b(mujhe|mujhay)\b/g, 'me'],
  [/\b(yeh|ye|is)\b/g, 'this'],
  [/\b(woh|wo|us)\b/g, 'that'],
  [/\b(pehla|pehli)\b/g, 'first'],
  [/\b(doosra|dusra|doosri|dusri)\b/g, 'second'],
  [/\b(teesra|teesri)\b/g, 'third'],
  [/\b(chautha|chauthi)\b/g, 'fourth'],
  [/\b(aakhri|akhri)\b/g, 'last'],
  [/\b(rakh lo|rakhlo|rakh lein|save karo|save kar do)\b/g, 'save'],
  [/\b(mulaqat|milna|appointment lena)\b/g, 'consultation'],
  [/\b(kitna|kitne|kitni|qeemat|keemat)\b/g, 'price'],
  [/\b(shukriya|shukria|bohat shukriya)\b/g, 'thanks'],
  [/\b(rukhe? ?e? ?jana|rukh-e-jana|rukhejana)\b/g, 'rukh-e-jana'],
  [/\b(aks ?e? ?noor|aks-e-noor|aksenoor)\b/g, 'aks-e-noor'],
  [/\b(rang ?e? ?jamal|rang-e-jamal|range jamal|rangejamal)\b/g, 'rang-e-jamal'],
  [/\b(naqsh ?e? ?gul|naqsh-e-gul|naqshegul|naqsh gul)\b/g, 'naqsh-e-gul'],
  [/\b(dewaan|diwan|deewan)\b/g, 'dewan'],
  [/\broyal wedding\b/g, 'royal-wedding'],
];

export function normalise(text: string) {
  let t = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, rep] of SYNONYMS) t = t.replace(re, rep);
  return t;
}

// ── entities ──────────────────────────────────────────────────────────────────

export interface Entities {
  category?: 'necklace' | 'choker' | 'set' | 'earrings' | 'ring' | 'bangle' | 'bracelet';
  material?: 'gold' | 'diamond' | 'polki' | 'kundan' | 'emerald' | 'pearl' | 'sapphire';
  world?: string;
  bridal: boolean;
  traditional: boolean;
  ordinal: number | null;
  deictic: boolean;
  similar: boolean;
}

export function extract(t: string): Entities {
  const e: Entities = { bridal: /\bbridal\b/.test(t), traditional: /\b(traditional|polki|kundan|jadau|antique|classic|timeless|old world)\b/.test(t), ordinal: null, deictic: /\b(this|that|it|this one|that one|the one)\b/.test(t), similar: /\b(similar|like this|like that|match(es|ing)?|goes with|same (style|spirit)|complement|pairs? with|in the spirit)\b/.test(t) };
  if (/\b(necklace|necklaces|collar|collars|satlada|raani)\b/.test(t)) e.category = 'necklace';
  else if (/\bchokers?\b/.test(t)) e.category = 'choker';
  else if (/\b(set|sets|suite|suites)\b/.test(t)) e.category = 'set';
  else if (/\bearrings?\b/.test(t)) e.category = 'earrings';
  else if (/\brings?\b/.test(t)) e.category = 'ring';
  else if (/\bbangles?\b/.test(t)) e.category = 'bangle';
  else if (/\bbracelets?\b/.test(t)) e.category = 'bracelet';
  if (/\bdiamonds?\b/.test(t)) e.material = 'diamond';
  else if (/\bgold\b/.test(t)) e.material = 'gold';
  else if (/\bpolki\b/.test(t)) e.material = 'polki';
  else if (/\bkundan\b/.test(t)) e.material = 'kundan';
  else if (/\bemeralds?\b/.test(t)) e.material = 'emerald';
  else if (/\bpearls?\b/.test(t)) e.material = 'pearl';
  else if (/\bsapphires?\b/.test(t)) e.material = 'sapphire';
  for (const w of WORLDS) if (t.includes(w.slug)) e.world = w.slug;
  const ord = t.match(/\b(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th|last)\b/);
  if (ord) e.ordinal = ord[1] === 'last' ? -1 : ordinalFromWord(ord[1]!);
  return e;
}

// ── replies helpers ───────────────────────────────────────────────────────────

function firstPieces(outcomes: ToolOutcome[]) {
  const o = outcomes.find((x) => x.ui?.kind === 'pieces' || x.ui?.kind === 'wishlist');
  return o?.ui && (o.ui.kind === 'pieces' || o.ui.kind === 'wishlist') ? o.ui.pieces : [];
}

function searchReply(outcomes: ToolOutcome[], what: string) {
  const pieces = firstPieces(outcomes);
  if (pieces.length === 0) return CONCIERGE.nothing;
  const houses = [...new Set(pieces.map((p) => p.collection).filter(Boolean))];
  return CONCIERGE.searchResult(capitalise(countInWords(pieces.length)), what, houses);
}

function specsLine(slug: string) {
  const p = getProduct(slug);
  if (!p) return '';
  const m = p.spec;
  const bits = [m.purity ? `${m.purity} gold` : null, m.grossWeightGrams ? `${m.grossWeightGrams.toFixed(3)} g` : null, m.diamondCarat ? `${m.diamondCarat} ct` : null, m.diamondClarity ?? null].filter(Boolean);
  return bits.length ? `${bits.join(', ')}.` : '';
}

// ── the ordered command table (first match wins) ──────────────────────────────

type Command = { id: string; test: (t: string, e: Entities, ctx: SiteContext) => boolean; plan: (t: string, e: Entities, ctx: SiteContext) => Plan };

const search = (id: string, args: Record<string, unknown>, what: string): Plan => ({ id, tools: [{ name: 'searchProducts', args }], reply: (o) => searchReply(o, what) });

export const COMMANDS: Command[] = [
  {
    id: 'greeting',
    test: (t) => /^(hi|hello|hey|salam|salaam|assalam\w*|as-salam\w*|good (morning|afternoon|evening))\b/.test(t) && t.length < 40,
    plan: (_t, _e, ctx) => ({ id: 'greeting', tools: [], reply: () => CONCIERGE.greeting(ctx.localHour) }),
  },
  { id: 'thanks', test: (t, e) => /\b(thank\w*|thanks|lovely|perfect|wonderful)\b/.test(t) && !e.category && !e.material, plan: () => ({ id: 'thanks', tools: [], reply: () => CONCIERGE.thanks }) },
  { id: 'close', test: (t) => /\b(close|bye|goodbye|khuda hafiz|allah hafiz|that'?s all|nothing else|that is all)\b/.test(t), plan: () => ({ id: 'close', tools: [], reply: () => CONCIERGE.close }) },
  { id: 'help', test: (t) => /\b(what can you do|help|options|how does this work|what do you do)\b/.test(t), plan: () => ({ id: 'help', tools: [], reply: () => CONCIERGE.help }) },
  { id: 'watches', test: (t) => /\b(watches|wrist ?watch|tag heuer|rado|tissot)\b/.test(t) || /\bwatch\b(?=\s*(salon|department|brands?|collection))/.test(t), plan: () => ({ id: 'watches', tools: [], reply: () => CONCIERGE.watches }) },
  {
    id: 'about_house',
    // copy-guard-allow: matches what a visitor might say, not what we say
    test: (t) => (/\b(tell me about|about|who (are|is)|history|heritage|story|founder|founded|1952|generations?|the house)\b/.test(t) && /\b(waseem|house|you|yourself|jewellers|brand)\b/.test(t)) || /^(waseem|waseem jewellers)$/.test(t),
    plan: () => ({ id: 'about_house', tools: [{ name: 'scrollToSection', args: { section: 'heritage' } }], reply: () => CONCIERGE.house }),
  },
  {
    id: 'showrooms',
    test: (t) => /\b(where are you|showrooms?|stores?|location|address|hours|timing|open (till|until)|contact|phone|whatsapp|visit you)\b/.test(t),
    plan: () => ({ id: 'showrooms', tools: [{ name: 'scrollToSection', args: { section: 'footer' } }], reply: () => CONCIERGE.showrooms }),
  },
  {
    id: 'consultation',
    test: (t) => /\b(book|arrange|schedule|reserve|appointment|consultation|consult|private viewing|viewing|meet (a|the) designer|visit .*designer)\b/.test(t),
    plan: (t, e, ctx) => ({
      id: 'consultation',
      tools: [{ name: 'openPrivateConsultation', args: { topic: e.bridal ? 'bridal' : /\bbespoke|custom|design\b/.test(t) ? 'bespoke' : 'viewing', productSlug: ctx.currentProduct?.slug } }],
      reply: () => CONCIERGE.consultation,
    }),
  },
  {
    id: 'price',
    test: (t) => /\b(price|cost|how much|rate|budget)\b/.test(t),
    plan: (_t, _e, ctx) => {
      const slug = ctx.currentProduct?.slug ?? ctx.focusedProduct?.slug ?? ctx.recentResults[0]?.slug;
      const p = slug ? getProduct(slug) : undefined;
      return {
        id: 'price',
        tools: [],
        reply: () => (p && p.price.kind === 'fixed' ? CONCIERGE.priceKnown(formatPrice(p.price), p.spec.purity) : CONCIERGE.priceOnRequest),
      };
    },
  },
  {
    id: 'wishlist_open',
    test: (t) => /\b(my (selection|wishlist|saved|favou?rites|pieces|list)|what (have|did) i (save|keep)|show .*selection|in my selection)\b/.test(t),
    plan: () => ({
      id: 'wishlist_open',
      tools: [{ name: 'openWishlist', args: {} }],
      reply: (o) => {
        const pieces = firstPieces(o);
        if (pieces.length === 0) return CONCIERGE.wishlistEmpty;
        return CONCIERGE.wishlist(pieces.length, capitalise(countInWords(pieces.length)));
      },
    }),
  },
  {
    id: 'wishlist_remove',
    test: (t) => /\b(remove|unsave|delete|take .*out|set .*aside|hata\w*|nikal\w*)\b/.test(t),
    plan: (_t, e, ctx) => ({ id: 'wishlist_remove', tools: [{ name: 'removeFromWishlist', args: e.ordinal !== null && resolveOrdinal(e.ordinal, ctx)?.kind === 'product' ? { slug: resolveOrdinal(e.ordinal, ctx)!.slug } : {} }], reply: (o) => (o[0]?.label ? CONCIERGE.removed : CONCIERGE.whichPieceToSave) }),
  },
  {
    id: 'wishlist_save',
    test: (t) => /\b(save|keep|shortlist|wishlist|remember|hold|i (like|love) (this|that|it)|add .*(selection|wishlist))\b/.test(t),
    plan: (_t, e, ctx) => ({
      id: 'wishlist_save',
      tools: [{ name: 'saveToWishlist', args: e.ordinal !== null && resolveOrdinal(e.ordinal, ctx)?.kind === 'product' ? { slug: resolveOrdinal(e.ordinal, ctx)!.slug } : {} }],
      reply: (o) => {
        const out = o[0];
        if (!out || out.label === '') return CONCIERGE.whichPieceToSave;
        return (out.result as { already?: boolean }).already ? CONCIERGE.alreadySaved : CONCIERGE.saved;
      },
    }),
  },
  {
    id: 'similar',
    test: (_t, e) => e.similar,
    plan: () => ({
      id: 'similar',
      tools: [{ name: 'showSimilarPieces', args: {} }],
      reply: (o) => {
        const out = o[0];
        if (!out || out.label === '') return CONCIERGE.whichPieceSimilar;
        const pieces = firstPieces(o);
        return pieces.length === 4 ? CONCIERGE.similar : CONCIERGE.similarCount(capitalise(countInWords(pieces.length)));
      },
    }),
  },
  {
    id: 'ordinal_open',
    test: (_t, e) => e.ordinal !== null,
    plan: (_t, e, ctx) => {
      const target = resolveOrdinal(e.ordinal ?? 1, ctx);
      if (!target) return { id: 'ordinal_open', tools: [], reply: () => CONCIERGE.whichPiece };
      if (target.kind === 'collection') return { id: 'ordinal_open', tools: [{ name: 'showCollection', args: { slug: target.slug } }], reply: (o) => o[0]?.label ?? CONCIERGE.whichPiece };
      const p = getProduct(target.slug);
      return { id: 'ordinal_open', tools: [{ name: 'openProduct', args: { slug: target.slug } }], reply: () => (p ? CONCIERGE.opened(nameOf(p)) : CONCIERGE.whichPiece) };
    },
  },
  {
    id: 'named_open',
    test: (t, e) => /\b(open|show|view|see|take me to|go to|tell me (more )?about|details)\b/.test(t) && !e.deictic && !!findByName(t) && !e.world && !/\bcollections?\b/.test(t),
    plan: (t) => {
      const p = findByName(t)!;
      if (/\btell me\b|\babout\b|\bdetails\b/.test(t)) {
        const specs = specsLine(p.slug);
        return { id: 'named_tell', tools: [{ name: 'focusProduct', args: { slug: p.slug } }], reply: () => (specs ? CONCIERGE.tellAboutSpecs(nameOf(p), (p.story?.lede ?? describe(p)), specs) : CONCIERGE.tellAbout(nameOf(p), (p.story?.lede ?? describe(p)))) };
      }
      return { id: 'named_open', tools: [{ name: 'openProduct', args: { slug: p.slug } }], reply: () => CONCIERGE.opened(nameOf(p)) };
    },
  },
  {
    id: 'deictic_tell',
    test: (t, e, ctx) => e.deictic && /\b(tell me|about|details|what is|describe)\b/.test(t) && !!(ctx.currentProduct ?? ctx.focusedProduct),
    plan: (_t, _e, ctx) => {
      const slug = (ctx.currentProduct ?? ctx.focusedProduct)!.slug;
      const p = getProduct(slug)!;
      const specs = specsLine(slug);
      return { id: 'deictic_tell', tools: [], reply: () => (specs ? CONCIERGE.tellAboutSpecs(nameOf(p), (p.story?.lede ?? describe(p)), specs) : CONCIERGE.tellAbout(nameOf(p), (p.story?.lede ?? describe(p)))) };
    },
  },
  {
    id: 'deictic_open',
    test: (t, e, ctx) => e.deictic && /\b(open|view|see)\b/.test(t) && !!(ctx.focusedProduct ?? ctx.recentResults[0]),
    plan: (_t, _e, ctx) => {
      const slug = (ctx.focusedProduct ?? ctx.recentResults[0])!.slug;
      const p = getProduct(slug);
      return { id: 'deictic_open', tools: [{ name: 'openProduct', args: { slug } }], reply: () => (p ? CONCIERGE.opened(nameOf(p)) : CONCIERGE.whichPiece) };
    },
  },
  {
    id: 'collection_named',
    test: (_t, e) => !!e.world,
    plan: (_t, e) => {
      const w = WORLDS.find((x) => x.slug === e.world)!;
      return { id: 'collection_named', tools: [{ name: 'showCollection', args: { slug: w.slug } }], reply: () => CONCIERGE.world(w.name, w.mood) };
    },
  },
  {
    id: 'collections_overview',
    test: (t, e) => /\b(collections?|worlds|range|what do you have|catalogue|everything)\b/.test(t) && !e.category && !e.bridal,
    plan: () => ({ id: 'collections_overview', tools: [{ name: 'scrollToSection', args: { section: 'collections' } }], reply: () => CONCIERGE.collections }),
  },
  {
    id: 'bridal_route',
    test: (t, e) => e.bridal && !e.category && (/\b(take me|go to|open|explore|enter|house)\b/.test(t) || /^(show me )?bridal$/.test(t)),
    plan: () => ({ id: 'bridal_route', tools: [{ name: 'showBridal', args: {} }], reply: () => CONCIERGE.bridal }),
  },
  { id: 'diamond_world', test: (t, e) => e.material === 'diamond' && !e.category && !e.bridal && /\b(show|see|diamond)\b/.test(t), plan: () => ({ id: 'diamond_world', tools: [{ name: 'showDiamond', args: {} }], reply: () => CONCIERGE.diamond }) },
  { id: 'gold_world', test: (t, e) => e.material === 'gold' && !e.category && !e.bridal && !e.traditional && /\b(show|see|gold)\b/.test(t), plan: () => ({ id: 'gold_world', tools: [{ name: 'showGold', args: {} }], reply: () => CONCIERGE.gold }) },
  {
    id: 'traditional',
    test: (_t, e) => e.traditional,
    plan: (_t, e) => ({ id: 'traditional', tools: [{ name: 'searchProducts', args: { style: 'traditional', category: e.category, limit: 4 } }], reply: () => CONCIERGE.traditional }),
  },
  {
    id: 'search',
    test: (t, e) => !!e.category || !!e.material || e.bridal || /\b(show|find|looking for|want|something|pieces|jewellery|jewelry)\b/.test(t),
    plan: (t, e) => {
      const args: Record<string, unknown> = { limit: 4 };
      if (e.category) args.category = e.category;
      if (e.material) args.material = e.material;
      if (e.bridal) args.style = 'bridal';
      if (!e.category && !e.material && !e.bridal) args.query = t;
      const what = [e.bridal ? 'bridal' : null, e.material, e.category ? (e.category === 'set' ? 'sets' : e.category === 'ring' ? 'rings' : e.category === 'necklace' || e.category === 'choker' ? 'necklaces' : e.category) : 'pieces'].filter(Boolean).join(' ');
      return search('search', args, what);
    },
  },
  {
    id: 'out_of_scope',
    test: (t) => /\b(weather|joke|poem|code|news|crypto|stock|football|cricket|recipe)\b/.test(t),
    plan: () => ({ id: 'out_of_scope', tools: [], reply: () => CONCIERGE.outOfScope }),
  },
];

export function planFor(text: string, ctx: SiteContext): Plan {
  /**
   * The twelve core actions are answered first, by a parser that scores every reading of
   * the sentence in five languages and acts only above a confidence floor. Everything else
   * falls through to the table below, which is ordered and where first match wins — the
   * shape that once let the bare word "watch" pre-empt every command after it.
   */
  const core = corePlan(text, ctx);
  if (core) return core;

  const t = normalise(text);
  const e = extract(t);
  for (const c of COMMANDS) {
    try {
      if (c.test(t, e, ctx)) return c.plan(t, e, ctx);
    } catch {
      /* try the next command */
    }
  }
  const named = findByName(t);
  if (named) return { id: 'named_fallback', tools: [{ name: 'openProduct', args: { slug: named.slug } }], reply: () => CONCIERGE.opened(nameOf(named)) };
  return { id: 'unknown', tools: [], reply: () => CONCIERGE.unknown };
}

/** Used by the ENQUIRE flow: an opening line about the piece in view. */
export function introFor(slug: string) {
  const p = getProduct(slug);
  if (!p) return CONCIERGE.unknown;
  const specs = specsLine(slug);
  return specs ? CONCIERGE.tellAboutSpecs(nameOf(p), (p.story?.lede ?? describe(p)), specs) : CONCIERGE.tellAbout(nameOf(p), (p.story?.lede ?? describe(p)));
}

export function selectionIntro(slugs: string[]) {
  const names = productsBySlugs(slugs).map((p) => nameOf(p));
  return names.length ? CONCIERGE.selectionIntro(names) : CONCIERGE.wishlistEmpty;
}

export { similarTo };
