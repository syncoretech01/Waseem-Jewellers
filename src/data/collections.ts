import type { Collection } from './types';

/** Bridal — the one collection route of Stage 1. More collections are added here by data only. */
export const COLLECTIONS: Collection[] = [
  {
    slug: 'bridal',
    name: 'Bridal',
    tagline: 'Worn once. Kept for a lifetime.',
    intro: [
      'Bridal gathers the pieces made for the day itself: chokers and long haars, tikkas, earrings and rings, in gold, uncut stones and diamonds.',
      'Each suite is composed to be worn together and kept apart — the pieces of one set, seen again on other days.',
    ],
    opening: { video: 'bridal-opening', still: 'p03-hero' },
    pieces: [
      'royal-wedding-polki-raani-haar',
      'rukh-e-jana-pleated-collar',
      'aks-e-noor-satlada-haar',
      'naqsh-e-gul-pearl-blossom-choker',
      'dewan-bridal-suite',
      'rang-e-jamal-emerald-suite',
      'diamond-bridal-sapphire-suite',
      'emerald-tassel-earrings-t06768',
    ],
    chapters: [
      {
        id: 'candlelight',
        numeral: 'I',
        title: 'By Candlelight',
        theme: 'dark',
        blocks: [
          { kind: 'solo', piece: 'royal-wedding-polki-raani-haar', scale: 'wide', caption: 'Uncut stones. Green drops. A candle.' },
          { kind: 'interlude', lines: ['FOR THE DAY', 'THAT BECOMES', 'FOREVER.'], image: 'still-royal-13' },
          { kind: 'duet', pieces: ['rukh-e-jana-pleated-collar', 'aks-e-noor-satlada-haar'], offset: 'right' },
        ],
      },
      {
        id: 'jali',
        numeral: 'II',
        title: 'Through the Jali',
        theme: 'ivory',
        blocks: [
          { kind: 'solo', piece: 'naqsh-e-gul-pearl-blossom-choker', scale: 'full' },
          { kind: 'interlude', lines: ['Light through a lattice.', 'Gold that remembers it.'], urdu: 'نقش گل', video: 'bridal-opening', theme: 'ivory' },
        ],
      },
      {
        id: 'moonlight',
        numeral: 'III',
        title: 'Moonlight',
        theme: 'dark',
        blocks: [
          { kind: 'solo', piece: 'dewan-bridal-suite', scale: 'full' },
          { kind: 'duet', pieces: ['rang-e-jamal-emerald-suite', 'diamond-bridal-sapphire-suite'], offset: 'left' },
        ],
      },
      {
        id: 'close',
        numeral: 'IV',
        title: 'The Close',
        theme: 'ivory',
        blocks: [{ kind: 'solo', piece: 'emerald-tassel-earrings-t06768', scale: 'wide', caption: 'CRAFTED TO ENDURE' }],
      },
    ],
    wornTogether: ['lavender-halo-ring-r11912', 'timeless-feathered-cluster-ring', 'aks-e-noor-satlada-haar'],
  },
];

export const COLLECTION_BY_SLUG = Object.fromEntries(COLLECTIONS.map((c) => [c.slug, c])) as Record<string, Collection>;
