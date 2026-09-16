/**
 * Devanagari to Roman, the way Pakistanis text.
 *
 * A transcription model asked for Roman Urdu will sometimes write Hindi in Devanagari — the
 * same words, a script a Lahore visitor does not read on a jeweller's website. This turns
 * those runs into plain Latin letters and leaves every other script alone: Urdu script stays
 * Urdu, English stays English. It is a safety net for what is *shown*, never what is heard.
 */

const VOWELS: Record<string, string> = { अ: 'a', आ: 'aa', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o' };
const SIGNS: Record<string, string> = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o' };
const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'w', श: 'sh', ष: 'sh', स: 's', ह: 'h',
  क़: 'q', ख़: 'kh', ग़: 'gh', ज़: 'z', ड़: 'r', ढ़: 'rh', फ़: 'f', ळ: 'l', य़: 'y',
};
const NUKTA: Record<string, string> = { क: 'q', ख: 'kh', ग: 'gh', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f' };
const VIRAMA = '्';
const NUKTA_MARK = '़';
const ANUSVARA = 'ं';
const CANDRABINDU = 'ँ';
const VISARGA = 'ः';
const DEVANAGARI = /[ऀ-ॿ]/;

/** Gurmukhi, the same way: a Punjabi transcript in the Indian script becomes the Roman a Lahori reads. */
const G_VOWELS: Record<string, string> = { ਅ: 'a', ਆ: 'aa', ਇ: 'i', ਈ: 'i', ਉ: 'u', ਊ: 'u', ਏ: 'e', ਐ: 'ai', ਓ: 'o', ਔ: 'au' };
const G_SIGNS: Record<string, string> = { 'ਾ': 'a', 'ਿ': 'i', 'ੀ': 'i', 'ੁ': 'u', 'ੂ': 'u', 'ੇ': 'e', 'ੈ': 'ai', 'ੋ': 'o', 'ੌ': 'au' };
const G_CONSONANTS: Record<string, string> = {
  ਕ: 'k', ਖ: 'kh', ਗ: 'g', ਘ: 'gh', ਙ: 'n', ਚ: 'ch', ਛ: 'chh', ਜ: 'j', ਝ: 'jh', ਞ: 'n', ਟ: 't', ਠ: 'th', ਡ: 'd', ਢ: 'dh', ਣ: 'n',
  ਤ: 't', ਥ: 'th', ਦ: 'd', ਧ: 'dh', ਨ: 'n', ਪ: 'p', ਫ: 'ph', ਬ: 'b', ਭ: 'bh', ਮ: 'm', ਯ: 'y', ਰ: 'r', ਲ: 'l', ਵ: 'w', ਸ: 's', ਹ: 'h',
  ਸ਼: 'sh', ਖ਼: 'kh', ਗ਼: 'gh', ਜ਼: 'z', ਫ਼: 'f', ਲ਼: 'l',
};
const G_NUKTA: Record<string, string> = { ਸ: 'sh', ਖ: 'kh', ਗ: 'gh', ਜ: 'z', ਫ: 'f', ਲ: 'l' };
const G_VIRAMA = '੍';
const G_NUKTA_MARK = '਼';
const G_NASALS = new Set(['ਂ', 'ੰ', 'ਁ']);
const G_ADDAK = 'ੱ';
const GURMUKHI = /[਀-੿]/;
const isGurmukhi = (ch: string) => GURMUKHI.test(ch);

function romaniseGurmukhiRun(run: string): string {
  const chars = [...run.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === '।' || ch === '॥') {
      out += '.';
      continue;
    }
    if (G_VOWELS[ch]) {
      out += G_VOWELS[ch];
      continue;
    }
    if (G_NASALS.has(ch)) {
      out += 'n';
      continue;
    }
    if (ch === G_VIRAMA || ch === G_NUKTA_MARK || ch === G_ADDAK || G_SIGNS[ch]) continue;
    let latin = G_CONSONANTS[ch];
    if (latin === undefined) {
      out += ch;
      continue;
    }
    let next = chars[i + 1];
    if (next === G_NUKTA_MARK) {
      latin = G_NUKTA[ch] ?? latin;
      i += 1;
      next = chars[i + 1];
    }
    out += latin;
    if (next === G_VIRAMA) {
      i += 1;
      continue;
    }
    if (next && G_SIGNS[next]) {
      out += G_SIGNS[next];
      i += 1;
      continue;
    }
    if (next && isGurmukhi(next)) out += 'a';
  }
  return out;
}

const isDevanagari = (ch: string) => DEVANAGARI.test(ch);

function romaniseRun(run: string): string {
  const chars = [...run.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === '।' || ch === '॥') {
      out += '.';
      continue;
    }
    if (VOWELS[ch]) {
      out += VOWELS[ch];
      continue;
    }
    if (ch === ANUSVARA || ch === CANDRABINDU) {
      out += 'n';
      continue;
    }
    if (ch === VISARGA) {
      out += 'h';
      continue;
    }
    if (ch === VIRAMA || ch === NUKTA_MARK || SIGNS[ch]) continue; // consumed with the consonant before it
    let latin = CONSONANTS[ch];
    if (latin === undefined) {
      out += ch;
      continue;
    }
    let next = chars[i + 1];
    if (next === NUKTA_MARK) {
      latin = NUKTA[ch] ?? latin;
      i += 1;
      next = chars[i + 1];
    }
    out += latin;
    if (next === VIRAMA) {
      i += 1; // a bare consonant: no vowel follows
      continue;
    }
    if (next && SIGNS[next]) {
      out += SIGNS[next];
      i += 1;
      continue;
    }
    // the inherent 'a', dropped at the end of a word as it is in speech
    if (next && isDevanagari(next)) out += 'a';
  }
  return out;
}

/** Only the Devanagari and Gurmukhi runs are touched; everything around them is returned as it was. */
export function romaniseDevanagari(text: string): string {
  let out = text;
  if (DEVANAGARI.test(out)) out = out.replace(/[ऀ-ॿ]+/g, (run) => romaniseRun(run));
  if (GURMUKHI.test(out)) out = out.replace(/[਀-੿]+/g, (run) => romaniseGurmukhiRun(run));
  return out;
}
