import { CONCIERGE } from './copy';
import { SITE } from '@/data/site';
import { showroomsInOrder } from '@/data/heritage';
import { WORLDS } from '@/data/worlds';
import { countInWords, capitalise } from '@/lib/format';
import type { Language } from './nlu/script';
import type { IntentFrame } from './nlu/parse';

/**
 * Every deterministic reply, in the visitor's language.
 *
 * The keyless engine answers from fixed sentences, and until this file every one of them was
 * English — so a visitor who wrote "mujhe gold rings dikhao" was shown the right rings and
 * told about them in the wrong language, and one who said something the engine did not
 * know was read a paragraph of English capabilities. Language mirroring is a hard rule of
 * the concierge: English is answered in English, Urdu in Urdu, Roman Urdu in Roman Urdu,
 * Punjabi in Punjabi, and never the other way. This is the one place the rule is kept for
 * the replies no model writes.
 *
 * Six columns: English, Roman Urdu, Roman Punjabi, and the three scripts the parser already
 * detects — Urdu, Shahmukhi Punjabi, Gurmukhi Punjabi. The English column reads `copy.ts`
 * wherever the sentence is unchanged, so there is still one English source of truth.
 *
 * The register is the same in every column: one sentence, no exclamation marks, the
 * concierge is a woman ("la rahi hoon", "kholti hoon"), "Waseem" or "Waseem Jewellers" and
 * never a phrase that makes the shop a House. A recognition failure asks one short question
 * and never lists what the concierge can do. Every non-English line here needs a native
 * speaker's reading before Stage 2 is accepted; that gate is a person, not a metric.
 */

export type ReplyLanguage = 'en' | 'ur-Latn' | 'pa-Latn' | 'ur' | 'pa-Arab' | 'pa-Guru';

const COUNT: Record<ReplyLanguage, string[]> = {
  en: [],
  'ur-Latn': ['', 'ek', 'do', 'teen', 'chaar', 'paanch', 'chhe'],
  'pa-Latn': ['', 'ik', 'do', 'tin', 'chaar', 'panj', 'chhe'],
  ur: ['', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ'],
  'pa-Arab': ['', 'اک', 'دو', 'تن', 'چار', 'پنج', 'چھ'],
  'pa-Guru': ['', 'ਇੱਕ', 'ਦੋ', 'ਤਿੰਨ', 'ਚਾਰ', 'ਪੰਜ', 'ਛੇ'],
};

/** "Four" / "chaar" / "چار" — a small number in the visitor's language. */
export function countWord(language: ReplyLanguage, n: number, capital = false): string {
  if (language === 'en') return capital ? capitalise(countInWords(n)) : countInWords(n);
  return COUNT[language][n] ?? String(n);
}

/** The kinds, in the scripts that have their own word for them. Roman replies keep the English noun, as Lahore does. */
const KIND: Record<'ur' | 'pa-Arab' | 'pa-Guru', Record<string, { one: string; many: string; f?: boolean }>> = {
  ur: {
    ring: { one: 'انگوٹھی', many: 'انگوٹھیاں', f: true },
    necklace: { one: 'ہار', many: 'ہار' },
    earrings: { one: 'جھمکا', many: 'جھمکے' },
    bangle: { one: 'کنگن', many: 'کنگن' },
    bracelet: { one: 'بریسلٹ', many: 'بریسلٹ' },
    pendant: { one: 'لاکٹ', many: 'لاکٹ' },
    chain: { one: 'چین', many: 'چینیں', f: true },
    'nose-pin': { one: 'نتھ', many: 'نتھیں', f: true },
    'bridal-set': { one: 'سیٹ', many: 'سیٹ' },
    tikka: { one: 'ٹیکا', many: 'ٹیکے' },
    cufflink: { one: 'کف لنک', many: 'کف لنکس' },
    pieces: { one: 'پیس', many: 'پیس' },
  },
  'pa-Arab': {
    ring: { one: 'مندری', many: 'مندریاں', f: true },
    necklace: { one: 'ہار', many: 'ہار' },
    earrings: { one: 'جھمکا', many: 'جھمکے' },
    bangle: { one: 'کنگن', many: 'کنگن' },
    bracelet: { one: 'بریسلٹ', many: 'بریسلٹ' },
    pendant: { one: 'لاکٹ', many: 'لاکٹ' },
    chain: { one: 'چین', many: 'چیناں', f: true },
    'nose-pin': { one: 'نتھ', many: 'نتھاں', f: true },
    'bridal-set': { one: 'سیٹ', many: 'سیٹ' },
    tikka: { one: 'ٹکا', many: 'ٹکے' },
    cufflink: { one: 'کف لنک', many: 'کف لنکس' },
    pieces: { one: 'پیس', many: 'پیس' },
  },
  'pa-Guru': {
    ring: { one: 'ਮੁੰਦਰੀ', many: 'ਮੁੰਦਰੀਆਂ', f: true },
    necklace: { one: 'ਹਾਰ', many: 'ਹਾਰ' },
    earrings: { one: 'ਝੁਮਕਾ', many: 'ਝੁਮਕੇ' },
    bangle: { one: 'ਕੰਗਣ', many: 'ਕੰਗਣ' },
    bracelet: { one: 'ਬਰੇਸਲੇਟ', many: 'ਬਰੇਸਲੇਟ' },
    pendant: { one: 'ਲਾਕੇਟ', many: 'ਲਾਕੇਟ' },
    chain: { one: 'ਚੇਨ', many: 'ਚੇਨਾਂ', f: true },
    'nose-pin': { one: 'ਨੱਥ', many: 'ਨੱਥਾਂ', f: true },
    'bridal-set': { one: 'ਸੈੱਟ', many: 'ਸੈੱਟ' },
    tikka: { one: 'ਟਿੱਕਾ', many: 'ਟਿੱਕੇ' },
    cufflink: { one: 'ਕਫ਼ ਲਿੰਕ', many: 'ਕਫ਼ ਲਿੰਕ' },
    pieces: { one: 'ਪੀਸ', many: 'ਪੀਸ' },
  },
};

/** "سونے کے" / "سونے کی" — the metal as a possessive that agrees with the noun. */
const METAL: Record<'ur' | 'pa-Arab' | 'pa-Guru', Record<string, { m: string; f: string }>> = {
  ur: { gold: { m: 'سونے کے', f: 'سونے کی' }, diamond: { m: 'ہیرے کے', f: 'ہیرے کی' }, polki: { m: 'پولکی', f: 'پولکی' }, kundan: { m: 'کندن', f: 'کندن' }, emerald: { m: 'زمرد کے', f: 'زمرد کی' }, pearl: { m: 'موتی کے', f: 'موتی کی' }, sapphire: { m: 'نیلم کے', f: 'نیلم کی' }, ruby: { m: 'یاقوت کے', f: 'یاقوت کی' } },
  'pa-Arab': { gold: { m: 'سونے دے', f: 'سونے دیاں' }, diamond: { m: 'ہیرے دے', f: 'ہیرے دیاں' }, polki: { m: 'پولکی', f: 'پولکی' }, kundan: { m: 'کندن', f: 'کندن' }, emerald: { m: 'زمرد دے', f: 'زمرد دیاں' }, pearl: { m: 'موتی دے', f: 'موتی دیاں' }, sapphire: { m: 'نیلم دے', f: 'نیلم دیاں' }, ruby: { m: 'یاقوت دے', f: 'یاقوت دیاں' } },
  'pa-Guru': { gold: { m: 'ਸੋਨੇ ਦੇ', f: 'ਸੋਨੇ ਦੀਆਂ' }, diamond: { m: 'ਹੀਰੇ ਦੇ', f: 'ਹੀਰੇ ਦੀਆਂ' }, polki: { m: 'ਪੋਲਕੀ', f: 'ਪੋਲਕੀ' }, kundan: { m: 'ਕੁੰਦਨ', f: 'ਕੁੰਦਨ' }, emerald: { m: 'ਪੰਨੇ ਦੇ', f: 'ਪੰਨੇ ਦੀਆਂ' }, pearl: { m: 'ਮੋਤੀ ਦੇ', f: 'ਮੋਤੀ ਦੀਆਂ' }, sapphire: { m: 'ਨੀਲਮ ਦੇ', f: 'ਨੀਲਮ ਦੀਆਂ' }, ruby: { m: 'ਯਾਕੂਤ ਦੇ', f: 'ਯਾਕੂਤ ਦੀਆਂ' } },
};

const DEPT: Record<'ur' | 'pa-Arab' | 'pa-Guru', Record<string, string>> = {
  ur: { bridal: 'برائیڈل', men: 'مردانہ', kids: 'بچوں کے', gold: 'گولڈ', diamond: 'ڈائمنڈ' },
  'pa-Arab': { bridal: 'برائیڈل', men: 'مردانہ', kids: 'بچیاں دے', gold: 'گولڈ', diamond: 'ڈائمنڈ' },
  'pa-Guru': { bridal: 'ਬ੍ਰਾਈਡਲ', men: 'ਮਰਦਾਨਾ', kids: 'ਬੱਚਿਆਂ ਦੇ', gold: 'ਗੋਲਡ', diamond: 'ਡਾਇਮੰਡ' },
};

const PLURAL_EN: Record<string, [string, string]> = {
  'bridal-set': ['bridal set', 'bridal sets'],
  necklace: ['necklace', 'necklaces'],
  earrings: ['pair of earrings', 'earrings'],
  ring: ['ring', 'rings'],
  bracelet: ['bracelet', 'bracelets'],
  bangle: ['bangle', 'bangles'],
  pendant: ['pendant', 'pendants'],
  chain: ['chain', 'chains'],
  'nose-pin': ['nose pin', 'nose pins'],
  cufflink: ['cufflink', 'cufflinks'],
  tikka: ['tikka', 'tikkas'],
  nath: ['nath', 'naths'],
};

export interface SubjectSlots {
  category?: string;
  material?: string;
  department?: string;
  karat?: number;
  maxWeightGrams?: number;
  minWeightGrams?: number;
}

/**
 * What was asked for, said back in the visitor's own terms — "gold rings", "chaar gold
 * rings", "سونے کی انگوٹھیاں". Roman replies keep the English nouns because that is how
 * Lahore says them; the script columns have their own words and agree the metal with them.
 */
export function subjectIn(language: ReplyLanguage, s: SubjectSlots, n: number): string {
  const many = n !== 1;
  if (language === 'ur' || language === 'pa-Arab' || language === 'pa-Guru') {
    const kind = KIND[language][s.category ?? 'pieces'] ?? KIND[language].pieces!;
    const metal = s.material ? METAL[language][s.material] : undefined;
    const dept = s.department && s.department !== 'bridal' ? DEPT[language][s.department] : s.department === 'bridal' ? DEPT[language].bridal : undefined;
    const parts = [s.karat ? `${s.karat}K` : undefined, metal ? (kind.f ? metal.f : metal.m) : undefined, dept, many ? kind.many : kind.one].filter(Boolean);
    return parts.join(' ');
  }
  const kind = s.category ? (PLURAL_EN[s.category] ?? [s.category, s.category])[many ? 1 : 0] : many ? 'pieces' : 'piece';
  // 'bridal sets' already says bridal: the department is not repeated before the kind
  const dept = s.department && !(s.department === 'bridal' && s.category === 'bridal-set') ? (s.department === 'bridal' ? 'bridal' : language === 'en' ? `${s.department}'s` : s.department) : undefined;
  const line = [s.karat ? `${s.karat}K` : undefined, s.material, dept, kind].filter(Boolean).join(' ');
  if (language !== 'en') return line;
  const bound = s.maxWeightGrams !== undefined ? ` under ${Math.round(s.maxWeightGrams)} grams` : s.minWeightGrams !== undefined ? ` over ${Math.round(s.minWeightGrams)} grams` : '';
  return `${line}${bound}`;
}

/** "A and B" / "A aur B" / "A تے B". */
export function joinNames(language: ReplyLanguage, names: string[]): string {
  const and = { en: 'and', 'ur-Latn': 'aur', 'pa-Latn': 'te', ur: 'اور', 'pa-Arab': 'تے', 'pa-Guru': 'ਤੇ' }[language];
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(language === 'ur' || language === 'pa-Arab' ? '، ' : ', ')} ${and} ${names[names.length - 1]}`;
}

const SHOWROOM_NAME: Record<ReplyLanguage, Record<string, string>> = {
  en: {},
  'ur-Latn': {},
  'pa-Latn': {},
  ur: { liberty: 'لبرٹی مارکیٹ', 'mm-alam': 'ایم ایم عالم روڈ', dha: 'ڈی ایچ اے' },
  'pa-Arab': { liberty: 'لبرٹی مارکیٹ', 'mm-alam': 'ایم ایم عالم روڈ', dha: 'ڈی ایچ اے' },
  'pa-Guru': { liberty: 'ਲਿਬਰਟੀ ਮਾਰਕੀਟ', 'mm-alam': 'ਐਮ ਐਮ ਆਲਮ ਰੋਡ', dha: 'ਡੀ ਐਚ ਏ' },
};

/** The three showrooms, in the order the client set — Liberty Market, MM Alam Road, DHA — never mutated. */
export const showroomNames = (language: ReplyLanguage) => showroomsInOrder().map((s) => SHOWROOM_NAME[language][s.id] ?? s.name);
export const showroomNameIn = (language: ReplyLanguage, id: string | undefined) => {
  const s = SITE.showrooms.find((x) => x.id === id);
  return s ? (SHOWROOM_NAME[language][s.id] ?? s.name) : '';
};

const worldNames = () => WORLDS.map((w) => w.name);

type Field = 'name' | 'phone' | 'showroom' | 'occasion';

/**
 * One reply table. Each entry is one sentence, or a function of the facts it needs.
 *
 * `ack` is the whole spoken reply to an action command — "Ji." — said as the action starts;
 * two forms per language so consecutive turns do not open with the same word.
 */
export interface Replies {
  ack: [string, string];
  clarify: string;
  clarifyAgain: string;
  writeInstead: string;
  clarifyBetween: (a: string, b: string) => string;
  reading: Record<string, string>;
  actions: { write: string; tryAgain: string; nearby: string; bridal: string; once: string };
  searchResult: (n: number, what: string) => string;
  searchWidened: (n: number, what: string) => string;
  nothing: string;
  nearby: (n: number, what: string) => string;
  nearbyNothing: string;
  opened: (name: string) => string;
  whichPiece: (anyShown: boolean) => string;
  whichPieceSimilar: string;
  departmentOpen: (department: string) => string;
  collectionOpen: (name: string) => string;
  back: string;
  noEarlierPage: string;
  formOpen: string;
  noted: (what: string) => string;
  ask: Record<Field, string>;
  allNoted: string;
  priceOnRequest: string;
  priceKnown: (label: string) => string;
  showrooms: string;
  compared: (names: string[]) => string;
  whichToCompare: string;
  lighter: (n: number, heavier: boolean) => string;
  lighterByForm: (n: number, heavier: boolean) => string;
  weightUnknown: string;
  similar: (n: number) => string;
  matching: (n: number) => string;
  matchingNone: string;
  savingNotOffered: string;
  selectionNotOffered: string;
  thanks: string;
  greeting: (hour: number) => string;
  close: string;
  help: string;
  outOfScope: string;
  watches: string;
  house: string;
  collections: string;
  traditional: string;
  tellAbout: (name: string, specs: string) => string;
  restart: string;
  budgetNoted: string;
  error: string;
  micFailed: string;
  micDenied: string;
  noSpeech: string;
  /** The line dropped mid-conversation and could not be re-established: said once, with the next thing to do. */
  lineDropped: string;
  /** The session could not be opened: said once, in writing, and the written concierge is presented. */
  voiceUnavailable: string;
}

const ROMAN_ORDER = (language: ReplyLanguage) => showroomNames(language);

const en: Replies = {
  ack: ['Of course.', 'Certainly.'],
  clarify: 'Sorry — once more?',
  clarifyAgain: 'In other words, perhaps?',
  writeInstead: 'Perhaps write it instead.',
  clarifyBetween: (a, b) => `Sorry — ${a}, or ${b}?`,
  reading: { search: 'to see some pieces', open: 'to open one', similar: 'something similar', matching: 'something to wear with it', price: 'the price', consultation: 'to book an appointment', restart: 'to begin again' },
  actions: { write: CONCIERGE.next.write, tryAgain: CONCIERGE.next.tryAgain, nearby: CONCIERGE.next.nearby, bridal: CONCIERGE.next.bridal, once: CONCIERGE.next.once },
  searchResult: (n, what) => `${countWord('en', n, true)} ${what} ${n === 1 ? 'is' : 'are'} in view.`,
  searchWidened: (n, what) => `${countWord('en', n, true)} ${what}, with the other conditions set aside.`,
  nothing: 'Nothing quite like that today — nearby pieces instead?',
  nearby: (n, what) => `Nearby — ${countWord('en', n)} ${what}, with the other conditions set aside.`,
  nearbyNothing: 'Nothing nearby either — tell me the kind of piece.',
  opened: (name) => CONCIERGE.opened(name),
  whichPiece: (anyShown) => (anyShown ? 'Which piece — the first, or the second?' : 'Which piece — shall I bring the bridal pieces first?'),
  whichPieceSimilar: 'Show me the piece you have in mind first.',
  departmentOpen: (d) => `${capitalise(d)} is open.`,
  collectionOpen: (name) => `${name} is open.`,
  back: 'Back.',
  noEarlierPage: 'No earlier page — home instead?',
  formOpen: 'The form is open — your name, please?',
  noted: (what) => `${what} noted`,
  ask: { name: 'your name, please?', phone: 'a telephone number?', showroom: 'which showroom — Liberty Market, MM Alam Road or DHA?', occasion: 'the occasion?' },
  allNoted: 'All noted — the form is ready for you to send.',
  priceOnRequest: 'This piece is priced on request — I can arrange a viewing.',
  priceKnown: (label) => `This piece is ${label} — shall I arrange a viewing?`,
  showrooms: CONCIERGE.showrooms,
  compared: (names) => `${joinNames('en', names)}, side by side — only what Waseem publishes.`,
  whichToCompare: 'Which two — the first and the second, say?',
  lighter: (n, heavier) => `${countWord('en', n, true)} ${heavier ? 'heavier' : 'lighter'} pieces, by the weight Waseem publishes.`,
  lighterByForm: (n, heavier) => `${countWord('en', n, true)} pieces ${heavier ? 'heavier' : 'lighter'} in form — Waseem publishes no weight for the piece in view.`,
  weightUnknown: 'Waseem has not published a weight for this piece — a viewing settles it.',
  similar: (n) => `${countWord('en', n, true)} pieces in the same spirit.`,
  matching: (n) => `${countWord('en', n, true)} pieces that would be worn with it.`,
  matchingNone: 'Nothing in the collection is a natural companion to this one — shall I show similar pieces?',
  savingNotOffered: 'Saving is not offered here — shall I set two side by side instead?',
  selectionNotOffered: 'There is no saved selection here — tell me what you are looking for.',
  thanks: CONCIERGE.thanks,
  greeting: (hour) => CONCIERGE.greeting(hour),
  close: CONCIERGE.close,
  help: CONCIERGE.help,
  outOfScope: 'That is outside what we make — a piece, or an appointment?',
  watches: 'We work in gold and diamond jewellery — shall I show you pieces?',
  house: CONCIERGE.house,
  collections: CONCIERGE.collections,
  traditional: 'For a traditional hand I would begin with polki and kundan.',
  tellAbout: (name, specs) => (specs ? `The ${name}: ${specs}` : `The ${name} — weight, purity and stones are confirmed by our jewellers at a viewing.`),
  restart: 'Begun again — what would you like to see?',
  budgetNoted: 'the figure is noted for your enquiry, most pieces being priced on request',
  error: CONCIERGE.error,
  micFailed: CONCIERGE.micNoAnswer,
  micDenied: CONCIERGE.micDenied,
  noSpeech: CONCIERGE.noSpeech,
  lineDropped: CONCIERGE.voice.lineDropped,
  voiceUnavailable: CONCIERGE.voice.sessionUnavailable,
};

const urLatn: Replies = {
  ack: ['Ji.', 'Bilkul.'],
  clarify: 'Maaf kijiye, dobara kahenge?',
  clarifyAgain: 'Doosre lafzon mein kahenge?',
  writeInstead: 'Shayad likh kar bhej dijiye.',
  clarifyBetween: (a, b) => `Maaf kijiye — ${a}, ya ${b}?`,
  reading: { search: 'kuch pieces dekhna', open: 'ek kholna', similar: 'aisa hi kuch', matching: 'is ke saath ka', price: 'qeemat', consultation: 'appointment', restart: 'dobara shuru' },
  actions: { write: 'Likh kar bhejein', tryAgain: 'Dobara kahein', nearby: 'Qareeb ke pieces', bridal: 'Bridal pieces', once: 'Ek baar aur' },
  searchResult: (n, what) => `Ji, ${countWord('ur-Latn', n)} ${what} saamne ${n === 1 ? 'hai' : 'hain'}.`,
  searchWidened: (n, what) => `Ji, ${countWord('ur-Latn', n)} ${what} saamne ${n === 1 ? 'hai' : 'hain'} — baqi sharayet hata kar.`,
  nothing: 'Aisa kuch aaj nahi hai — qareeb ke pieces dikhaoon?',
  nearby: (n, what) => `Qareeb ke — ${countWord('ur-Latn', n)} ${what}, baqi sharayet hata kar.`,
  nearbyNothing: 'Qareeb bhi kuch nahi — piece ki qisam bataiye.',
  opened: (name) => `Ji, ${name} saamne hai.`,
  whichPiece: (anyShown) => (anyShown ? 'Kaunsa piece — pehla, ya doosra?' : 'Kaunsa piece — pehle bridal pieces la doon?'),
  whichPieceSimilar: 'Pehle woh piece dikhaiye jo aap ke zehn mein hai.',
  departmentOpen: (d) => `${capitalise(d)} khul gaya.`,
  collectionOpen: (name) => `${name} khul gaya.`,
  back: 'Wapas.',
  noEarlierPage: 'Pichhla page nahi hai — home chalein?',
  formOpen: 'Form khul gaya — aap ka naam?',
  noted: (what) => `${what} likh liya`,
  ask: { name: 'aap ka naam?', phone: 'telephone number?', showroom: 'kaunsa showroom — Liberty Market, MM Alam Road ya DHA?', occasion: 'kis mauqe ke liye?' },
  allNoted: 'Sab likh liya — form aap bhej sakte hain.',
  priceOnRequest: 'Is piece ki price on request hai — showroom mein bata deti hoon.',
  priceKnown: (label) => `Is ki qeemat ${label} hai — viewing rakh doon?`,
  showrooms: `Lahore mein teen showrooms hain — ${joinNames('ur-Latn', ROMAN_ORDER('ur-Latn'))} — dopahar barah se raat saarhe nau tak.`,
  compared: (names) => `${joinNames('ur-Latn', names)} saath saath hain — sirf jo Waseem publish karta hai.`,
  whichToCompare: 'Kaunse do — pehla aur doosra?',
  lighter: (n, heavier) => `Ji, ${countWord('ur-Latn', n)} ${heavier ? 'bhari' : 'halke'} pieces — Waseem ke publish kiye wazan ke mutabiq.`,
  lighterByForm: (n, heavier) => `Ji, ${countWord('ur-Latn', n)} pieces banawat mein ${heavier ? 'bhari' : 'halke'} — is piece ka wazan Waseem ne publish nahi kiya.`,
  weightUnknown: 'Is piece ka wazan Waseem ne publish nahi kiya — viewing par tol lenge.',
  similar: (n) => `Ji, ${countWord('ur-Latn', n)} pieces isi andaaz ke.`,
  matching: (n) => `Ji, ${countWord('ur-Latn', n)} pieces jo is ke saath pehne jaate hain.`,
  matchingNone: 'Is ke saath ka koi piece collection mein nahi — milte julte pieces dikhaoon?',
  savingNotOffered: 'Yahan save karna nahi hota — do pieces saath saath rakh doon?',
  selectionNotOffered: 'Yahan koi saved selection nahi — bataiye kya dekhna hai.',
  thanks: 'Khushi hui.',
  greeting: () => 'Assalam o alaikum. Main Waseem Concierge hoon — kisi piece, collection ya appointment ke baare mein poochiye.',
  close: 'Phir milenge.',
  help: 'Main pieces la sakti hoon, collection khol sakti hoon, do pieces saath rakh sakti hoon, ya viewing rakh sakti hoon.',
  outOfScope: 'Yeh hamare kaam se bahar hai — koi piece, ya appointment?',
  watches: 'Hum sone aur heere ke zewar banate hain — pieces dikhaoon?',
  house: `Waseem Jewellers 1952 mein Lahore mein ${SITE.founder} ne shuru kiya — aaj shehr mein teen showrooms hain.`,
  collections: `Paanch collections — ${joinNames('ur-Latn', worldNames())} — naam lijiye, main le chalti hoon.`,
  traditional: 'Riwayati andaaz ke liye main polki aur kundan se shuru karti hoon.',
  tellAbout: (name, specs) => (specs ? `${name}: ${specs}` : `${name} — wazan, purity aur stones hamare jewellers viewing par batate hain.`),
  restart: 'Dobara shuru — kya dekhna chahenge?',
  budgetNoted: 'budget note kar liya, zyada tar pieces price on request hain',
  error: 'Maaf kijiye — dobara koshish karein?',
  micFailed: 'Microphone nahi khula.',
  micDenied: 'Is site ke liye microphone band hai.',
  noSpeech: 'Sun nahi saki — dobara, thora qareeb se.',
  lineDropped: 'Line kat gayi — dobara kahenge?',
  voiceUnavailable: 'Awaaz abhi mumkin nahi — aap likh kar jaari rakh sakte hain.',
};

const paLatn: Replies = {
  ack: ['Ji.', 'Bilkul.'],
  clarify: 'Maaf karna, ik vari hor?',
  clarifyAgain: 'Hor lafzaan vich dasso?',
  writeInstead: 'Shayad likh ke bhej deo.',
  clarifyBetween: (a, b) => `Maaf karna — ${a}, ya ${b}?`,
  reading: { search: 'kujh pieces vekhna', open: 'ik kholna', similar: 'ehe jeha kujh', matching: 'ehde naal da', price: 'keemat', consultation: 'appointment', restart: 'fer shuru' },
  actions: { write: 'Likh ke bhejo', tryAgain: 'Fer kaho', nearby: 'Naal de pieces', bridal: 'Bridal pieces', once: 'Ik vari hor' },
  searchResult: (n, what) => `Ji, ${countWord('pa-Latn', n)} ${what} saahmne ${n === 1 ? 'ae' : 'ne'}.`,
  searchWidened: (n, what) => `Ji, ${countWord('pa-Latn', n)} ${what} saahmne ${n === 1 ? 'ae' : 'ne'} — baqi shartaan hata ke.`,
  nothing: 'Ehe jeha ajj koi nahi — naal de pieces vikhawan?',
  nearby: (n, what) => `Naal de — ${countWord('pa-Latn', n)} ${what}, baqi shartaan hata ke.`,
  nearbyNothing: 'Nere vi kujh nahi — piece di qisam dasso.',
  opened: (name) => `Ji, ${name} saahmne ae.`,
  whichPiece: (anyShown) => (anyShown ? 'Kehda piece — pehla, ya dooja?' : 'Kehda piece — pehlan bridal pieces lyawan?'),
  whichPieceSimilar: 'Pehlan oh piece dasso jehda tuhade zehn vich ae.',
  departmentOpen: (d) => `${capitalise(d)} khul gaya.`,
  collectionOpen: (name) => `${name} khul gaya.`,
  back: 'Wapas.',
  noEarlierPage: 'Pichla page nahi — home chaliye?',
  formOpen: 'Form khul gaya — tuhada naam?',
  noted: (what) => `${what} likh lya`,
  ask: { name: 'tuhada naam?', phone: 'phone number?', showroom: 'kehda showroom — Liberty Market, MM Alam Road ya DHA?', occasion: 'kehde mauqe layi?' },
  allNoted: 'Sab likh lya — form tusi bhej sakde o.',
  priceOnRequest: 'Es piece di price on request ae — showroom vich das dindi haan.',
  priceKnown: (label) => `Es di keemat ${label} ae — viewing rakh devan?`,
  showrooms: `Lahore vich tin showroom ne — ${joinNames('pa-Latn', ROMAN_ORDER('pa-Latn'))} — dupehr baaran ton raat saadhe nau tak.`,
  compared: (names) => `${joinNames('pa-Latn', names)} naal naal ne — sirf jo Waseem publish karda ae.`,
  whichToCompare: 'Kehde do — pehla te dooja?',
  lighter: (n, heavier) => `Ji, ${countWord('pa-Latn', n)} ${heavier ? 'bhaari' : 'halke'} pieces — Waseem de publish kite wazan mutabiq.`,
  lighterByForm: (n, heavier) => `Ji, ${countWord('pa-Latn', n)} pieces banawat vich ${heavier ? 'bhaari' : 'halke'} — es piece da wazan Waseem ne publish nahi kita.`,
  weightUnknown: 'Es piece da wazan Waseem ne publish nahi kita — viewing te tol lawange.',
  similar: (n) => `Ji, ${countWord('pa-Latn', n)} pieces ese andaaz de.`,
  matching: (n) => `Ji, ${countWord('pa-Latn', n)} pieces jo ehde naal paaye jaande ne.`,
  matchingNone: 'Ehde naal da koi piece collection vich nahi — milde julde pieces vikhawan?',
  savingNotOffered: 'Ethe save karna nahi hunda — do pieces naal naal rakh devan?',
  selectionNotOffered: 'Ethe koi saved selection nahi — dasso ki vekhna ae.',
  thanks: 'Khushi hoi.',
  greeting: () => 'Assalam o alaikum. Main Waseem Concierge aan — kise piece, collection ya appointment baare puchho.',
  close: 'Fer milange.',
  help: 'Main pieces lya sakdi aan, collection khol sakdi aan, do pieces naal rakh sakdi aan, ya viewing rakh sakdi aan.',
  outOfScope: 'Eh saade kamm ton bahar ae — koi piece, ya appointment?',
  watches: 'Asi sone te heere de gehne banaunde aan — pieces vikhawan?',
  house: `Waseem Jewellers 1952 vich Lahore vich ${SITE.founder} ne shuru kita — ajj shehr vich tin showroom ne.`,
  collections: `Panj collections — ${joinNames('pa-Latn', worldNames())} — naam lo, main le chaldi aan.`,
  traditional: 'Riwayati andaaz layi main polki te kundan ton shuru kardi aan.',
  tellAbout: (name, specs) => (specs ? `${name}: ${specs}` : `${name} — wazan, purity te stones saade jewellers viewing te dasde ne.`),
  restart: 'Fer shuru — ki vekhna chahoge?',
  budgetNoted: 'budget note kar lya, zyada tar pieces price on request ne',
  error: 'Maaf karna — fer koshish kariye?',
  micFailed: 'Microphone nahi khulya.',
  micDenied: 'Es site layi microphone band ae.',
  noSpeech: 'Sun nahi saki — fer, thoda nere ho ke.',
  lineDropped: 'Line kat gayi — fer kaho?',
  voiceUnavailable: 'Awaaz hale mumkin nahi — tusi likh ke jaari rakh sakde o.',
};

const ur: Replies = {
  ack: ['جی۔', 'بالکل۔'],
  clarify: 'معاف کیجیے، دوبارہ کہیں گے؟',
  clarifyAgain: 'دوسرے لفظوں میں کہیں گے؟',
  writeInstead: 'شاید لکھ کر بھیج دیجیے۔',
  clarifyBetween: (a, b) => `معاف کیجیے — ${a}، یا ${b}؟`,
  reading: { search: 'کچھ پیس دیکھنا', open: 'ایک کھولنا', similar: 'ایسا ہی کچھ', matching: 'اس کے ساتھ کا', price: 'قیمت', consultation: 'ملاقات', restart: 'دوبارہ شروع' },
  actions: { write: 'لکھ کر بھیجیں', tryAgain: 'دوبارہ کہیں', nearby: 'قریب کے پیس', bridal: 'برائیڈل پیس', once: 'ایک بار اور' },
  searchResult: (n, what) => `جی، ${countWord('ur', n)} ${what} سامنے ${n === 1 ? 'ہے' : 'ہیں'}۔`,
  searchWidened: (n, what) => `جی، ${countWord('ur', n)} ${what} سامنے ${n === 1 ? 'ہے' : 'ہیں'} — باقی شرائط ہٹا کر۔`,
  nothing: 'ایسا کچھ آج نہیں ہے — قریب کے پیس دکھاؤں؟',
  nearby: (n, what) => `قریب کے — ${countWord('ur', n)} ${what}، باقی شرائط ہٹا کر۔`,
  nearbyNothing: 'قریب بھی کچھ نہیں — پیس کی قسم بتائیے۔',
  opened: (name) => `جی، ${name} سامنے ہے۔`,
  whichPiece: (anyShown) => (anyShown ? 'کون سا پیس — پہلا، یا دوسرا؟' : 'کون سا پیس — پہلے برائیڈل پیس لا دوں؟'),
  whichPieceSimilar: 'پہلے وہ پیس دکھائیے جو آپ کے ذہن میں ہے۔',
  departmentOpen: (d) => `${DEPT.ur[d] ?? capitalise(d)} کھل گیا۔`,
  collectionOpen: (name) => `${name} کھل گیا۔`,
  back: 'واپس۔',
  noEarlierPage: 'پچھلا صفحہ نہیں ہے — ہوم چلیں؟',
  formOpen: 'فارم کھل گیا — آپ کا نام؟',
  noted: (what) => `${what} لکھ لیا`,
  ask: { name: 'آپ کا نام؟', phone: 'ٹیلی فون نمبر؟', showroom: 'کون سا شو روم — لبرٹی مارکیٹ، ایم ایم عالم روڈ یا ڈی ایچ اے؟', occasion: 'کس موقع کے لیے؟' },
  allNoted: 'سب لکھ لیا — فارم آپ بھیج سکتے ہیں۔',
  priceOnRequest: 'اس پیس کی قیمت درخواست پر بتائی جاتی ہے — شو روم میں بتا دیتی ہوں۔',
  priceKnown: (label) => `اس کی قیمت ${label} ہے — ملاقات رکھ دوں؟`,
  showrooms: `لاہور میں تین شو روم ہیں — ${joinNames('ur', showroomNames('ur'))} — دوپہر بارہ سے رات ساڑھے نو تک۔`,
  compared: (names) => `${joinNames('ur', names)} ساتھ ساتھ ہیں — صرف جو وسیم شائع کرتا ہے۔`,
  whichToCompare: 'کون سے دو — پہلا اور دوسرا؟',
  lighter: (n, heavier) => `جی، ${countWord('ur', n)} ${heavier ? 'بھاری' : 'ہلکے'} پیس — وسیم کے شائع کردہ وزن کے مطابق۔`,
  lighterByForm: (n, heavier) => `جی، ${countWord('ur', n)} پیس بناوٹ میں ${heavier ? 'بھاری' : 'ہلکے'} — اس پیس کا وزن وسیم نے شائع نہیں کیا۔`,
  weightUnknown: 'اس پیس کا وزن وسیم نے شائع نہیں کیا — ملاقات پر تول لیں گے۔',
  similar: (n) => `جی، ${countWord('ur', n)} پیس اسی انداز کے۔`,
  matching: (n) => `جی، ${countWord('ur', n)} پیس جو اس کے ساتھ پہنے جاتے ہیں۔`,
  matchingNone: 'اس کے ساتھ کا کوئی پیس کلیکشن میں نہیں — ملتے جلتے پیس دکھاؤں؟',
  savingNotOffered: 'یہاں محفوظ کرنا نہیں ہوتا — دو پیس ساتھ ساتھ رکھ دوں؟',
  selectionNotOffered: 'یہاں کوئی محفوظ فہرست نہیں — بتائیے کیا دیکھنا ہے۔',
  thanks: 'خوشی ہوئی۔',
  greeting: () => 'السلام علیکم۔ میں Waseem Concierge ہوں — کسی پیس، کلیکشن یا ملاقات کے بارے میں پوچھیے۔',
  close: 'پھر ملیں گے۔',
  help: 'میں پیس لا سکتی ہوں، کلیکشن کھول سکتی ہوں، دو پیس ساتھ رکھ سکتی ہوں، یا ملاقات رکھ سکتی ہوں۔',
  outOfScope: 'یہ ہمارے کام سے باہر ہے — کوئی پیس، یا ملاقات؟',
  watches: 'ہم سونے اور ہیرے کے زیور بناتے ہیں — پیس دکھاؤں؟',
  house: 'وسیم جیولرز 1952 میں لاہور میں چوہدری محمد افضل نے شروع کیا — آج شہر میں تین شو روم ہیں۔',
  collections: `پانچ کلیکشن — ${joinNames('ur', worldNames())} — نام لیجیے، میں لے چلتی ہوں۔`,
  traditional: 'روایتی انداز کے لیے میں پولکی اور کندن سے شروع کرتی ہوں۔',
  tellAbout: (name, specs) => (specs ? `${name}: ${specs}` : `${name} — وزن، خالصیت اور نگینے ہمارے جیولرز ملاقات پر بتاتے ہیں۔`),
  restart: 'دوبارہ شروع — کیا دیکھنا چاہیں گے؟',
  budgetNoted: 'بجٹ نوٹ کر لیا، زیادہ تر پیس کی قیمت درخواست پر بتائی جاتی ہے',
  error: 'معاف کیجیے — دوبارہ کوشش کریں؟',
  micFailed: 'مائیکروفون نہیں کھلا۔',
  micDenied: 'اس سائٹ کے لیے مائیکروفون بند ہے۔',
  noSpeech: 'سن نہیں سکی — دوبارہ، تھوڑا قریب سے۔',
  lineDropped: 'لائن کٹ گئی — دوبارہ کہیں گے؟',
  voiceUnavailable: 'آواز ابھی ممکن نہیں — آپ لکھ کر جاری رکھ سکتے ہیں۔',
};

const paArab: Replies = {
  ack: ['جی۔', 'بالکل۔'],
  clarify: 'معاف کرنا، اک واری ہور؟',
  clarifyAgain: 'ہور لفظاں وچ دسو؟',
  writeInstead: 'شاید لکھ کے بھیج دیو۔',
  clarifyBetween: (a, b) => `معاف کرنا — ${a}، یا ${b}؟`,
  reading: { search: 'کجھ پیس ویکھنا', open: 'اک کھولنا', similar: 'ایہو جیہا کجھ', matching: 'ایہدے نال دا', price: 'قیمت', consultation: 'ملاقات', restart: 'فیر شروع' },
  actions: { write: 'لکھ کے بھیجو', tryAgain: 'فیر کہو', nearby: 'نال دے پیس', bridal: 'برائیڈل پیس', once: 'اک واری ہور' },
  searchResult: (n, what) => `جی، ${countWord('pa-Arab', n)} ${what} ساہمنے ${n === 1 ? 'اے' : 'نے'}۔`,
  searchWidened: (n, what) => `جی، ${countWord('pa-Arab', n)} ${what} ساہمنے ${n === 1 ? 'اے' : 'نے'} — باقی شرطاں ہٹا کے۔`,
  nothing: 'ایہو جیہا اج کوئی نہیں — نال دے پیس وکھاواں؟',
  nearby: (n, what) => `نال دے — ${countWord('pa-Arab', n)} ${what}، باقی شرطاں ہٹا کے۔`,
  nearbyNothing: 'نیڑے وی کجھ نہیں — پیس دی قسم دسو۔',
  opened: (name) => `جی، ${name} ساہمنے اے۔`,
  whichPiece: (anyShown) => (anyShown ? 'کیہڑا پیس — پہلا، یا دوجا؟' : 'کیہڑا پیس — پہلاں برائیڈل پیس لیاواں؟'),
  whichPieceSimilar: 'پہلاں اوہ پیس دسو جیہڑا تہاڈے ذہن وچ اے۔',
  departmentOpen: (d) => `${DEPT['pa-Arab'][d] ?? capitalise(d)} کھل گیا۔`,
  collectionOpen: (name) => `${name} کھل گیا۔`,
  back: 'واپس۔',
  noEarlierPage: 'پچھلا صفحہ نہیں — ہوم چلیے؟',
  formOpen: 'فارم کھل گیا — تہاڈا ناں؟',
  noted: (what) => `${what} لکھ لیا`,
  ask: { name: 'تہاڈا ناں؟', phone: 'فون نمبر؟', showroom: 'کیہڑا شو روم — لبرٹی مارکیٹ، ایم ایم عالم روڈ یا ڈی ایچ اے؟', occasion: 'کیہڑے موقعے لئی؟' },
  allNoted: 'سب لکھ لیا — فارم تسیں بھیج سکدے او۔',
  priceOnRequest: 'ایس پیس دی قیمت درخواست تے دسی جاندی اے — شو روم وچ دس دیندی آں۔',
  priceKnown: (label) => `ایس دی قیمت ${label} اے — ملاقات رکھ دیواں؟`,
  showrooms: `لاہور وچ تن شو روم نے — ${joinNames('pa-Arab', showroomNames('pa-Arab'))} — دپہر بارہ توں رات ساڈھے نو تک۔`,
  compared: (names) => `${joinNames('pa-Arab', names)} نال نال نے — صرف جو وسیم شائع کردا اے۔`,
  whichToCompare: 'کیہڑے دو — پہلا تے دوجا؟',
  lighter: (n, heavier) => `جی، ${countWord('pa-Arab', n)} ${heavier ? 'بھاری' : 'ہلکے'} پیس — وسیم دے شائع کیتے وزن مطابق۔`,
  lighterByForm: (n, heavier) => `جی، ${countWord('pa-Arab', n)} پیس بناوٹ وچ ${heavier ? 'بھاری' : 'ہلکے'} — ایس پیس دا وزن وسیم نے شائع نہیں کیتا۔`,
  weightUnknown: 'ایس پیس دا وزن وسیم نے شائع نہیں کیتا — ملاقات تے تول لواں گے۔',
  similar: (n) => `جی، ${countWord('pa-Arab', n)} پیس ایسے انداز دے۔`,
  matching: (n) => `جی، ${countWord('pa-Arab', n)} پیس جو ایہدے نال پائے جاندے نے۔`,
  matchingNone: 'ایہدے نال دا کوئی پیس کلیکشن وچ نہیں — ملدے جلدے پیس وکھاواں؟',
  savingNotOffered: 'ایتھے محفوظ کرنا نہیں ہوندا — دو پیس نال نال رکھ دیواں؟',
  selectionNotOffered: 'ایتھے کوئی محفوظ لسٹ نہیں — دسو کی ویکھنا اے۔',
  thanks: 'خوشی ہوئی۔',
  greeting: () => 'السلام علیکم۔ میں Waseem Concierge آں — کسے پیس، کلیکشن یا ملاقات بارے پچھو۔',
  close: 'فیر ملاں گے۔',
  help: 'میں پیس لیا سکدی آں، کلیکشن کھول سکدی آں، دو پیس نال رکھ سکدی آں، یا ملاقات رکھ سکدی آں۔',
  outOfScope: 'ایہ ساڈے کم توں باہر اے — کوئی پیس، یا ملاقات؟',
  watches: 'اسی سونے تے ہیرے دے گہنے بناندے آں — پیس وکھاواں؟',
  house: 'وسیم جیولرز 1952 وچ لاہور وچ چوہدری محمد افضل نے شروع کیتا — اج شہر وچ تن شو روم نے۔',
  collections: `پنج کلیکشن — ${joinNames('pa-Arab', worldNames())} — ناں لو، میں لے چلدی آں۔`,
  traditional: 'روایتی انداز لئی میں پولکی تے کندن توں شروع کردی آں۔',
  tellAbout: (name, specs) => (specs ? `${name}: ${specs}` : `${name} — وزن، خالصیت تے نگینے ساڈے جیولرز ملاقات تے دسدے نے۔`),
  restart: 'فیر شروع — کی ویکھنا چاہوگے؟',
  budgetNoted: 'بجٹ نوٹ کر لیا، زیادہ تر پیس دی قیمت درخواست تے دسی جاندی اے',
  error: 'معاف کرنا — فیر کوشش کریے؟',
  micFailed: 'مائیکروفون نہیں کھلیا۔',
  micDenied: 'ایس سائٹ لئی مائیکروفون بند اے۔',
  noSpeech: 'سن نہیں سکی — فیر، تھوڑا نیڑے ہو کے۔',
  lineDropped: 'لائن کٹ گئی — فیر کہو؟',
  voiceUnavailable: 'آواز ہلے ممکن نہیں — تسی لکھ کے جاری رکھ سکدے او۔',
};

const paGuru: Replies = {
  ack: ['ਜੀ।', 'ਬਿਲਕੁਲ।'],
  clarify: 'ਮਾਫ਼ ਕਰਨਾ, ਇੱਕ ਵਾਰੀ ਹੋਰ?',
  clarifyAgain: 'ਹੋਰ ਲਫ਼ਜ਼ਾਂ ਵਿੱਚ ਦੱਸੋ?',
  writeInstead: 'ਸ਼ਾਇਦ ਲਿਖ ਕੇ ਭੇਜ ਦਿਓ।',
  clarifyBetween: (a, b) => `ਮਾਫ਼ ਕਰਨਾ — ${a}, ਜਾਂ ${b}?`,
  reading: { search: 'ਕੁਝ ਪੀਸ ਵੇਖਣਾ', open: 'ਇੱਕ ਖੋਲ੍ਹਣਾ', similar: 'ਇਹੋ ਜਿਹਾ ਕੁਝ', matching: 'ਇਹਦੇ ਨਾਲ ਦਾ', price: 'ਕੀਮਤ', consultation: 'ਮੁਲਾਕਾਤ', restart: 'ਫੇਰ ਸ਼ੁਰੂ' },
  actions: { write: 'ਲਿਖ ਕੇ ਭੇਜੋ', tryAgain: 'ਫੇਰ ਕਹੋ', nearby: 'ਨਾਲ ਦੇ ਪੀਸ', bridal: 'ਬ੍ਰਾਈਡਲ ਪੀਸ', once: 'ਇੱਕ ਵਾਰੀ ਹੋਰ' },
  searchResult: (n, what) => `ਜੀ, ${countWord('pa-Guru', n)} ${what} ਸਾਹਮਣੇ ${n === 1 ? 'ਹੈ' : 'ਹਨ'}।`,
  searchWidened: (n, what) => `ਜੀ, ${countWord('pa-Guru', n)} ${what} ਸਾਹਮਣੇ ${n === 1 ? 'ਹੈ' : 'ਹਨ'} — ਬਾਕੀ ਸ਼ਰਤਾਂ ਹਟਾ ਕੇ।`,
  nothing: 'ਇਹੋ ਜਿਹਾ ਅੱਜ ਕੋਈ ਨਹੀਂ — ਨਾਲ ਦੇ ਪੀਸ ਵਿਖਾਵਾਂ?',
  nearby: (n, what) => `ਨਾਲ ਦੇ — ${countWord('pa-Guru', n)} ${what}, ਬਾਕੀ ਸ਼ਰਤਾਂ ਹਟਾ ਕੇ।`,
  nearbyNothing: 'ਨੇੜੇ ਵੀ ਕੁਝ ਨਹੀਂ — ਪੀਸ ਦੀ ਕਿਸਮ ਦੱਸੋ।',
  opened: (name) => `ਜੀ, ${name} ਸਾਹਮਣੇ ਹੈ।`,
  whichPiece: (anyShown) => (anyShown ? 'ਕਿਹੜਾ ਪੀਸ — ਪਹਿਲਾ, ਜਾਂ ਦੂਜਾ?' : 'ਕਿਹੜਾ ਪੀਸ — ਪਹਿਲਾਂ ਬ੍ਰਾਈਡਲ ਪੀਸ ਲਿਆਵਾਂ?'),
  whichPieceSimilar: 'ਪਹਿਲਾਂ ਉਹ ਪੀਸ ਦੱਸੋ ਜਿਹੜਾ ਤੁਹਾਡੇ ਜ਼ਿਹਨ ਵਿੱਚ ਹੈ।',
  departmentOpen: (d) => `${DEPT['pa-Guru'][d] ?? capitalise(d)} ਖੁੱਲ੍ਹ ਗਿਆ।`,
  collectionOpen: (name) => `${name} ਖੁੱਲ੍ਹ ਗਿਆ।`,
  back: 'ਵਾਪਸ।',
  noEarlierPage: 'ਪਿਛਲਾ ਸਫ਼ਾ ਨਹੀਂ — ਹੋਮ ਚੱਲੀਏ?',
  formOpen: 'ਫ਼ਾਰਮ ਖੁੱਲ੍ਹ ਗਿਆ — ਤੁਹਾਡਾ ਨਾਂ?',
  noted: (what) => `${what} ਲਿਖ ਲਿਆ`,
  ask: { name: 'ਤੁਹਾਡਾ ਨਾਂ?', phone: 'ਫ਼ੋਨ ਨੰਬਰ?', showroom: 'ਕਿਹੜਾ ਸ਼ੋਅਰੂਮ — ਲਿਬਰਟੀ ਮਾਰਕੀਟ, ਐਮ ਐਮ ਆਲਮ ਰੋਡ ਜਾਂ ਡੀ ਐਚ ਏ?', occasion: 'ਕਿਹੜੇ ਮੌਕੇ ਲਈ?' },
  allNoted: 'ਸਭ ਲਿਖ ਲਿਆ — ਫ਼ਾਰਮ ਤੁਸੀਂ ਭੇਜ ਸਕਦੇ ਹੋ।',
  priceOnRequest: 'ਇਸ ਪੀਸ ਦੀ ਕੀਮਤ ਬੇਨਤੀ ਤੇ ਦੱਸੀ ਜਾਂਦੀ ਹੈ — ਸ਼ੋਅਰੂਮ ਵਿੱਚ ਦੱਸ ਦਿੰਦੀ ਹਾਂ।',
  priceKnown: (label) => `ਇਸ ਦੀ ਕੀਮਤ ${label} ਹੈ — ਮੁਲਾਕਾਤ ਰੱਖ ਦਿਆਂ?`,
  showrooms: `ਲਾਹੌਰ ਵਿੱਚ ਤਿੰਨ ਸ਼ੋਅਰੂਮ ਹਨ — ${joinNames('pa-Guru', showroomNames('pa-Guru'))} — ਦੁਪਹਿਰ ਬਾਰਾਂ ਤੋਂ ਰਾਤ ਸਾਢੇ ਨੌਂ ਤੱਕ।`,
  compared: (names) => `${joinNames('pa-Guru', names)} ਨਾਲ ਨਾਲ ਹਨ — ਸਿਰਫ਼ ਜੋ ਵਸੀਮ ਛਾਪਦਾ ਹੈ।`,
  whichToCompare: 'ਕਿਹੜੇ ਦੋ — ਪਹਿਲਾ ਤੇ ਦੂਜਾ?',
  lighter: (n, heavier) => `ਜੀ, ${countWord('pa-Guru', n)} ${heavier ? 'ਭਾਰੀ' : 'ਹਲਕੇ'} ਪੀਸ — ਵਸੀਮ ਦੇ ਛਾਪੇ ਵਜ਼ਨ ਮੁਤਾਬਕ।`,
  lighterByForm: (n, heavier) => `ਜੀ, ${countWord('pa-Guru', n)} ਪੀਸ ਬਣਾਵਟ ਵਿੱਚ ${heavier ? 'ਭਾਰੀ' : 'ਹਲਕੇ'} — ਇਸ ਪੀਸ ਦਾ ਵਜ਼ਨ ਵਸੀਮ ਨੇ ਨਹੀਂ ਛਾਪਿਆ।`,
  weightUnknown: 'ਇਸ ਪੀਸ ਦਾ ਵਜ਼ਨ ਵਸੀਮ ਨੇ ਨਹੀਂ ਛਾਪਿਆ — ਮੁਲਾਕਾਤ ਤੇ ਤੋਲ ਲਵਾਂਗੇ।',
  similar: (n) => `ਜੀ, ${countWord('pa-Guru', n)} ਪੀਸ ਇਸੇ ਅੰਦਾਜ਼ ਦੇ।`,
  matching: (n) => `ਜੀ, ${countWord('pa-Guru', n)} ਪੀਸ ਜੋ ਇਹਦੇ ਨਾਲ ਪਾਏ ਜਾਂਦੇ ਹਨ।`,
  matchingNone: 'ਇਹਦੇ ਨਾਲ ਦਾ ਕੋਈ ਪੀਸ ਕਲੈਕਸ਼ਨ ਵਿੱਚ ਨਹੀਂ — ਮਿਲਦੇ ਜੁਲਦੇ ਪੀਸ ਵਿਖਾਵਾਂ?',
  savingNotOffered: 'ਇੱਥੇ ਸੇਵ ਕਰਨਾ ਨਹੀਂ ਹੁੰਦਾ — ਦੋ ਪੀਸ ਨਾਲ ਨਾਲ ਰੱਖ ਦਿਆਂ?',
  selectionNotOffered: 'ਇੱਥੇ ਕੋਈ ਸੇਵ ਕੀਤੀ ਸੂਚੀ ਨਹੀਂ — ਦੱਸੋ ਕੀ ਵੇਖਣਾ ਹੈ।',
  thanks: 'ਖ਼ੁਸ਼ੀ ਹੋਈ।',
  greeting: () => 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ। ਮੈਂ Waseem Concierge ਹਾਂ — ਕਿਸੇ ਪੀਸ, ਕਲੈਕਸ਼ਨ ਜਾਂ ਮੁਲਾਕਾਤ ਬਾਰੇ ਪੁੱਛੋ।',
  close: 'ਫੇਰ ਮਿਲਾਂਗੇ।',
  help: 'ਮੈਂ ਪੀਸ ਲਿਆ ਸਕਦੀ ਹਾਂ, ਕਲੈਕਸ਼ਨ ਖੋਲ੍ਹ ਸਕਦੀ ਹਾਂ, ਦੋ ਪੀਸ ਨਾਲ ਰੱਖ ਸਕਦੀ ਹਾਂ, ਜਾਂ ਮੁਲਾਕਾਤ ਰੱਖ ਸਕਦੀ ਹਾਂ।',
  outOfScope: 'ਇਹ ਸਾਡੇ ਕੰਮ ਤੋਂ ਬਾਹਰ ਹੈ — ਕੋਈ ਪੀਸ, ਜਾਂ ਮੁਲਾਕਾਤ?',
  watches: 'ਅਸੀਂ ਸੋਨੇ ਤੇ ਹੀਰੇ ਦੇ ਗਹਿਣੇ ਬਣਾਉਂਦੇ ਹਾਂ — ਪੀਸ ਵਿਖਾਵਾਂ?',
  house: 'ਵਸੀਮ ਜਿਊਲਰਜ਼ 1952 ਵਿੱਚ ਲਾਹੌਰ ਵਿੱਚ ਚੌਧਰੀ ਮੁਹੰਮਦ ਅਫ਼ਜ਼ਲ ਨੇ ਸ਼ੁਰੂ ਕੀਤਾ — ਅੱਜ ਸ਼ਹਿਰ ਵਿੱਚ ਤਿੰਨ ਸ਼ੋਅਰੂਮ ਹਨ।',
  collections: `ਪੰਜ ਕਲੈਕਸ਼ਨ — ${joinNames('pa-Guru', worldNames())} — ਨਾਂ ਲਓ, ਮੈਂ ਲੈ ਚੱਲਦੀ ਹਾਂ।`,
  traditional: 'ਰਿਵਾਇਤੀ ਅੰਦਾਜ਼ ਲਈ ਮੈਂ ਪੋਲਕੀ ਤੇ ਕੁੰਦਨ ਤੋਂ ਸ਼ੁਰੂ ਕਰਦੀ ਹਾਂ।',
  tellAbout: (name, specs) => (specs ? `${name}: ${specs}` : `${name} — ਵਜ਼ਨ, ਸ਼ੁੱਧਤਾ ਤੇ ਨਗੀਨੇ ਸਾਡੇ ਜਿਊਲਰ ਮੁਲਾਕਾਤ ਤੇ ਦੱਸਦੇ ਹਨ।`),
  restart: 'ਫੇਰ ਸ਼ੁਰੂ — ਕੀ ਵੇਖਣਾ ਚਾਹੋਗੇ?',
  budgetNoted: 'ਬਜਟ ਨੋਟ ਕਰ ਲਿਆ, ਜ਼ਿਆਦਾਤਰ ਪੀਸ ਦੀ ਕੀਮਤ ਬੇਨਤੀ ਤੇ ਦੱਸੀ ਜਾਂਦੀ ਹੈ',
  error: 'ਮਾਫ਼ ਕਰਨਾ — ਫੇਰ ਕੋਸ਼ਿਸ਼ ਕਰੀਏ?',
  micFailed: 'ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਨਹੀਂ ਖੁੱਲ੍ਹਿਆ।',
  micDenied: 'ਇਸ ਸਾਈਟ ਲਈ ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਬੰਦ ਹੈ।',
  noSpeech: 'ਸੁਣ ਨਹੀਂ ਸਕੀ — ਫੇਰ, ਥੋੜ੍ਹਾ ਨੇੜੇ ਹੋ ਕੇ।',
  lineDropped: 'ਲਾਈਨ ਕੱਟ ਗਈ — ਫੇਰ ਕਹੋ?',
  voiceUnavailable: 'ਆਵਾਜ਼ ਹਾਲੇ ਮੁਮਕਿਨ ਨਹੀਂ — ਤੁਸੀਂ ਲਿਖ ਕੇ ਜਾਰੀ ਰੱਖ ਸਕਦੇ ਹੋ।',
};

const TABLE: Record<ReplyLanguage, Replies> = { en, 'ur-Latn': urLatn, 'pa-Latn': paLatn, ur, 'pa-Arab': paArab, 'pa-Guru': paGuru };

/** The reply table for a language; `null`, `undefined` and `mixed` read as English. */
export function replies(language: Language | ReplyLanguage | null | undefined): Replies {
  return language && language !== 'mixed' ? TABLE[language] : en;
}

/** `mixed` is a real reading of a sentence but not a language to answer in; a reply column is chosen for it. */
export const asReplyLanguage = (language: Language | null | undefined): ReplyLanguage | null => (language && language !== 'mixed' ? language : null);

/** English function words that carry no request of their own — filtered before deciding a sentence is not understood. */
const STOP_EN = new Set(['the', 'a', 'an', 'me', 'my', 'please', 'some', 'something', 'any', 'anything', 'more', 'again', 'now', 'also', 'just', 'like', 'want', 'could', 'would', 'can', 'you', 'kindly', 'one', 'ones', 'them', 'this', 'that', 'these', 'those', 'for', 'in', 'of', 'to', 'with', 'and', 'or', 'it', 'is', 'are', 'be', 'let', 'lets', 'see', 'look', 'looking', 'show', 'give', 'bring', 'get', 'take', 'go', 'have', 'has', 'do', 'does', 'what', 'which', 'nice', 'good', 'else', 'other', 'another', 'few', 'bit', 'little', 'thing', 'things', 'here', 'there', 'okay', 'ok', 'yes', 'yeah', 'no', 'not', 'too', 'very', 'so', 'then', 'well', 'right', 'sure', 'um', 'uh', 'hmm', 'ji', 'sorry', 'hello', 'hi']);

/**
 * Roman Urdu and Punjabi words that carry no request of their own — pronouns, particles,
 * the small verbs — as opposed to the language evidence in `script.ts`, which also lists
 * content words ("kal", "shaam", "time") because they prove a language. A content word the
 * engine does not know is exactly what should make it ask.
 */
const STOP_ROMAN = new Set(['kuch', 'kujh', 'koi', 'aur', 'hor', 'zara', 'thora', 'thoda', 'thori', 'thodi', 'sa', 'si', 'se', 'bhi', 'vi', 'wala', 'wali', 'wale', 'vala', 'vale', 'vali', 'ji', 'bilkul', 'mujhe', 'mujhay', 'menu', 'mainu', 'aap', 'tusi', 'ka', 'ke', 'ki', 'da', 'de', 'di', 'mein', 'vich', 'ch', 'liye', 'layi', 'ton', 'ko', 'nu', 'hai', 'hain', 'ae', 'ne', 'karo', 'kar', 'do', 'deo', 'dio', 'chahiye', 'chahida', 'phir', 'fer', 'ab', 'hun', 'abhi', 'is', 'us', 'yeh', 'ye', 'eh', 'oh', 'woh', 'wo', 'ehde', 'ohde', 'iske', 'uske', 'iski', 'uski', 'toh', 'to', 'na', 'nahi', 'nai', 'bas', 'mera', 'meri', 'mere', 'humein', 'sanu', 'kya', 'ki', 'kaun', 'kehda', 'jo', 'jehda', 'wo', 'ok', 'acha', 'accha', 'theek', 'zaroor', 'dekhna', 'vekhna', 'dikhana', 'kholna', 'lao', 'lyao', 'chalo', 'le']);

/**
 * The words of a sentence the engine did not understand — neither a concept, nor a function
 * word of any of the five languages. One such word in a sentence with no subject of its own
 * is the sign to ask rather than act: "Kal shaam ka time dekhna" is a request the keyless
 * engine cannot read, and searching for four arbitrary pieces would be pretending it had.
 */
export function unknownWords(frame: IntentFrame): string[] {
  const residue = frame.slots.residue ?? '';
  return residue
    .split(' ')
    .filter(Boolean)
    .filter((w) => !STOP_EN.has(w) && !STOP_ROMAN.has(w));
}

/**
 * The language a reply is written in — the rule of language persistence, made explicit.
 *
 * A sentence with evidence of its own — an Urdu script, a Punjabi function word, an English
 * sentence of three words or more — decides its language and becomes the conversation's. A
 * short command with no evidence ("Second one.", "Gold.", "Liberty.") has no language of its
 * own and inherits the last full sentence's. A shared Roman word ("doosra wala kholo") proves
 * only that the line is not English; whether it is Urdu or Punjabi is inherited too.
 *
 * `mixed` — two scripts in one line — is answered in the non-Latin script the visitor
 * reached for, since that is the harder one to have typed.
 */
export function resolveReplyLanguage(frame: IntentFrame, remembered: Language | null | undefined, tokens: number): ReplyLanguage {
  const prior = asReplyLanguage(remembered);
  if (frame.language === 'mixed') {
    if (frame.scripts.includes('gurmukhi')) return 'pa-Guru';
    if (frame.scripts.includes('arabic')) return prior === 'pa-Arab' || prior === 'pa-Latn' ? 'pa-Arab' : 'ur';
    return prior ?? 'ur-Latn';
  }
  if (frame.language === 'ur' || frame.language === 'pa-Arab' || frame.language === 'pa-Guru' || frame.language === 'pa-Latn') return frame.language;
  if (frame.language === 'ur-Latn') return frame.evidence === 'shared' && prior === 'pa-Latn' ? 'pa-Latn' : 'ur-Latn';
  // English by absence of evidence: a full sentence decides, a short command inherits
  if (tokens <= 2 && prior) return prior;
  return 'en';
}

let ackTurn = 0;

/** The one word said as an action starts — alternated so two consecutive turns do not open alike. */
export function nextAck(language: ReplyLanguage): string {
  ackTurn += 1;
  return replies(language).ack[ackTurn % 2]!;
}
