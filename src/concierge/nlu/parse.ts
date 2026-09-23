import { fold, languageOf, romanEvidence, scriptsIn, tokenize, type Language, type RomanEvidence, type Script } from './script';
import { quantities, type Quantities } from './numbers';
import { conceptsIn, type Action, type Concept } from './lexicon';

/**
 * One reading of one sentence, shared by both engines.
 *
 * The model, when a key is present, receives this frame as a hint alongside the visitor's own
 * words; the keyless engine acts on it directly. That is what makes shipping the model dark
 * safe — the two engines agree about *what was asked* even when they differ on how to say it
 * back.
 *
 * The engine is deliberately narrow. It owns twelve actions and owns them reliably, and it
 * says so when it is unsure rather than acting on a guess. A confident answer on the twelve
 * beats a vague answer on everything, and open-ended understanding is the model's job.
 */

export type IntentId =
  | 'search'
  | 'open'
  | 'similar'
  | 'matching'
  | 'save'
  | 'remove'
  | 'selection'
  | 'price'
  | 'consultation'
  | 'restart'
  | 'greet'
  | 'thanks'
  | 'about'
  | 'unknown';

export interface Slots {
  category?: string;
  material?: string;
  department?: string;
  occasion?: string;
  /** Authored catalogue style, when an operator tool supplied it. */
  style?: string;
  karat?: number;
  maxWeightGrams?: number;
  minWeightGrams?: number;
  maxPricePkr?: number;
  ordinal?: number;
  deictic?: 'this' | 'that';
  comparative?: 'lighter' | 'heavier' | 'cheaper';
  /** Words that were not concepts — a piece's name, most often. */
  residue?: string;
}

export interface IntentFrame {
  intent: IntentId;
  confidence: number;
  slots: Slots;
  language: Language;
  scripts: Script[];
  /**
   * How the Latin-script language was decided: by a Punjabi-only word, an Urdu-only word, a
   * word the two share, or nothing at all. A short command with no evidence — "Second one.",
   * "Gold." — has no language of its own and inherits the conversation's.
   */
  evidence: RomanEvidence;
  /** The two best readings, when confidence is below the floor and the reply must ask. */
  alternatives: IntentId[];
  /** What the parser actually recognised — useful in the prompt and when debugging. */
  matched: string[];
}

/**
 * Below this the engine asks instead of acting.
 *
 * It is also the structural fix for a whole bug class in the engine this replaces, where
 * rules were tried in source order and the bare word "watch" pre-empted every command that
 * came after it. Nothing is ordered here: every rule scores, and the best score wins only if
 * it is good enough.
 */
export const FLOOR = 0.45;

interface Scored {
  intent: IntentId;
  score: number;
}

export function parse(text: string): IntentFrame {
  const scripts = scriptsIn(text);
  const folded = fold(text);
  const tokens = tokenize(folded);
  /**
   * Sentence-final punctuation is not part of a word. `fold` keeps '.' and ',' because
   * "4.5 lakh" and "380,000" need them, but the lexicon matches whole words between spaces,
   * so "kholo." and "Gold." — every transcript the voice tier writes ends this way — matched
   * nothing and fell to the unknown reply. A stop or comma before a space or the end is
   * cleared before matching; one inside a number is left alone.
   */
  const found = conceptsIn(folded.replace(/[.,](?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim());
  const q = quantities(folded, tokens);

  const has = (kind: Concept['kind'], value?: string) =>
    found.some((f) => f.concept.kind === kind && (value === undefined || String((f.concept as { value: unknown }).value) === value));
  const valueOf = <T>(kind: Concept['kind']): T | undefined => {
    const hit = found.find((f) => f.concept.kind === kind);
    return hit ? ((hit.concept as { value: unknown }).value as T) : undefined;
  };
  const action = (a: Action) => found.some((f) => f.concept.kind === 'action' && f.concept.value === a);
  const modifier = (m: string) => found.some((f) => f.concept.kind === 'modifier' && f.concept.value === m);

  const slots: Slots = {};
  const category = valueOf<string>('category');
  const material = valueOf<string>('material');
  const department = valueOf<string>('department');
  const occasion = valueOf<string>('occasion');
  if (category) slots.category = category;
  if (material) slots.material = material;
  if (department) slots.department = department;
  if (occasion) slots.occasion = occasion;
  if (q.karat) slots.karat = q.karat;
  applyQuantities(slots, q);

  const ordinal = valueOf<number>('ordinal');
  if (ordinal !== undefined) slots.ordinal = ordinal;
  const deictic = valueOf<'this' | 'that'>('deictic');
  if (deictic) slots.deictic = deictic;
  if (modifier('lighter')) slots.comparative = 'lighter';
  else if (modifier('heavier')) slots.comparative = 'heavier';
  else if (modifier('cheaper')) slots.comparative = 'cheaper';

  const consumed = new Set(found.flatMap((f) => f.form.split(' ')));
  const residue = tokens.filter((t) => !consumed.has(t) && !/^\d/.test(t) && t.length > 2).join(' ');
  if (residue) slots.residue = residue;

  const anySubject = Boolean(category || material || department || occasion || slots.karat || slots.maxWeightGrams || slots.maxPricePkr);

  // every rule scores; nothing is decided by source order
  const scores: Scored[] = [
    { intent: 'restart', score: action('restart') ? 0.95 : 0 },
    { intent: 'thanks', score: action('thanks') && !anySubject ? 0.92 : 0 },
    { intent: 'greet', score: action('greet') && !anySubject && tokens.length <= 4 ? 0.9 : 0 },
    { intent: 'consultation', score: action('consultation') ? 0.9 : 0 },
    { intent: 'selection', score: action('selection') ? 0.86 : 0 },
    { intent: 'about', score: action('about') && !anySubject ? 0.8 : 0 },
    { intent: 'remove', score: action('remove') ? 0.88 : 0 },
    { intent: 'save', score: action('save') ? 0.88 : 0 },
    { intent: 'price', score: action('price') ? 0.85 : 0 },
    { intent: 'matching', score: modifier('matching') ? 0.82 : 0 },
    { intent: 'similar', score: modifier('similar') || slots.comparative ? 0.8 : 0 },
    {
      intent: 'open',
      // "open the second one", "yeh kholo", or a bare ordinal after results
      score: action('open') ? 0.9 : ordinal !== undefined ? 0.72 : deictic && !anySubject ? 0.6 : 0,
    },
    {
      intent: 'search',
      // a subject is enough on its own: "gold rings" is a request, verb or no verb
      score: anySubject ? (action('show') ? 0.92 : 0.74) : action('show') ? 0.6 : 0,
    },
  ];

  const ranked = scores.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  /**
   * Vocabulary is the only thing that separates Urdu from Shahmukhi, or English from Roman
   * Urdu from Roman Punjabi. The lexicon's markers decide the Arabic-script case; for Latin
   * script the function-word evidence in `script.ts` decides, because the lexicon carries
   * "menu" and "tusi" but not "de", "hor" or "deo", and a Punjabi sentence without one of
   * its few marker words was read as English.
   */
  const punjabi = has('marker', 'punjabi');
  const evidence = romanEvidence(tokens);
  // the lexicon's Latin Punjabi markers include 'oh', which is also an English interjection: for Latin script only the function-word evidence decides
  const romanPunjabi = evidence === 'punjabi';
  const romanUrdu = evidence === 'urdu' || evidence === 'shared' || has('marker', 'roman-urdu');

  const frame: IntentFrame = {
    intent: best && best.score >= FLOOR ? best.intent : 'unknown',
    confidence: best?.score ?? 0,
    slots,
    language: languageOf(text, { punjabi, romanUrdu, romanPunjabi }, scripts),
    scripts,
    evidence: romanPunjabi ? 'punjabi' : evidence === 'none' && romanUrdu ? 'urdu' : evidence,
    alternatives: ranked.slice(0, 2).map((s) => s.intent),
    matched: found.map((f) => f.form),
  };
  return frame;
}

/**
 * A budget or a weight, turned into a bound.
 *
 * "around" widens rather than narrowing: a visitor who says four lakh will not thank anyone
 * for being shown nothing because the piece is 4.2. Twenty per cent either way is the
 * latitude a jeweller would give the same sentence.
 */
function applyQuantities(slots: Slots, q: Quantities) {
  if (q.weight) {
    const { value, bound } = q.weight;
    if (bound === 'over') slots.minWeightGrams = value;
    else if (bound === 'around') {
      slots.minWeightGrams = value * 0.8;
      slots.maxWeightGrams = value * 1.2;
    } else slots.maxWeightGrams = value;
  }
  if (q.price) {
    const { value, bound } = q.price;
    slots.maxPricePkr = bound === 'around' ? value * 1.2 : bound === 'over' ? undefined : value;
  }
}
