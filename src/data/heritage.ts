import type { HeritageMoment } from './types';

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
    fact: 'Chaudhry Waseem Afzal expanded the house with modern showrooms.',
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
    line: 'ONE HOUSE. LAHORE.',
    fact: 'MM Alam Road · Liberty Market · DHA',
    image: 'heritage-portrait',
    treatment: 'mounted',
    ratio: '4:5',
    parallax: 0.16,
    caption: 'Antique gold · campaign',
  },
];
