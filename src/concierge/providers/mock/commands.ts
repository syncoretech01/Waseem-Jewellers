import { WORLDS } from '@/data/worlds';
import { byName, getRow, similarRows, describeRow, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { useConciergeStore } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { ordinalFromWord, resolveOrdinal } from '../../ordinals';
import { parse, type IntentFrame } from '../../nlu/parse';
import { tokenize, fold } from '../../nlu/script';
import { nextAck, replies, resolveReplyLanguage, subjectIn, showroomNameIn, type Replies, type ReplyLanguage } from '../../replies';
import { missingFields, resolveShowroom } from '../../tools/appointment';
import { CONCIERGE } from '../../copy';
import { corePlan } from './corePlan';
import type { SiteContext, ToolName, ToolOutcome } from '../../types';

/**
 * A plan the mock executes: zero or more tool calls, then a reply built from their outcomes.
 *
 * `ack` is the one word said as the action starts — "Ji." / "Of course." — streamed before
 * the tools run, so the visitor hears it while the page moves. `reply` is what is said once
 * the outcomes are known; for an action command it is empty, because the ack was the whole
 * reply. `retry` is the same request with the carried conditions set aside, run only when
 * the first tools brought nothing.
 */
export interface Plan {
  id: string;
  tools: { name: ToolName; args: Record<string, unknown> }[];
  reply: (outcomes: ToolOutcome[], ctx: SiteContext) => string;
  ack?: string;
  retry?: { name: ToolName; args: Record<string, unknown> }[];
  /** The language the reply is written in, resolved once per sentence. */
  language: ReplyLanguage;
  intent?: string;
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
  const o = outcomes.find((x) => x.ui?.kind === 'pieces');
  return o?.ui && o.ui.kind === 'pieces' ? o.ui.pieces : [];
}

const specsLine = (slug: string) => {
  const r = getRow(slug);
  return r ? specLineOf(r) : '';
};

/**
 * A piece, described: the authored English lede with what is published, or — in any other
 * language, where no lede is written — the name and the published figures alone. Nothing is
 * translated that was not written, and nothing is said that was not published.
 */
function tellAbout(language: ReplyLanguage, R: Replies, slug: string): string {
  const p = getRow(slug);
  if (!p) return R.clarify;
  const specs = specsLine(slug);
  if (language !== 'en') return R.tellAbout(p.t, specs);
  return specs ? CONCIERGE.tellAboutSpecs(p.t, describeRow(p), specs) : CONCIERGE.tellAbout(p.t, describeRow(p));
}

/** The kind, as the entity table names it, in the shape the reply layer takes. */
const CATEGORY_OF: Record<NonNullable<Entities['category']>, string> = { necklace: 'necklace', choker: 'necklace', set: 'bridal-set', earrings: 'earrings', ring: 'ring', bangle: 'bangle', bracelet: 'bracelet' };

/** The one language-independent way to ask which piece: whether anything has been shown yet. */
const anyShown = (ctx: SiteContext) => ctx.recentResults.length > 0 || ctx.visibleProducts.length > 0;

/** "A showroom, named in the sentence" — Liberty, MM Alam, DHA, Gulberg — or nothing. */
export function showroomIn(folded: string): string | undefined {
  const m = folded.match(/\b(liberty|mm alam|m m alam|alam road|alam|dha|gulberg|defence)\b/);
  if (m) return resolveShowroom(m[1] === 'defence' ? 'dha' : m[1]!);
  // the voice model writes Urdu speech in Nastaliq: the three showrooms as it spells them
  if (/لیبرٹی|لبرٹی/.test(folded)) return resolveShowroom('liberty');
  if (/ایم ایم عالم|ایم ایم علام|عالم روڈ/.test(folded)) return resolveShowroom('mm alam');
  if (/ڈی ایچ ا[ےی]|ڈیفنس/.test(folded)) return resolveShowroom('dha');
  return undefined;
}

/**
 * The appointment's reply, after `fillAppointment` or `openAppointment`: what was noted, and
 * the first thing still needed — one field, never a list. The form is on screen; the
 * concierge asks only for what it lacks.
 */
export function appointmentReply(R: Replies, noted: string | undefined, outcome: ToolOutcome | undefined): string {
  if (outcome && outcome.label === '') return R.error;
  const missing = missingFields(useSiteStore.getState().consultation.draft);
  const first = missing[0];
  const ask = first && first in R.ask ? R.ask[first as keyof Replies['ask']] : undefined;
  if (noted) return ask ? `${R.noted(noted)} — ${ask}` : R.allNoted;
  return ask ? (first === 'name' ? R.formOpen : `${R.formOpen.split(' — ')[0]} — ${ask}`) : R.allNoted;
}

// ── the ordered command table (first match wins) ──────────────────────────────

interface Reading {
  t: string;
  e: Entities;
  ctx: SiteContext;
  R: Replies;
  language: ReplyLanguage;
  folded: string;
  tokens: string[];
}

type Command = { id: string; test: (r: Reading) => boolean; plan: (r: Reading) => Plan };

const action = (id: string, language: ReplyLanguage, tools: Plan['tools'], reply: Plan['reply'] = () => ''): Plan => ({ id, language, tools, ack: nextAck(language), reply });
const say = (id: string, language: ReplyLanguage, text: string): Plan => ({ id, language, tools: [], reply: () => text });

const search = (id: string, language: ReplyLanguage, args: Record<string, unknown>, subject: Parameters<typeof subjectIn>[1]): Plan => ({
  id,
  language,
  tools: [{ name: 'searchProducts', args }],
  reply: (o) => {
    const R = replies(language);
    const pieces = firstPieces(o);
    return pieces.length === 0 ? R.nothing : R.searchResult(pieces.length, subjectIn(language, subject, pieces.length));
  },
});

/** The chrome commands a visitor gives in one or two words: back, in five languages. */
const BACK = new Set(['back', 'wapas', 'wapis', 'vapas', 'peeche', 'pichhe', 'piche', 'pichay', 'واپس', 'پچھے', 'ਵਾਪਸ', 'ਪਿੱਛੇ']);

export const COMMANDS: Command[] = [
  {
    id: 'greeting',
    test: ({ t }) => /^(hi|hello|hey|salam|salaam|assalam\w*|as-salam\w*|good (morning|afternoon|evening))\b/.test(t) && t.length < 40,
    plan: ({ ctx, R, language }) => say('greeting', language, R.greeting(ctx.localHour)),
  },
  { id: 'thanks', test: ({ t, e }) => /\b(thank\w*|thanks|lovely|perfect|wonderful)\b/.test(t) && !e.category && !e.material, plan: ({ R, language }) => say('thanks', language, R.thanks) },
  { id: 'close', test: ({ t }) => /\b(close|bye|goodbye|khuda hafiz|allah hafiz|that'?s all|nothing else|that is all)\b/.test(t), plan: ({ R, language }) => say('close', language, R.close) },
  {
    id: 'back',
    test: ({ tokens, e }) => tokens.length <= 4 && tokens.some((w) => BACK.has(w)) && !e.category && !e.material,
    plan: ({ language }) => ({
      ...action('back', language, [{ name: 'navigate', args: { target: 'back' } }]),
      // there was nowhere to go back to: said, with the one alternative
      reply: (o) => (o[0]?.label === '' ? replies(language).noEarlierPage : ''),
    }),
  },
  { id: 'help', test: ({ t }) => /\b(what can you do|help|options|how does this work|what do you do)\b/.test(t), plan: ({ R, language }) => say('help', language, R.help) },
  { id: 'watches', test: ({ t }) => /\b(watches|wrist ?watch|tag heuer|rado|tissot)\b/.test(t) || /\bwatch\b(?=\s*(department|brands?|collection))/.test(t), plan: ({ R, language }) => say('watches', language, R.watches) },
  {
    id: 'about_house',
    // copy-guard-allow: matches what a visitor might say, not what we say
    test: ({ t }) => (/\b(tell me about|about|who (are|is)|history|heritage|story|founder|founded|1952|generations?|the house)\b/.test(t) && /\b(waseem|house|you|yourself|jewellers|brand)\b/.test(t)) || /^(waseem|waseem jewellers)$/.test(t),
    plan: ({ R, language }) => ({ id: 'about_house', language, tools: [{ name: 'scrollToSection', args: { section: 'heritage' } }], reply: () => R.house }),
  },
  {
    id: 'showrooms',
    test: ({ t }) => /\b(where are you|showrooms?|stores?|location|address|hours|timing|open (till|until)|contact|phone|whatsapp|visit you)\b/.test(t),
    plan: ({ R, language }) => ({ id: 'showrooms', language, tools: [{ name: 'scrollToSection', args: { section: 'footer' } }], reply: () => R.showrooms }),
  },
  {
    id: 'compare',
    // copy-guard-allow: what a visitor might say
    test: ({ t }) => /\b(compare|comparison|side by side|versus|vs\.?|muqabla|farq)\b/.test(t),
    plan: ({ t, ctx, R, language }) => {
      // "the first two" / "the second and the third" / "it with the second" / "these two":
      // the ordinals named, then the piece in view, then what was just shown
      const named = [...t.matchAll(/\b(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th|last)\b/g)].map((m) => (m[1] === 'last' ? -1 : (ordinalFromWord(m[1]!) ?? 1)));
      let slugs = named.map((n) => resolveOrdinal(n, ctx)).flatMap((x) => (x && x.kind === 'product' ? [x.slug] : []));
      const firstFew = t.match(/\b(?:first|top) (two|three|2|3)\b/);
      if (firstFew) slugs = ctx.recentResults.slice(0, /three|3/.test(firstFew[1]!) ? 3 : 2).map((r) => r.slug);
      if (slugs.length < 2) {
        const pool = [ctx.currentProduct?.slug, ctx.focusedProduct?.slug, ...ctx.recentResults.map((r) => r.slug)].filter((s): s is string => Boolean(s));
        slugs = [...new Set([...slugs, ...pool])].slice(0, 2);
      }
      const unique = [...new Set(slugs)].slice(0, 3);
      return {
        id: 'compare',
        language,
        tools: unique.length >= 2 ? [{ name: 'comparePieces', args: { slugs: unique } }] : [],
        reply: (o) => {
          const ui = o[0]?.ui;
          return ui && ui.kind === 'compare' ? R.compared(ui.pieces.map((p) => p.name)) : R.whichToCompare;
        },
      };
    },
  },
  /**
   * While the appointment form is open, a bare answer is the field it answers: a showroom by
   * name, a telephone number, an occasion. A name is not read here — any sentence would then
   * be a name — and stays the visitor's to type into the field on screen.
   */
  {
    id: 'appointment_field',
    test: ({ ctx, folded, tokens }) => ctx.appointmentOpen && tokens.length <= 4 && (Boolean(showroomIn(folded)) || /^\+?[\d\s-]{7,}$/.test(folded) || /^(gift|bridal|bespoke|viewing|a viewing)$/.test(folded)),
    plan: ({ folded, language, R }) => {
      const showroom = showroomIn(folded);
      const phone = /^\+?[\d\s-]{7,}$/.test(folded) ? folded : undefined;
      const occasion = /^(gift|bridal|bespoke|viewing|a viewing)$/.test(folded) ? folded.replace(/^a /, '') : undefined;
      const args: Record<string, unknown> = {};
      if (showroom) args.showroom = showroom;
      if (phone) args.phone = phone;
      if (occasion) args.occasion = occasion;
      const noted = showroom ? showroomNameIn(language, showroom) : phone ? R.ask.phone.replace(/\?$/, '') : occasion ? occasion : undefined;
      return { ...action('appointment_field', language, [{ name: 'fillAppointment', args }]), reply: (o) => appointmentReply(R, noted, o[0]) };
    },
  },
  {
    id: 'consultation',
    // copy-guard-allow: what a visitor might say, in the words they use
    test: ({ t }) => /\b(book|arrange|schedule|reserve|appointment|consultation|consult|private viewing|viewing|meet (a|the) designer|visit .*designer)\b/.test(t),
    plan: ({ t, e, folded, language, R }) => {
      const showroom = showroomIn(folded);
      const occasion = e.bridal ? 'bridal' : /\bbespoke|custom|design\b/.test(t) ? 'bespoke' : undefined;
      const args: Record<string, unknown> = {};
      if (showroom) args.showroom = showroom;
      if (occasion) args.occasion = occasion;
      const noted = showroom ? showroomNameIn(language, showroom) : undefined;
      return { ...action('consultation', language, [{ name: 'fillAppointment', args }]), reply: (o) => appointmentReply(R, noted, o[0]) };
    },
  },
  {
    id: 'price',
    test: ({ t }) => /\b(price|cost|how much|rate|budget)\b/.test(t),
    plan: ({ ctx, R, language }) => {
      const slug = ctx.currentProduct?.slug ?? ctx.focusedProduct?.slug ?? ctx.recentResults[0]?.slug;
      const p = slug ? getRow(slug) : undefined;
      // a published price is said off the homepage only, where the pages themselves carry it
      const priced = p && p.p > 0 && ctx.routeKind !== 'home';
      return say('price', language, priced ? R.priceKnown(priceLabelOf(p)) : R.priceOnRequest);
    },
  },
  /**
   * Saving is not offered on this build. The three wishlist commands stay recognised so the
   * sentence is answered with what the concierge can do — never with silence or a search
   * that was not asked for.
   */
  {
    id: 'selection_not_offered',
    test: ({ t }) => /\b(my (selection|wishlist|saved|favou?rites|list)|what (have|did) i (save|keep)|show .*selection|in my selection)\b/.test(t),
    plan: ({ R, language }) => say('selection_not_offered', language, R.selectionNotOffered),
  },
  {
    id: 'saving_not_offered',
    test: ({ t, e }) => !e.category && !e.material && /\b(save|keep|shortlist|wishlist|unsave|add .*(selection|wishlist)|remove .*(selection|wishlist))\b/.test(t),
    plan: ({ R, language }) => say('saving_not_offered', language, R.savingNotOffered),
  },
  {
    id: 'similar',
    test: ({ e }) => e.similar,
    plan: ({ R, language }) => ({
      id: 'similar',
      language,
      tools: [{ name: 'showSimilarPieces', args: {} }],
      reply: (o) => {
        const out = o[0];
        if (!out || out.label === '') return R.whichPieceSimilar;
        return R.similar(firstPieces(o).length);
      },
    }),
  },
  {
    id: 'ordinal_open',
    test: ({ e }) => e.ordinal !== null,
    plan: ({ e, ctx, R, language }) => {
      const target = resolveOrdinal(e.ordinal ?? 1, ctx);
      if (!target) return say('ordinal_open', language, R.whichPiece(anyShown(ctx)));
      if (target.kind === 'collection') return action('ordinal_open', language, [{ name: 'showCollection', args: { slug: target.slug } }], (o) => (o[0]?.label ? '' : R.whichPiece(anyShown(ctx))));
      return action('ordinal_open', language, [{ name: 'openProduct', args: { slug: target.slug } }], (o) => (o[0]?.label ? '' : R.whichPiece(anyShown(ctx))));
    },
  },
  {
    id: 'named_open',
    test: ({ t, e }) => /\b(open|show|view|see|take me to|go to|tell me (more )?about|details)\b/.test(t) && !e.deictic && !!byName(t) && !e.world && !/\bcollections?\b/.test(t),
    plan: ({ t, R, language }) => {
      const p = byName(t)!;
      if (/\btell me\b|\babout\b|\bdetails\b/.test(t)) {
        return { id: 'named_tell', language, tools: [{ name: 'focusProduct', args: { slug: p.s } }], reply: () => tellAbout(language, R, p.s) };
      }
      return action('named_open', language, [{ name: 'openProduct', args: { slug: p.s } }], (o) => (o[0]?.label ? '' : R.error));
    },
  },
  {
    id: 'deictic_tell',
    test: ({ t, e, ctx }) => e.deictic && /\b(tell me|about|details|what is|describe)\b/.test(t) && !!(ctx.currentProduct ?? ctx.focusedProduct),
    plan: ({ ctx, R, language }) => {
      const slug = (ctx.currentProduct ?? ctx.focusedProduct)!.slug;
      return say('deictic_tell', language, tellAbout(language, R, slug));
    },
  },
  {
    id: 'deictic_open',
    test: ({ t, e, ctx }) => e.deictic && /\b(open|view|see)\b/.test(t) && !!(ctx.focusedProduct ?? ctx.recentResults[0]),
    plan: ({ ctx, R, language }) => {
      const slug = (ctx.focusedProduct ?? ctx.recentResults[0])!.slug;
      return action('deictic_open', language, [{ name: 'openProduct', args: { slug } }], (o) => (o[0]?.label ? '' : R.whichPiece(anyShown(ctx))));
    },
  },
  {
    id: 'collection_named',
    test: ({ e }) => !!e.world,
    plan: ({ e, language }) => {
      const w = WORLDS.find((x) => x.slug === e.world)!;
      return action('collection_named', language, [{ name: 'showCollection', args: { slug: w.slug } }]);
    },
  },
  {
    id: 'collections_overview',
    test: ({ t, e }) => /\b(collections?|worlds|range|what do you have|catalogue|everything)\b/.test(t) && !e.category && !e.bridal,
    plan: ({ R, language }) => ({ id: 'collections_overview', language, tools: [{ name: 'scrollToSection', args: { section: 'collections' } }], reply: () => R.collections }),
  },
  {
    id: 'bridal_route',
    test: ({ t, e }) => e.bridal && !e.category && (/\b(take me|go to|open|explore|enter|house)\b/.test(t) || /^(show me )?bridal$/.test(t)),
    plan: ({ language }) => action('bridal_route', language, [{ name: 'showDepartment', args: { department: 'bridal' } }]),
  },
  { id: 'diamond_world', test: ({ t, e }) => e.material === 'diamond' && !e.category && !e.bridal && /\b(show|see|diamond)\b/.test(t), plan: ({ language }) => action('diamond_world', language, [{ name: 'showDepartment', args: { department: 'diamond' } }]) },
  { id: 'gold_world', test: ({ t, e }) => e.material === 'gold' && !e.category && !e.bridal && !e.traditional && /\b(show|see|gold)\b/.test(t), plan: ({ language }) => action('gold_world', language, [{ name: 'showDepartment', args: { department: 'gold' } }]) },
  {
    id: 'traditional',
    test: ({ e }) => e.traditional,
    plan: ({ e, R, language }) => ({ id: 'traditional', language, tools: [{ name: 'searchProducts', args: { style: 'traditional', category: e.category, limit: 4 } }], reply: (o) => (firstPieces(o).length ? R.traditional : R.nothing) }),
  },
  {
    id: 'search',
    test: ({ t, e }) => !!e.category || !!e.material || e.bridal || /\b(show|find|looking for|want|something|pieces|jewellery|jewelry)\b/.test(t),
    plan: ({ t, e, language }) => {
      const args: Record<string, unknown> = { limit: 4 };
      if (e.category) args.category = e.category;
      if (e.material) args.material = e.material;
      if (e.bridal) args.style = 'bridal';
      if (!e.category && !e.material && !e.bridal) args.query = t;
      return search('search', language, args, { category: e.category ? CATEGORY_OF[e.category] : undefined, material: e.material, department: e.bridal ? 'bridal' : undefined });
    },
  },
  {
    id: 'out_of_scope',
    test: ({ t }) => /\b(weather|joke|poem|code|news|crypto|stock|football|cricket|recipe)\b/.test(t),
    plan: ({ R, language }) => say('out_of_scope', language, R.outOfScope),
  },
];

/**
 * The language of a sentence, resolved and remembered: the rule of persistence, in one place.
 *
 * A full sentence decides its language and becomes the conversation's; a short command with
 * no evidence inherits it. Remembered here, before any plan is chosen, so every reply the
 * sentence produces — from the core planner, the table, or the unknown fallback — reads the
 * same column.
 */
export function readSentence(text: string): { frame: IntentFrame; language: ReplyLanguage; tokens: string[]; folded: string } {
  const frame = parse(text);
  const folded = fold(text).replace(/[.,](?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = tokenize(folded);
  const store = useConciergeStore.getState();
  const language = resolveReplyLanguage(frame, store.memory.language, tokens.length);
  if (language !== store.memory.language) store.rememberLanguage(language);
  return { frame, language, tokens, folded };
}

export function planFor(text: string, ctx: SiteContext): Plan {
  /**
   * The twelve core actions are answered first, by a parser that scores every reading of
   * the sentence in five languages and acts only above a confidence floor. Everything else
   * falls through to the table below, which is ordered and where first match wins — the
   * shape that once let the bare word "watch" pre-empt every command after it.
   */
  const { frame, language, tokens, folded } = readSentence(text);
  const R = replies(language);
  const t = normalise(text);
  const e = extract(t);
  const reading: Reading = { t, e, ctx, R, language, folded, tokens };
  /**
   * A comparison is not one of the twelve, and its sentence carries ordinals — "the first
   * two" — that the core parser would otherwise read as "open the first". It is asked first;
   * so are the chrome commands, the appointment's own fields while its form is open, and
   * the appointment itself, whose sentence may name a showroom the core planner does not read.
   */
  for (const id of ['compare', 'back', 'appointment_field', 'consultation']) {
    const c = COMMANDS.find((x) => x.id === id);
    if (c && c.test(reading)) return { ...c.plan(reading), intent: id };
  }

  const core = corePlan(frame, language, ctx);
  if (core) return { ...core, intent: core.intent ?? frame.intent };

  for (const c of COMMANDS) {
    try {
      if (c.test(reading)) return { ...c.plan(reading), intent: c.id };
    } catch {
      /* try the next command */
    }
  }
  const named = byName(t);
  if (named) return { ...action('named_fallback', language, [{ name: 'openProduct', args: { slug: named.s } }]), intent: 'open' };
  /**
   * Not understood: one short question in the visitor's language, and nothing else. The
   * paragraph that used to stand here — what the concierge can show, open and book — was
   * read to every visitor whose sentence the engine could not parse, in English whatever
   * they had spoken. A concierge who did not catch a sentence asks for it again.
   */
  return { id: 'unknown', language, tools: [], reply: () => R.clarify, intent: 'unknown' };
}

/** Used by the ENQUIRE flow: an opening line about the piece in view. */
export function introFor(slug: string, language: ReplyLanguage = 'en') {
  return tellAbout(language, replies(language), slug);
}

export { similarRows };
