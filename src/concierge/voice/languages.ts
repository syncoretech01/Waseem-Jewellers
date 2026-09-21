import type { Language, Script } from '../nlu/script';

/**
 * Which engine hears, and which voice speaks, for each language this concierge answers in.
 *
 * The browser's speech APIs were not built for Lahore. There is no `pa-PK` recognition engine
 * in any browser, Urdu synthesis is absent outside a handful of platforms, and nothing at all
 * understands a sentence that changes script halfway through — which is how a Pakistani
 * customer actually writes. So this file is a table of accommodations, and every entry says
 * plainly what it is giving up.
 *
 * It is the fallback tier. The production target is a realtime model where hearing,
 * understanding and speaking are one multilingual system rather than three mismatched APIs;
 * the seam that swaps this out for it is `VoiceEngine`, and none of the UI changes when it
 * arrives.
 */

/**
 * What to set `SpeechRecognition.lang` to.
 *
 * `lang` is per-instance and a fresh instance is created for every utterance, so switching
 * costs nothing — only the source of the value changes. It used to come from
 * `navigator.language`, which is the language of the visitor's *browser* and says nothing
 * about the language they are speaking: a Lahore customer on an en-US phone asking in Urdu
 * was transcribed as English and understood as nonsense.
 */
export const RECOGNITION_LANG: Record<Language, string> = {
  en: 'en-IN',
  ur: 'ur-PK',
  /**
   * Roman Urdu is spoken Urdu written in Latin letters. An Urdu engine would return Urdu
   * script, which is not wrong but is not what the visitor is writing; `en-IN` returns Latin,
   * and the transliteration fold handles the rest.
   */
  'ur-Latn': 'en-IN',
  /** Roman Punjabi, like Roman Urdu, is Latin text: the Indian-English engine returns Latin and the fold does the rest. */
  'pa-Latn': 'en-IN',
  /**
   * No browser offers `pa-PK`. `ur-PK` transcribes Pakistani Punjabi into Urdu script
   * acceptably — the two share a script and most of a phonology — and the lexicon carries its
   * Shahmukhi entries, so the reading survives. This is an accommodation, not a solution.
   */
  'pa-Arab': 'ur-PK',
  /** Chrome only; the Gurmukhi fold turns the result into something the lexicon matches. */
  'pa-Guru': 'pa-Guru-IN',
  /** A sentence that changes script mid-way. `en-IN` is the most forgiving of the five. */
  mixed: 'en-IN',
};

export const recognitionLang = (language: Language | null | undefined): string => (language ? RECOGNITION_LANG[language] : 'en-IN');

/**
 * The language a *run of one script* should be spoken in.
 *
 * A reply can carry more than one: "The Aks-e-Noor haar — آپ اسے دیکھنا چاہیں گے؟" is one
 * sentence and two languages, and one utterance in one voice mangles whichever half loses.
 */
export const SPEECH_LANG: Record<Script, string> = {
  latin: 'en-IN',
  arabic: 'ur-PK',
  gurmukhi: 'pa-IN',
  digit: 'en-IN',
};

export interface SpeechRun {
  text: string;
  /** The BCP-47 tag this run wants. A voice for it may or may not exist. */
  lang: string;
  script: Script;
}

const RUN_RANGES: [Script, RegExp][] = [
  ['arabic', /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/],
  ['gurmukhi', /[਀-੿]/],
  ['latin', /[A-Za-z]/],
];

const scriptOf = (ch: string): Script | null => RUN_RANGES.find(([, re]) => re.test(ch))?.[0] ?? null;

/**
 * Splits a reply into runs of one script.
 *
 * Punctuation, digits and spaces carry no script of their own, so they join whichever run is
 * open rather than starting one — otherwise "Rs. 380,000" would break into four utterances
 * and be read as four separate thoughts.
 */
export function speechRuns(text: string): SpeechRun[] {
  const runs: SpeechRun[] = [];
  let current: Script | null = null;
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t && current) runs.push({ text: t, lang: SPEECH_LANG[current], script: current });
    else if (t && runs.length) runs[runs.length - 1]!.text += ` ${t}`;
    else if (t) runs.push({ text: t, lang: SPEECH_LANG.latin, script: 'latin' });
    buf = '';
  };
  for (const ch of text) {
    const s = scriptOf(ch);
    if (s && current && s !== current) {
      flush();
      current = s;
    } else if (s && !current) {
      current = s;
    }
    buf += ch;
  }
  flush();
  return runs;
}

/**
 * A voice that genuinely speaks this language, or nothing.
 *
 * Returning an English voice for an Urdu run would produce confident nonsense in the visitor's
 * ear — the failure mode the whole voice tier exists to avoid. Silence and a written reply is
 * the honest answer, and the caller says so once rather than pretending.
 */
export function voiceFor(lang: string, voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const base = lang.split('-')[0]!.toLowerCase();
  const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase());
  const same = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = exact.length ? exact : same;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

/** Within a language, the associate's register: a woman's voice, and a local one where offered. */
function scoreVoice(v: SpeechSynthesisVoice) {
  let s = 0;
  if (/^en-IN/i.test(v.lang)) s += 3;
  else if (/^en-GB/i.test(v.lang)) s += 2;
  if (/sonia|libby|neerja|heera|kate|serena|moira|fiona|female|woman|hazel|susan|asad|uzma/i.test(v.name)) s += 4;
  if (/male|david|george|ryan|daniel|mark|ravi|prabhat|james/i.test(v.name)) s -= 4;
  if (v.localService) s += 1;
  return s;
}

/**
 * Roman Urdu is read by an `en-IN` voice at a slightly slower rate.
 *
 * It is Latin text that is not English, so an English voice will mispronounce it either way —
 * but an Indian-English voice mispronounces it far less, and slowing it gives the listener
 * room to recognise words they know. `en-GB` mangles it outright.
 */
export const RATE_FOR_ROMAN_URDU = 0.9;
