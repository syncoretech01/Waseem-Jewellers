import type { IntentId, Slots } from './parse';

/**
 * The development fixture set: the twelve core actions, in five languages.
 *
 * This is the engine's own test, and it is written by the same hand that wrote the lexicon —
 * which is exactly its limitation, and why it cannot be the acceptance gate. **A separate
 * blind set, written by native speakers who have not seen this file, the lexicon or the
 * intent list, is a formal Stage 2 gate.** It is scored on whether the visitor got what they
 * asked for, not on parse accuracy, and Stage 2 is not accepted without it.
 *
 * Where the keyless engine fails on that blind set and the model succeeds, that is the
 * expected division of labour. It gets recorded, not fixed by growing the lexicon.
 */
export interface Fixture {
  text: string;
  intent: IntentId;
  slots?: Partial<Slots>;
  /** For the record — which language this line is meant to exercise. */
  as: 'en' | 'ur' | 'ur-Latn' | 'pa-Guru' | 'pa-Arab' | 'mixed';
}

export const FIXTURES: Fixture[] = [
  // ── search: category ─────────────────────────────────────────────────────
  { text: 'Show me necklaces', intent: 'search', slots: { category: 'necklace' }, as: 'en' },
  { text: 'mujhe haar dikhao', intent: 'search', slots: { category: 'necklace' }, as: 'ur-Latn' },
  { text: 'مجھے ہار دکھائیں', intent: 'search', slots: { category: 'necklace' }, as: 'ur' },
  { text: 'ਮੈਨੂੰ ਹਾਰ ਦਿਖਾਓ', intent: 'search', slots: { category: 'necklace' }, as: 'pa-Guru' },
  { text: 'menu jhumke dikhao', intent: 'search', slots: { category: 'earrings' }, as: 'pa-Arab' },
  { text: 'angoothi chahiye', intent: 'search', slots: { category: 'ring' }, as: 'ur-Latn' },
  { text: 'chooriyan dikhao', intent: 'search', slots: { category: 'bangle' }, as: 'ur-Latn' },
  { text: 'Do you have cufflinks', intent: 'search', slots: { category: 'cufflink' }, as: 'en' },
  { text: 'nose pin dikhaiye', intent: 'search', slots: { category: 'nose-pin' }, as: 'ur-Latn' },

  // ── search: material ─────────────────────────────────────────────────────
  { text: 'gold rings', intent: 'search', slots: { material: 'gold', category: 'ring' }, as: 'en' },
  { text: 'sonay ki angoothi', intent: 'search', slots: { material: 'gold', category: 'ring' }, as: 'ur-Latn' },
  { text: 'ہیرے کے جھمکے', intent: 'search', slots: { material: 'diamond', category: 'earrings' }, as: 'ur' },
  { text: 'polki set dikhao', intent: 'search', slots: { material: 'polki', category: 'bridal-set' }, as: 'ur-Latn' },

  // ── search: department ───────────────────────────────────────────────────
  { text: 'Show me bridal', intent: 'search', slots: { department: 'bridal' }, as: 'en' },
  { text: 'mardana bracelet', intent: 'search', slots: { department: 'men', category: 'bracelet' }, as: 'ur-Latn' },
  { text: 'بچوں کے لیے کچھ', intent: 'search', slots: { department: 'kids' }, as: 'ur' },

  // ── search: occasion ─────────────────────────────────────────────────────
  { text: 'something for a mehndi', intent: 'search', slots: { occasion: 'mehndi' }, as: 'en' },
  { text: 'walima ke liye haar', intent: 'search', slots: { occasion: 'walima', category: 'necklace' }, as: 'ur-Latn' },

  // ── search: quantities ───────────────────────────────────────────────────
  { text: 'rings under 15 grams', intent: 'search', slots: { category: 'ring', maxWeightGrams: 15 }, as: 'en' },
  { text: '20 gram se kam', intent: 'search', slots: { maxWeightGrams: 20 }, as: 'ur-Latn' },
  { text: 'diamond ring 4 lakh ke around dikhao', intent: 'search', slots: { material: 'diamond', category: 'ring' }, as: 'ur-Latn' },
  { text: 'do lakh tak ka set', intent: 'search', slots: { maxPricePkr: 200_000, category: 'bridal-set' }, as: 'ur-Latn' },
  { text: '21K gold chain', intent: 'search', slots: { karat: 21, material: 'gold', category: 'chain' }, as: 'en' },

  // ── open ─────────────────────────────────────────────────────────────────
  { text: 'Open the second one', intent: 'open', slots: { ordinal: 2 }, as: 'en' },
  { text: 'doosra kholo', intent: 'open', slots: { ordinal: 2 }, as: 'ur-Latn' },
  { text: 'تیسرا کھولیں', intent: 'open', slots: { ordinal: 3 }, as: 'ur' },
  { text: 'ਪਹਿਲਾ ਖੋਲ੍ਹੋ', intent: 'open', slots: { ordinal: 1 }, as: 'pa-Guru' },
  { text: 'yeh kholo', intent: 'open', slots: { deictic: 'this' }, as: 'ur-Latn' },
  { text: 'aakhri wala', intent: 'open', slots: { ordinal: -1 }, as: 'ur-Latn' },

  // ── similar and matching ─────────────────────────────────────────────────
  { text: 'Show me similar pieces', intent: 'similar', as: 'en' },
  { text: 'is jaisa aur', intent: 'similar', as: 'ur-Latn' },
  { text: 'something lighter than this', intent: 'similar', slots: { comparative: 'lighter' }, as: 'en' },
  { text: 'is se halka', intent: 'similar', slots: { comparative: 'lighter' }, as: 'ur-Latn' },
  { text: 'what goes with this', intent: 'matching', as: 'en' },
  { text: 'is ke sath kya', intent: 'matching', as: 'ur-Latn' },

  // ── save, remove, selection ──────────────────────────────────────────────
  { text: 'Save this piece', intent: 'save', as: 'en' },
  { text: 'yeh rakh lo', intent: 'save', slots: { deictic: 'this' }, as: 'ur-Latn' },
  { text: 'یہ محفوظ کریں', intent: 'save', as: 'ur' },
  { text: 'remove it', intent: 'remove', as: 'en' },
  { text: 'hata do', intent: 'remove', as: 'ur-Latn' },
  { text: 'show my selection', intent: 'selection', as: 'en' },
  { text: 'meri list dikhao', intent: 'selection', as: 'ur-Latn' },

  // ── price ────────────────────────────────────────────────────────────────
  { text: 'How much is this?', intent: 'price', as: 'en' },
  { text: 'iski qeemat kya hai', intent: 'price', as: 'ur-Latn' },
  { text: 'یہ کتنے کا ہے', intent: 'price', as: 'ur' },
  { text: 'ਕੀਮਤ ਕੀ ਹੈ', intent: 'price', as: 'pa-Guru' },

  // ── consultation and restart ─────────────────────────────────────────────
  { text: 'Book a private consultation', intent: 'consultation', as: 'en' },
  { text: 'mulaqat karni hai', intent: 'consultation', as: 'ur-Latn' },
  { text: 'ملاقات کا وقت', intent: 'consultation', as: 'ur' },
  { text: 'start again', intent: 'restart', as: 'en' },
  { text: 'dobara shuru', intent: 'restart', as: 'ur-Latn' },

  // ── social and about ─────────────────────────────────────────────────────
  { text: 'hello', intent: 'greet', as: 'en' },
  { text: 'assalamualaikum', intent: 'greet', as: 'ur-Latn' },
  { text: 'shukriya', intent: 'thanks', as: 'ur-Latn' },
  { text: 'شکریہ', intent: 'thanks', as: 'ur' },
  { text: 'tell me about Waseem', intent: 'about', as: 'en' },

  // ── code-switching, which is how this shop is actually spoken to ─────────
  { text: 'mujhe 21K ka haar چاہیے', intent: 'search', slots: { karat: 21, category: 'necklace' }, as: 'mixed' },
  { text: 'ہیرے wali ring under 3 lakh', intent: 'search', slots: { material: 'diamond', category: 'ring', maxPricePkr: 300_000 }, as: 'mixed' },
  // "bridal set" is one concept, not two: the kind implies the department downstream
  { text: 'bridal set دکھائیں', intent: 'search', slots: { category: 'bridal-set' }, as: 'mixed' },
];
