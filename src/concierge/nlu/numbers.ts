/**
 * Quantities, as they are actually said in Lahore.
 *
 * "4 lakh ke around", "چار لاکھ تک", "do lakh se teen lakh", "20 gram se kam". A budget in
 * this market is stated in lakh and crore far more often than in digits, and a weight in
 * grams is the figure a buyer asks for before anything else — so both have to parse, and
 * both have to survive being written in words, in Urdu script, or in a mix.
 *
 * Small, and high-value: these two quantities are the whole of what the core actions need.
 */

/** Number words, in the scripts they arrive in. */
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, cheh: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  ایک: 1, دو: 2, تین: 3, چار: 4, پانچ: 5, چھ: 6, سات: 7, آٹھ: 8, نو: 9, دس: 10,
  ਇੱਕ: 1, ਦੋ: 2, ਤਿੰਨ: 3, ਚਾਰ: 4, ਪੰਜ: 5, ਛੇ: 6, ਸੱਤ: 7, ਅੱਠ: 8, ਨੌਂ: 9, ਦਸ: 10,
  half: 0.5, adha: 0.5, adhaa: 0.5, آدھا: 0.5,
};

/** Multipliers. `k` is included because people type it. */
const SCALES: Record<string, number> = {
  hazaar: 1_000, hazar: 1_000, hazaaar: 1_000, thousand: 1_000, k: 1_000, ہزار: 1_000, ਹਜ਼ਾਰ: 1_000,
  lakh: 100_000, lac: 100_000, lakhs: 100_000, lakhon: 100_000, لاکھ: 100_000, ਲੱਖ: 100_000,
  crore: 10_000_000, karor: 10_000_000, crores: 10_000_000, کروڑ: 10_000_000, ਕਰੋੜ: 10_000_000,
};

/** Words that mean "at most". */
const UNDER = /\b(under|below|less than|upto|up to|within|tak|se kam|kam|andar|ke andar|سے کم|تک|کے اندر|ਤੋਂ ਘੱਟ|ਤੱਕ)\b/;
/** Words that mean "at least". */
const OVER = /\b(over|above|more than|se zyada|se ziada|zyada|ziada|se upar|سے زیادہ|سے اوپر|ਤੋਂ ਵੱਧ)\b/;
/** Words that mean "about". */
const AROUND = /\b(around|about|roughly|approx|approximately|ke around|ke qareeb|qareeb|takreeban|taqreeban|کے قریب|تقریبا|لگ بھگ|ਲਗਭਗ)\b/;

const GRAM = /\b(g|gm|gms|gram|grams|grm|گرام|ਗ੍ਰਾਮ)\b/;
const KARAT = /\b(\d{2})\s*(k|kt|karat|carat|kd|کیرٹ|قیراط)\b/;

export interface Quantity {
  value: number;
  bound: 'under' | 'over' | 'around' | 'exact';
}

export interface Quantities {
  /** A budget, in rupees. */
  price?: Quantity;
  /** A gross weight, in grams. */
  weight?: Quantity;
  /** 18, 21 or 22 — stated as karat rather than as a number. */
  karat?: number;
}

const boundOf = (text: string): Quantity['bound'] => (UNDER.test(text) ? 'under' : OVER.test(text) ? 'over' : AROUND.test(text) ? 'around' : 'exact');

/**
 * Reads every "<number> <scale>" run in the text.
 *
 * A bare number with no scale and no unit is left alone: in "show me 3 rings" the 3 is a
 * count, and treating it as three rupees would be worse than not reading it at all.
 */
function magnitudes(tokens: string[]): { value: number; scaled: boolean; unit: 'gram' | null }[] {
  const out: { value: number; scaled: boolean; unit: 'gram' | null }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const n = /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : WORDS[t];
    if (n === undefined) continue;
    let value = n;
    let scaled = false;
    let unit: 'gram' | null = null;
    // "4 lakh", "4lakh", "20 gram", "20g"
    const next = tokens[i + 1];
    const glued = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(t);
    const scaleWord = next && SCALES[next] ? next : glued && SCALES[glued[2]!] ? glued[2]! : undefined;
    if (glued && SCALES[glued[2]!]) value = Number(glued[1]);
    if (scaleWord) {
      value *= SCALES[scaleWord]!;
      scaled = true;
      if (next === scaleWord) i++;
    } else if ((next && GRAM.test(next)) || (glued && GRAM.test(glued[2]!))) {
      if (glued) value = Number(glued[1]);
      unit = 'gram';
      if (next && GRAM.test(next)) i++;
    }
    out.push({ value, scaled, unit });
  }
  return out;
}

export function quantities(folded: string, tokens: string[]): Quantities {
  const found = magnitudes(tokens);
  const bound = boundOf(folded);
  const q: Quantities = {};

  const karat = KARAT.exec(folded);
  if (karat && ['18', '21', '22', '24'].includes(karat[1]!)) q.karat = Number(karat[1]);

  const weight = found.find((m) => m.unit === 'gram');
  if (weight) q.weight = { value: weight.value, bound };

  // a scaled magnitude is money: nobody weighs a bracelet in lakhs
  const money = found.find((m) => m.scaled);
  if (money) q.price = { value: money.value, bound };

  return q;
}
