import type { HeritageMoment, Showroom } from './types';
import { SITE } from './site';

/**
 * CH03 — 1952. Copy is limited to facts published on waseemjewellers.com.
 * Only the facade is treated (monochrome scrubbing to colour); every other image is mounted in colour.
 */
export const HERITAGE: HeritageMoment[] = [
  {
    id: 'h1',
    numeral: '01',
    line: '1952',
    image: 'heritage-facade',
    treatment: 'monochrome-to-colour',
    ratio: '4:5',
    parallax: 0.12,
    caption: 'The showroom · Lahore',
  },
  {
    id: 'h2',
    numeral: '02',
    line: 'ONE GENERATION.',
    fact: 'Founded in Lahore by Chaudhry Muhammad Afzal.',
    image: 'heritage-vitrine',
    treatment: 'mounted',
    ratio: '3:2',
    parallax: 0.2,
    caption: 'Gold · the vitrine',
  },
  {
    id: 'h3',
    numeral: '03',
    line: 'THEN ANOTHER.',
    fact: 'Chaudhry Waseem Afzal expanded Waseem with modern showrooms.',
    image: 'heritage-kundan',
    treatment: 'mounted',
    ratio: '1:1',
    parallax: 0.28,
    caption: 'Kundan · detail',
  },
  {
    id: 'h4',
    numeral: '04',
    line: 'CRAFTED ACROSS GENERATIONS.',
    image: 'still-royal-66',
    treatment: 'mounted',
    ratio: '21:9',
    parallax: 0.08,
    caption: 'Polki and pearl · from the Royal Wedding film',
  },
  {
    id: 'h5',
    numeral: '05',
    line: 'ONE NAME. LAHORE.',
    fact: 'MM Alam Road · Liberty Market · DHA',
    image: 'heritage-portrait',
    treatment: 'mounted',
    ratio: '4:5',
    parallax: 0.16,
    caption: 'Antique gold · campaign',
  },
];

/**
 * The homepage heritage chapter, Stage 2.2. What it says, in the order the client set:
 * the name, the year, the city, the generations, the showrooms. The founder and the
 * successor stay in SITE for the footer and the product pages; the homepage does not
 * lead with ownership succession. Every string here is a fact SITE already publishes,
 * or a heading over one.
 */
export const HERITAGE_COPY = {
  /** The eyebrow over the statement: the name, and nothing else. */
  eyebrow: SITE.name,
  /** The statement. Set large and left alone. */
  statement: `Since ${SITE.since}.`,
  /** The line under it, in display type at heading size. */
  line: 'Lahore. Three showrooms.',
  /** Two sentences of prose, restrained: the published fact, and the one name over three doors. */
  prose: `Waseem has sold gold in Lahore since ${SITE.since}. Three showrooms in the city carry the name today.`,
  /** The caption under the facade. Which showroom the photograph shows is not published, so it is not claimed. */
  caption: 'The showroom · Lahore',
  /** Labels for the practical line under the showrooms. */
  hours: 'Hours',
  telephone: 'Telephone',
  /** The map action on each showroom, and the note a screen reader hears after it. */
  map: 'Map',
  mapNote: 'opens in Google Maps in a new tab',
} as const;

/**
 * The order the three showrooms are presented in on the homepage — the client's, and
 * deliberate: Liberty Market, MM Alam Road, DHA. SITE.showrooms is left exactly as it is,
 * because the footer, the consultation form and the concierge all read it; this is a
 * presentation order for the heritage chapter alone, resolved by id at render time.
 */
export const SHOWROOM_ORDER = ['liberty', 'mm-alam', 'dha'] as const;

/** SITE.showrooms in SHOWROOM_ORDER. An id that SITE does not know is skipped rather than invented. */
export function showroomsInOrder(): Showroom[] {
  return SHOWROOM_ORDER.map((id) => SITE.showrooms.find((s) => s.id === id)).filter((s): s is Showroom => s !== undefined);
}
