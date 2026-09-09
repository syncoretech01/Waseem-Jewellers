import type { Product } from '../types';

/**
 * What a specification means, written once.
 *
 * 443 of the 592 pieces a visitor can reach have a single photograph, three specification
 * rows and no story — because Waseem has not written one, and inventing one would be the
 * single most brand-damaging thing this site could do. So the page gives a reader something
 * true instead: what 21 karat means in this market, what VVS1 describes, what an uncut stone
 * is.
 *
 * Every note here is a general fact about the material, correctly attributed as such. None
 * of them says anything about the individual piece, and the page presents them under a
 * heading that makes the difference plain. A note appears only when the piece publishes the
 * specification it explains.
 */
export interface MaterialNote {
  id: string;
  /** The heading a reader sees. */
  term: string;
  body: string;
  /** True when the note is about this piece's published specification. */
  applies: (p: Product) => boolean;
}

export const MATERIAL_NOTES: MaterialNote[] = [
  {
    id: 'k21',
    term: 'Twenty-one karat',
    body:
      'Twenty-one karat is 87.5% gold, and it is the standard most of Pakistan buys in. It holds a setting better than 22 karat and keeps more of the deep yellow that 18 karat loses. Most of what Waseem makes is 21 karat.',
    applies: (p) => p.spec.purity === '21K',
  },
  {
    id: 'k22',
    term: 'Twenty-two karat',
    body:
      'Twenty-two karat is 91.6% gold — softer, warmer in colour, and the traditional choice for pieces bought as much for their weight as for their form.',
    applies: (p) => p.spec.purity === '22K',
  },
  {
    id: 'k18',
    term: 'Eighteen karat',
    body:
      'Eighteen karat is 75% gold. The remaining quarter is what makes it hard enough to hold small stones securely, which is why diamond work is so often set in it.',
    applies: (p) => p.spec.purity === '18K',
  },
  {
    id: 'gross-weight',
    term: 'Gross weight',
    body:
      'Gross weight is the whole piece as it is weighed — metal and stones together. It is the figure a buyer here asks for first, and the one Waseem publishes; a net weight excluding stones is confirmed at a viewing.',
    applies: (p) => p.spec.grossWeightGrams !== undefined,
  },
  {
    id: 'clarity-vvs',
    term: 'VVS',
    body:
      'VVS describes a diamond whose inclusions are very, very difficult to find under ten-times magnification. VVS1 is the cleaner of the two grades. Nothing at this level is visible to the eye.',
    applies: (p) => Boolean(p.spec.diamondClarity?.startsWith('VVS')),
  },
  {
    id: 'clarity-vs',
    term: 'VS',
    body:
      'VS describes inclusions that a grader can find under ten-times magnification but that remain invisible to the eye at any normal distance.',
    applies: (p) => Boolean(p.spec.diamondClarity?.startsWith('VS')),
  },
  {
    id: 'colour-gh',
    term: 'G&H colour',
    body:
      'G and H are near-colourless grades. Set in yellow gold, which lends its own warmth, they read as white — which is why they are the grades most often chosen for gold work rather than for a solitaire.',
    applies: (p) => Boolean(p.spec.diamondColour && /^G\s*&?\s*H$|^H$|^GH$/i.test(p.spec.diamondColour)),
  },
  {
    id: 'carat',
    term: 'Carat weight',
    body:
      'A carat is a fifth of a gram, and the figure given is the total across every stone in the piece rather than the size of any one of them. A high total spread across many small stones is a different thing from the same total in one.',
    applies: (p) => p.spec.diamondCarat !== undefined,
  },
  {
    id: 'polki',
    term: 'Polki',
    body:
      'Polki is diamond in its uncut state — cleaved and polished along the crystal’s own faces rather than cut to a modern brilliant. It gives a flatter, softer light, and it is the older of the two traditions.',
    applies: (p) => p.material === 'polki',
  },
];

export const notesFor = (product: Product, limit = 3): MaterialNote[] => MATERIAL_NOTES.filter((n) => n.applies(product)).slice(0, limit);
