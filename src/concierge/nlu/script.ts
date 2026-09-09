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

/** Broad enough to be useful, narrow enough to be true. */
export type Language = 'en' | 'ur' | 'ur-Latn' | 'pa-Arab' | 'pa-Guru' | 'mixed';

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
export function languageOf(text: string, hints: { punjabi?: boolean; romanUrdu?: boolean } = {}, scripts = scriptsIn(text)): Language {
  const letters = scripts.filter((s) => s !== 'digit');
  if (letters.length > 1) return 'mixed';
  if (letters.includes('gurmukhi')) return 'pa-Guru';
  if (letters.includes('arabic')) return hints.punjabi ? 'pa-Arab' : 'ur';
  return hints.romanUrdu ? 'ur-Latn' : 'en';
}

export const tokenize = (folded: string): string[] => folded.split(/[\s.,]+/).filter(Boolean);
