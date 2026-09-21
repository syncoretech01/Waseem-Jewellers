/**
 * Reading what a visitor actually typed.
 *
 * A Lahore customer does not choose a language and stay in it. They write "mujhe 21K ka haar
 * چاہیے 4 lakh ke andar" and expect to be understood. So nothing here picks a language and
 * then interprets through it: the text is folded into one comparable form, every script it
 * contains is recorded, and the lexicon carries its entries in all of those scripts at once.
 * Code-switching then costs nothing, because there was never a switch to detect.
 *
 * Isomorphic by construction — no `window`, no DOM. The server route imports the same module,
 * so the model and the keyless engine receive the same reading of the same sentence.
 */

export type Script = 'latin' | 'arabic' | 'gurmukhi' | 'digit';

/**
 * Broad enough to be useful, narrow enough to be true.
 *
 * `pa-Latn` is Roman Punjabi — "menu diamond de rings dikhao" — which shares every letter
 * with Roman Urdu and English and is told apart only by its function words. It was folded
 * into `en` before, so a Punjabi sentence was answered in English.
 */
export type Language = 'en' | 'ur' | 'ur-Latn' | 'pa-Latn' | 'pa-Arab' | 'pa-Guru' | 'mixed';

const RANGES: [Script, RegExp][] = [
  ['latin', /[A-Za-z]/],
  ['arabic', /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/],
  ['gurmukhi', /[਀-੿]/],
  ['digit', /[0-9٠-٩۰-۹]/],
];

export function scriptsIn(text: string): Script[] {
  return RANGES.filter(([, re]) => re.test(text)).map(([s]) => s);
}

/** Arabic-Indic and extended Arabic-Indic digits fold to ASCII. */
const DIGIT_FOLD: Record<string, string> = {};
for (let i = 0; i < 10; i++) {
  DIGIT_FOLD[String.fromCharCode(0x0660 + i)] = String(i);
  DIGIT_FOLD[String.fromCharCode(0x06f0 + i)] = String(i);
}

/**
 * Urdu is written with several characters that have more than one Unicode spelling, and
 * which one a keyboard produces is not something a visitor should have to care about. Arabic
 * yeh and Urdu yeh, Arabic kaf and Urdu keheh, heh and heh-goal all fold together; harakat
 * and the zero-width non-joiner are dropped.
 */
const ARABIC_FOLD: [RegExp, string][] = [
  [/[ً-ٰٟۖ-ۭ]/g, ''], // harakat, superscript alef, quranic marks
  [/[​-‏‪-‮⁦-⁩]/g, ''], // zero-width and bidi controls
  [/[ىيیےې]/g, 'ی'], // alef maqsura, yeh, farsi yeh, barree yeh → farsi yeh
  [/[كک]/g, 'ک'], // kaf → keheh
  [/[هہۃە]/g, 'ہ'], // heh forms → heh goal
  [/[أإآٱ]/g, 'ا'], // hamzated alefs → alef
  [/[ؤئ]/g, 'ء'], // waw/yeh with hamza → hamza
  // do-chashmee heh (ھ) is deliberately NOT folded into heh: it is what distinguishes
  // bh, ph, kh from b, p, k, and folding it would collapse words that differ
];

/**
 * Gurmukhi: the nukta only.
 *
 * An earlier version of this stripped every dependent vowel sign, on the reasoning that
 * Gurmukhi input is inconsistently marked. It was wrong in the worst possible way: ਹਾਰ
 * (necklace) and ਹੀਰੇ (diamond) both reduce to ਹਰ, so asking for diamonds returned
 * necklaces — a confident, wrong action, which is the one failure class this engine must not
 * have. Vowels carry meaning; they stay. Both sides of every comparison are folded
 * identically, so nothing needed stripping to match in the first place.
 */
const GURMUKHI_FOLD: [RegExp, string][] = [[/਼/g, '']];

/**
 * The one normalisation every other module reads through.
 *
 * NFKC first, because a visitor pasting from WhatsApp brings presentation forms with them.
 */
export function fold(text: string): string {
  let t = text.normalize('NFKC');
  t = t.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_FOLD[d] ?? d);
  for (const [re, to] of ARABIC_FOLD) t = t.replace(re, to);
  for (const [re, to] of GURMUKHI_FOLD) t = t.replace(re, to);
  return t
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    /**
     * `\p{M}` matters more than it looks. Gurmukhi dependent vowels and Urdu marks are
     * non-spacing *marks*, not letters, so a class of letters and numbers alone replaced
     * every one of them with a space: ਹਾਰ (necklace) and ਹੀਰੇ (diamond) both became "ਹ ਰ",
     * and asking for diamonds returned necklaces. Vowels carry meaning in these scripts.
     */
    .replace(/[^\p{L}\p{M}\p{N}\s'’.,-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The language named for the visitor's benefit — a voice adapter needs one, and a reply
 * should come back in the script it was asked in.
 *
 * Script alone cannot separate Urdu from Shahmukhi Punjabi, or English from Roman Urdu:
 * both pairs share an alphabet. Vocabulary is the only thing that can, so the caller passes
 * what the lexicon actually matched. Without that evidence this reports the script's default
 * rather than guessing, which is the honest answer.
 *
 * `mixed` is a real answer and not a failure to decide: most messages this shop receives
 * genuinely are.
 */
export function languageOf(text: string, hints: { punjabi?: boolean; romanUrdu?: boolean; romanPunjabi?: boolean } = {}, scripts = scriptsIn(text)): Language {
  const letters = scripts.filter((s) => s !== 'digit');
  if (letters.length > 1) return 'mixed';
  if (letters.includes('gurmukhi')) return 'pa-Guru';
  if (letters.includes('arabic')) return hints.punjabi ? 'pa-Arab' : 'ur';
  if (hints.romanPunjabi) return 'pa-Latn';
  return hints.romanUrdu ? 'ur-Latn' : 'en';
}

export const tokenize = (folded: string): string[] => folded.split(/[\s.,]+/).filter(Boolean);

// ── which Latin-script language a sentence is in ─────────────────────────────

/**
 * Language *evidence*, not vocabulary: the closed class of function words and verb endings
 * that a Roman Urdu or Roman Punjabi sentence cannot be written without. None of these is a
 * concept — they name no kind of jewellery, no action — so they live here, beside the script
 * tables, and not in the lexicon, which is bounded by design and carries only what the twelve
 * actions need. The lexicon's own `marker` entries are a subset of these lists.
 *
 * Three sets, because the two languages share most of their small words. A word in the
 * Punjabi-only set decides Punjabi; a word in the Urdu-only set decides Urdu; a shared word
 * proves only that the sentence is not English, and which of the two it is then comes from
 * the language of the visitor's last full sentence.
 */
const PUNJABI_ONLY = new Set(['menu', 'mainu', 'tusi', 'tussi', 'tuhada', 'tuhade', 'tuhadi', 'tuhanu', 'kithe', 'kithon', 'kinne', 'kinna', 'kinni', 'hega', 'hegi', 'hai ni', 'eh', 'ehde', 'ehda', 'ehdi', 'ehnu', 'ohde', 'ohda', 'ohdi', 'ohnu', 'da', 'de', 'di', 'diyan', 'nu', 'ch', 'vich', 'wich', 'hor', 'deo', 'dio', 'devo', 'karwao', 'karwauni', 'vekhao', 'vikhao', 'vekh', 'vekhna', 'wekho', 'wekhna', 'ae', 'jehi', 'jeha', 'jehe', 'jehda', 'jehdi', 'vala', 'vale', 'vali', 'ik', 'vari', 'kehda', 'kehdi', 'kehde', 'dasso', 'dass', 'layi', 'laye', 'ton', 'te', 'sanu', 'asi', 'assi', 'chahida', 'chahidi', 'kol', 'pehlan', 'dooja', 'duja', 'tija', 'lyao', 'liao', 'kado', 'kadon', 'hun', 'hune', 'ki ae', 'sakde', 'sakdi', 'sakda', 'karde', 'kardi', 'karda', 'kariye', 'kariyo', 'ethe', 'othe', 'kiven', 'kadi']);
const URDU_ONLY = new Set(['mujhe', 'mujhay', 'mujhko', 'aap', 'aapka', 'aapki', 'aapke', 'apka', 'apki', 'apke', 'hain', 'kya', 'kyun', 'kaunsa', 'kaunsi', 'kaunse', 'ka', 'ke', 'mein', 'liye', 'liyay', 'kijiye', 'kijiyega', 'kijye', 'dijiye', 'karwani', 'karwana', 'karwa dijiye', 'chahiye', 'chahiyeh', 'chaiye', 'chahta', 'chahti', 'chahte', 'dobara', 'dubara', 'jaiye', 'jaein', 'jayen', 'dikhaiye', 'dikhayen', 'dikhaen', 'dikhaein', 'bataiye', 'batayen', 'hoon', 'humein', 'hamein', 'hamara', 'hamari', 'hamare', 'sakte', 'sakti', 'sakta', 'sakoon', 'kholiye', 'kholen', 'kholein', 'kar dijiye', 'kar dein', 'lijiye', 'lein', 'iski', 'iska', 'iske', 'uski', 'uska', 'uske', 'yahan', 'wahan', 'kahan', 'kab', 'kaise', 'kaisa', 'kaisi', 'de do', 'de dein', 'de den', 'de dijiye', 'dikha de', 'kar de', 'khol de', 'la de', 'karte', 'karti', 'karta', 'karein', 'karen', 'dekhein', 'dekhen', 'wapas jaiye', 'le chalein', 'le chaliye']);
const SHARED = new Set(['koi', 'kuch', 'kujh', 'wala', 'wali', 'wale', 'ki', 'hai', 'ne', 'karo', 'kar', 'dikhao', 'dikha', 'kholo', 'khol', 'wapas', 'wapis', 'vapas', 'peeche', 'pichhe', 'piche', 'thora', 'thoda', 'thori', 'thodi', 'nahi', 'nai', 'nahin', 'ji', 'bilkul', 'aur', 'phir', 'fir', 'fer', 'abhi', 'zara', 'bhi', 'vi', 'halka', 'halki', 'halke', 'bhari', 'bhaari', 'sa', 'si', 'se', 'ko', 'pe', 'mera', 'meri', 'mere', 'sona', 'sone', 'heera', 'heere', 'haar', 'angoothi', 'jhumke', 'jhumka', 'kangan', 'chooriyan', 'choorian', 'dulhan', 'shadi', 'shaadi', 'mulaqat', 'milna', 'qeemat', 'keemat', 'kitna', 'kitne', 'kitni', 'sasta', 'sasti', 'aisa', 'aisi', 'jaisa', 'jaisi', 'saath', 'sath', 'sab', 'saare', 'ab', 'bas', 'ghar', 'yeh', 'woh', 'wo', 'idhar', 'udhar', 'lao', 'le', 'chalo', 'chalein', 'chaliye', 'rakho', 'rakh', 'rakh lo', 'hatao', 'nikalo', 'dekhna', 'dekhni', 'dekho', 'dikhana', 'khulwa', 'acha', 'accha', 'theek', 'zaroor', 'shukriya', 'shukria', 'meherbani', 'mehrbani', 'kaun', 'kal', 'shaam', 'subah', 'raat', 'waqt', 'pehle', 'pehla', 'pehli', 'doosra', 'dusra', 'doosri', 'dusri', 'teesra', 'teesri', 'chautha', 'aakhri', 'akhri', 'jao', 'batao', 'karwa', 'karwa do', 'kar do', 'khol do', 'dikha do', 'pasand', 'sohna', 'sohni', 'sohne', 'wapas jao', 'sunao', 'suno', 'bolo', 'likho', 'likh', 'maaf', 'shayad', 'kyunke', 'lekin', 'magar', 'aaj', 'hafta', 'mahina', 'saamne', 'samne', 'saahmne']);

export type RomanEvidence = 'none' | 'shared' | 'urdu' | 'punjabi';

/**
 * What the Latin-script words of a sentence say about its language.
 *
 * Bigrams are tried first so "hai ni" (Punjabi) is not read as "hai" (shared). A single
 * Punjabi-only word decides Punjabi even beside Urdu-only ones: Lahori Punjabi borrows Urdu
 * freely, and the reverse — Urdu with a Punjabi "menu" or "tusi" in it — is not something
 * this shop is written to in.
 */
export function romanEvidence(tokens: readonly string[]): RomanEvidence {
  let urdu = false;
  let shared = false;
  for (let i = 0; i < tokens.length; i++) {
    const one = tokens[i]!;
    const two = i + 1 < tokens.length ? `${one} ${tokens[i + 1]}` : '';
    // an Urdu bigram first: "de do" is Urdu even though "de" alone is Punjabi's genitive
    if (two && URDU_ONLY.has(two)) {
      urdu = true;
      i += 1;
      continue;
    }
    if ((two && PUNJABI_ONLY.has(two)) || PUNJABI_ONLY.has(one)) return 'punjabi';
    if (URDU_ONLY.has(one)) urdu = true;
    else if ((two && SHARED.has(two)) || SHARED.has(one)) shared = true;
  }
  return urdu ? 'urdu' : shared ? 'shared' : 'none';
}

/** Whether a Latin-script word is one a Roman Urdu or Punjabi sentence is written with. Read by the voice, which must not read such a line in an English voice's cadence. */
export const isRomanWord = (word: string) => PUNJABI_ONLY.has(word) || URDU_ONLY.has(word) || SHARED.has(word);
