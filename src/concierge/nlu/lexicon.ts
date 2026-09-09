/**
 * The words this shop is asked about, in the languages it is asked in.
 *
 * **Deliberately bounded.** An earlier plan for this file ran to nine hundred entries and
 * kept growing, which is the wrong shape for the problem: natural phrasing is unbounded, and
 * a hand-maintained lexicon chasing it is a maintenance surface that never closes. So this
 * covers the *concepts the twelve core actions need* — a kind of jewellery, a metal, a
 * department, an occasion, an action, an ordinal — and nothing else. If a word is missing,
 * the right fix is the model, not another line here.
 *
 * Entries are surface forms in every script at once: Urdu, Roman Urdu, Shahmukhi, Gurmukhi,
 * Roman Punjabi, English. That is what makes code-switching work — a sentence that changes
 * script mid-way hits the same concepts, because there was never a language to switch out of.
 *
 * Every non-English entry here needs a native speaker's review before Stage 2 is accepted.
 * That gate is not a metric; it is a person reading the list.
 */

import { fold } from './script';

export type Concept =
  | { kind: 'category'; value: string }
  | { kind: 'material'; value: string }
  | { kind: 'department'; value: string }
  | { kind: 'occasion'; value: string }
  | { kind: 'action'; value: Action }
  | { kind: 'ordinal'; value: number }
  | { kind: 'deictic'; value: 'this' | 'that' }
  | { kind: 'modifier'; value: 'lighter' | 'heavier' | 'cheaper' | 'similar' | 'matching' | 'all' }
  | { kind: 'marker'; value: 'punjabi' | 'roman-urdu' };

export type Action =
  | 'show'
  | 'open'
  | 'save'
  | 'remove'
  | 'selection'
  | 'price'
  | 'consultation'
  | 'restart'
  | 'greet'
  | 'thanks'
  | 'about';

type Entry = [string[], Concept];

/**
 * `marker` entries carry no meaning of their own. They exist so `languageOf` can tell Urdu
 * from Shahmukhi Punjabi and English from Roman Urdu, which no amount of looking at the
 * alphabet can do.
 */
const ENTRIES: Entry[] = [
  // ── kinds of jewellery ───────────────────────────────────────────────────
  [['necklace', 'necklaces', 'haar', 'haaar', 'har', 'ہار', 'گلوبند', 'ਹਾਰ'], { kind: 'category', value: 'necklace' }],
  [['choker', 'chokers', 'collar', 'گلے کا ہار', 'چوکر'], { kind: 'category', value: 'necklace' }],
  [['set', 'sets', 'suite', 'suites', 'bridal set', 'sett', 'سیٹ', 'ਸੈੱਟ'], { kind: 'category', value: 'bridal-set' }],
  [['earring', 'earrings', 'jhumka', 'jhumkay', 'jhumke', 'jhumki', 'jhumkas', 'bali', 'baliyan', 'balian', 'کان کے', 'جھمکا', 'جھمکے', 'بالیاں', 'ਝੁਮਕੇ', 'ਵਾਲੀਆਂ'], { kind: 'category', value: 'earrings' }],
  [['ring', 'rings', 'angoothi', 'anguthi', 'anghuti', 'chhalla', 'challa', 'انگوٹھی', 'چھلا', 'ਮੁੰਦਰੀ', 'ਛੱਲਾ'], { kind: 'category', value: 'ring' }],
  [['bangle', 'bangles', 'kangan', 'kara', 'karay', 'choori', 'choorian', 'chooriyan', 'churiyan', 'کنگن', 'چوڑی', 'چوڑیاں', 'ਕੰਗਣ', 'ਚੂੜੀਆਂ'], { kind: 'category', value: 'bangle' }],
  [['bracelet', 'bracelets', 'braclet', 'bresslet', 'بریسلٹ', 'ਬਰੇਸਲੇਟ'], { kind: 'category', value: 'bracelet' }],
  [['pendant', 'pendants', 'locket', 'lockets', 'لاکٹ', 'پینڈنٹ', 'ਲਾਕੇਟ'], { kind: 'category', value: 'pendant' }],
  [['chain', 'chains', 'zanjeer', 'zanjir', 'زنجیر', 'چین', 'ਚੇਨ'], { kind: 'category', value: 'chain' }],
  [['nose pin', 'nosepin', 'nose-pin', 'nath', 'laung', 'koka', 'ناک', 'نتھ', 'لونگ', 'ਨੱਥ', 'ਕੋਕਾ'], { kind: 'category', value: 'nose-pin' }],
  [['cufflink', 'cufflinks', 'cuff link', 'cuff links', 'کف لنکس'], { kind: 'category', value: 'cufflink' }],
  [['tikka', 'teeka', 'matha patti', 'jhoomar', 'ٹیکا', 'جھومر', 'ਟਿੱਕਾ'], { kind: 'category', value: 'tikka' }],

  // ── metals and stones ────────────────────────────────────────────────────
  [['gold', 'golden', 'sona', 'sone', 'sonay', 'soney', 'سونا', 'سونے', 'ਸੋਨਾ', 'ਸੋਨੇ'], { kind: 'material', value: 'gold' }],
  [['diamond', 'diamonds', 'heera', 'heeray', 'heere', 'heeron', 'ہیرا', 'ہیرے', 'ਹੀਰਾ', 'ਹੀਰੇ'], { kind: 'material', value: 'diamond' }],
  [['polki', 'uncut', 'پولکی'], { kind: 'material', value: 'polki' }],
  [['kundan', 'kundun', 'کندن', 'ਕੁੰਦਨ'], { kind: 'material', value: 'polki' }],
  [['emerald', 'emeralds', 'panna', 'zamurd', 'zumurrud', 'پنا', 'زمرد'], { kind: 'material', value: 'emerald' }],
  [['pearl', 'pearls', 'moti', 'motiyan', 'موتی', 'ਮੋਤੀ'], { kind: 'material', value: 'pearl' }],
  [['sapphire', 'neelam', 'نیلم'], { kind: 'material', value: 'sapphire' }],
  [['ruby', 'rubies', 'yaqoot', 'یاقوت'], { kind: 'material', value: 'ruby' }],

  // ── departments ──────────────────────────────────────────────────────────
  [['bridal', 'dulhan', 'dulhan ka', 'shadi', 'shaadi', 'wedding', 'دلہن', 'شادی', 'ਵਿਆਹ', 'ਲਾੜੀ'], { kind: 'department', value: 'bridal' }],
  [['men', 'mens', "men's", 'mardana', 'mard', 'gents', 'gents ka', 'مردانہ', 'مرد', 'ਮਰਦਾਨਾ'], { kind: 'department', value: 'men' }],
  [['kids', 'kid', 'children', 'child', 'baby', 'bachon', 'bachay', 'bache', 'bachon ka', 'بچوں', 'بچے', 'ਬੱਚਿਆਂ'], { kind: 'department', value: 'kids' }],

  // ── occasions ────────────────────────────────────────────────────────────
  [['mehndi', 'mayun', 'mehendi', 'مہندی', 'ਮਹਿੰਦੀ'], { kind: 'occasion', value: 'mehndi' }],
  [['baraat', 'barat', 'براٹ', 'بارات', 'ਬਰਾਤ'], { kind: 'occasion', value: 'baraat' }],
  [['walima', 'valima', 'ولیمہ', 'ਵਲੀਮਾ'], { kind: 'occasion', value: 'walima' }],
  [['engagement', 'mangni', 'mangani', 'منگنی', 'ਮੰਗਣੀ'], { kind: 'occasion', value: 'engagement' }],
  [['everyday', 'daily', 'rozana', 'casual', 'روزانہ', 'ਰੋਜ਼ਾਨਾ'], { kind: 'occasion', value: 'everyday' }],
  [['gift', 'tohfa', 'tohfah', 'تحفہ', 'ਤੋਹਫ਼ਾ'], { kind: 'occasion', value: 'gift' }],

  // ── actions ──────────────────────────────────────────────────────────────
  [['show', 'see', 'find', 'search', 'looking for', 'want', 'need', 'dikhao', 'dikhaiye', 'dikha', 'dikhana', 'dikhayen', 'dikhaen', 'chahiye', 'chaiye', 'chahiyeh', 'dekhna', 'dekhna hai', 'دکھاو', 'دکھائیں', 'دکھائے', 'چاہیے', 'دیکھنا', 'ਦਿਖਾਓ', 'ਦਿਖਾ', 'ਚਾਹੀਦਾ', 'ਵੇਖਣਾ'], { kind: 'action', value: 'show' }],
  [['open', 'kholo', 'khol', 'kholiye', 'kholen', 'کھولو', 'کھولیں', 'ਖੋਲ੍ਹੋ'], { kind: 'action', value: 'open' }],
  [['save', 'keep', 'rakho', 'rakh lo', 'rakhlo', 'rakh lein', 'save karo', 'save kar do', 'mehfooz', 'رکھو', 'رکھ لو', 'محفوظ', 'ਰੱਖੋ'], { kind: 'action', value: 'save' }],
  [['remove', 'delete', 'hatao', 'hata do', 'nikalo', 'nikal do', 'ہٹاو', 'ہٹا دو', 'نکالو', 'ਹਟਾਓ'], { kind: 'action', value: 'remove' }],
  [['selection', 'wishlist', 'my pieces', 'saved', 'meri', 'meri list', 'میری فہرست', 'محفوظ شدہ', 'ਮੇਰੀ ਸੂਚੀ'], { kind: 'action', value: 'selection' }],
  [['price', 'cost', 'rate', 'how much', 'kitna', 'kitne', 'kitni', 'qeemat', 'keemat', 'daam', 'قیمت', 'کتنا', 'کتنے', 'دام', 'ਕੀਮਤ', 'ਕਿੰਨਾ'], { kind: 'action', value: 'price' }],
  [['consultation', 'appointment', 'visit', 'meeting', 'mulaqat', 'milna', 'appointment lena', 'aana hai', 'ملاقات', 'وقت', 'ملنا', 'ਮੁਲਾਕਾਤ'], { kind: 'action', value: 'consultation' }],
  [['start again', 'begin again', 'reset', 'clear', 'shuru', 'phir se', 'dobara', 'دوبارہ', 'شروع', 'ਦੁਬਾਰਾ'], { kind: 'action', value: 'restart' }],
  [['hello', 'hi', 'hey', 'salam', 'assalam', 'assalamualaikum', 'salaam', 'aoa', 'السلام علیکم', 'سلام', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'], { kind: 'action', value: 'greet' }],
  [['thanks', 'thank you', 'shukriya', 'shukria', 'mehrbani', 'شکریہ', 'مہربانی', 'ਧੰਨਵਾਦ', 'ਸ਼ੁਕਰੀਆ'], { kind: 'action', value: 'thanks' }],
  [['about', 'who are you', 'history', 'heritage', 'story', 'tell me about', 'kaun', 'tareekh', 'کون', 'تاریخ', 'ਕੌਣ'], { kind: 'action', value: 'about' }],

  // ── ordinals and pointing ────────────────────────────────────────────────
  [['first', '1st', 'pehla', 'pehli', 'pehle', 'پہلا', 'پہلی', 'ਪਹਿਲਾ'], { kind: 'ordinal', value: 1 }],
  [['second', '2nd', 'doosra', 'dusra', 'doosri', 'dusri', 'دوسرا', 'دوسری', 'ਦੂਜਾ'], { kind: 'ordinal', value: 2 }],
  [['third', '3rd', 'teesra', 'teesri', 'تیسرا', 'تیسری', 'ਤੀਜਾ'], { kind: 'ordinal', value: 3 }],
  [['fourth', '4th', 'chautha', 'chauthi', 'چوتھا', 'چوتھی', 'ਚੌਥਾ'], { kind: 'ordinal', value: 4 }],
  [['fifth', '5th', 'panchwa', 'panchwan', 'پانچواں', 'ਪੰਜਵਾਂ'], { kind: 'ordinal', value: 5 }],
  [['last', 'aakhri', 'akhri', 'آخری', 'ਆਖਰੀ'], { kind: 'ordinal', value: -1 }],
  [['this', 'this one', 'yeh', 'ye', 'is', 'یہ', 'ਇਹ'], { kind: 'deictic', value: 'this' }],
  [['that', 'that one', 'woh', 'wo', 'us', 'وہ', 'ਉਹ'], { kind: 'deictic', value: 'that' }],

  // ── comparatives ─────────────────────────────────────────────────────────
  [['lighter', 'light', 'halka', 'halki', 'halke', 'ہلکا', 'ہلکی', 'ਹਲਕਾ'], { kind: 'modifier', value: 'lighter' }],
  [['heavier', 'heavy', 'bhari', 'bhara', 'wazandar', 'بھاری', 'وزنی', 'ਭਾਰੀ'], { kind: 'modifier', value: 'heavier' }],
  [['cheaper', 'affordable', 'sasta', 'sasti', 'kam qeemat', 'سستا', 'سستی', 'ਸਸਤਾ'], { kind: 'modifier', value: 'cheaper' }],
  [['similar', 'like this', 'aisa', 'aisi', 'is jaisa', 'is tarah', 'ایسا', 'ایسی', 'اس جیسا', 'ਇਸ ਵਰਗਾ'], { kind: 'modifier', value: 'similar' }],
  [['matching', 'goes with', 'match', 'sath', 'saath', 'ke sath', 'milta julta', 'ساتھ', 'کے ساتھ', 'ਨਾਲ'], { kind: 'modifier', value: 'matching' }],
  [['all', 'everything', 'sab', 'sara', 'sab kuch', 'سب', 'سارا', 'ਸਭ'], { kind: 'modifier', value: 'all' }],

  // ── language markers, meaning nothing on their own ───────────────────────
  [['ਤੁਸੀਂ', 'ਮੈਨੂੰ', 'ਕਿਹੜਾ', 'ਹੈਗਾ', 'ਵਿਖਾਓ'], { kind: 'marker', value: 'punjabi' }],
  [['tuhada', 'tusi', 'menu', 'kithe', 'kinne', 'hega', 'oh', 'اوہ', 'تہاڈا', 'تسیں', 'مینوں', 'کتھے'], { kind: 'marker', value: 'punjabi' }],
  [['mujhe', 'mujhay', 'aap', 'apka', 'apki', 'hai', 'hain', 'kya', 'koi', 'kuch', 'wala', 'wali', 'ka', 'ke', 'ki'], { kind: 'marker', value: 'roman-urdu' }],
];

/**
 * Folded on the way in, exactly as the visitor's text is.
 *
 * This is not an optimisation. Urdu ye has several Unicode spellings and Gurmukhi vowel signs
 * are marked inconsistently, so `fold` normalises both — and if only one side of the
 * comparison is folded, no non-Latin entry can ever match. Longest form first, so "nose pin"
 * is read before "pin".
 */
export const LEXICON: [string, Concept][] = ENTRIES.flatMap(([forms, concept]) => forms.map((f) => [fold(f), concept] as [string, Concept]))
  .filter(([form]) => form.length > 0)
  .sort((a, b) => b[0].length - a[0].length);

export const LEXICON_SIZE = LEXICON.length;

/**
 * Every concept the folded text contains, longest form first, with each matched span
 * consumed so one word cannot count twice.
 */
export function conceptsIn(folded: string): { concept: Concept; form: string }[] {
  let rest = ` ${folded} `;
  const found: { concept: Concept; form: string }[] = [];
  for (const [form, concept] of LEXICON) {
    const needle = ` ${form} `;
    const at = rest.indexOf(needle);
    if (at < 0) continue;
    found.push({ concept, form });
    // consume the span, leaving the spaces so neighbours still match
    rest = `${rest.slice(0, at + 1)}${rest.slice(at + needle.length - 1)}`;
  }
  return found;
}
