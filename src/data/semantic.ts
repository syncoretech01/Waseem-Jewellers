import type { SemanticDescriptor } from '@/semantic/types';

/**
 * Which pieces can be looked at closely, and what may be said while looking.
 *
 * Every rectangle here is one Stage 1 already cut from the source frame, published as its
 * own image, and reviewed — `p03-macro` is literally `crop: [0.26, 0.5, 0.48, 0.36]` of
 * `p03-hero`. Nothing has been placed by guessing where a part of a piece might be, and no
 * note says anything the photograph and the published specification do not already support.
 *
 * That is also why this list is eight pieces rather than six hundred. There is no family
 * that scales without a person writing about the jewellery: a scale ladder still has to say
 * what it is showing, and "the filigree" is a claim about a piece that may have none. The
 * honest constraint is that teaching requires knowledge, and the knowledge is Waseem's.
 *
 * **Open with Waseem.** Regions for the wider catalogue — which part of a piece is the
 * choker and which the haar, and what is true about each — need their sign-off before they
 * can be written. Until then a piece with no descriptor simply shows its photograph, which
 * is what it did before.
 *
 * Terminology: these figures move attention between regions of a finished photograph. They
 * are never described, here or anywhere, as how a piece was constructed or assembled.
 */
export const SEMANTIC: Record<string, SemanticDescriptor> = {
  'naqsh-e-gul-pearl-blossom-choker': {
    family: 'craft-detail',
    image: { kind: 'local', id: 'p03-hero' },
    assertion: 'regions-of-one-photograph',
    lede: 'One photograph, twice as close.',
    regions: [
      {
        key: 'earring',
        label: 'The earring',
        note: 'The earring repeats the choker’s blossom at a smaller scale, so the pair reads as one piece across the face and the collar.',
        rect: [0.18, 0.22, 0.34, 0.42],
        reviewed: true,
      },
      {
        key: 'choker',
        label: 'The choker',
        note: 'White diamonds set in flower heads, with pearls hung between them — the weight sits along the collarbone rather than at the throat.',
        rect: [0.26, 0.5, 0.48, 0.36],
        reviewed: true,
      },
    ],
  },

  'diamond-bridal-sapphire-suite': {
    family: 'craft-detail',
    image: { kind: 'local', id: 'p07-hero' },
    assertion: 'regions-of-one-photograph',
    lede: 'One photograph, twice as close.',
    regions: [
      {
        key: 'earring',
        label: 'The chandelier earring',
        note: 'The earring carries the same pavé as the necklace and hangs in three tiers, which is what gives it movement when the head turns.',
        rect: [0.12, 0.2, 0.36, 0.44],
        reviewed: true,
      },
      {
        key: 'pendant',
        label: 'The pendant',
        note: 'A sapphire held in a pavé surround. Waseem publishes this suite at 21K, 94.68 grams, with 13.26 carats of diamonds graded H and VVS1.',
        rect: [0.28, 0.5, 0.44, 0.4],
        reviewed: true,
      },
    ],
  },

  'aks-e-noor-satlada-haar': {
    family: 'goldwork',
    image: { kind: 'local', id: 'p05-hero' },
    assertion: 'regions-of-one-photograph',
    regions: [
      {
        key: 'strands',
        label: 'The strands',
        note: 'The long haar falls in graded links, each one worked with the same rose motif that runs through the collar above it.',
        rect: [0.2, 0.44, 0.6, 0.5],
        reviewed: true,
      },
    ],
  },

  'dewan-bridal-suite': {
    family: 'goldwork',
    image: { kind: 'local', id: 'p04-hero' },
    assertion: 'regions-of-one-photograph',
    regions: [
      {
        key: 'haar',
        label: 'The haar and collar',
        note: 'The collar sits high and the haar falls long beneath it, both carrying the same medallion so the two read as one suite.',
        rect: [0.22, 0.46, 0.56, 0.42],
        reviewed: true,
      },
    ],
  },

  'rang-e-jamal-emerald-suite': {
    family: 'goldwork',
    image: { kind: 'local', id: 'p06-hero' },
    assertion: 'regions-of-one-photograph',
    regions: [
      {
        key: 'centre',
        label: 'The centre',
        note: 'Emeralds set among diamonds, closer than the eye reaches at arm’s length.',
        rect: [0.24, 0.46, 0.52, 0.4],
        reviewed: true,
      },
    ],
  },

  'emerald-tassel-earrings-t06768': {
    family: 'goldwork',
    image: { kind: 'local', id: 'p08-hero' },
    assertion: 'regions-of-one-photograph',
    regions: [
      {
        key: 'tassel',
        label: 'The tassel',
        note: 'Reference T06768 — 21K gold, 16.452 grams. The drop is what carries the weight, and what makes it swing.',
        rect: [0.25, 0.1, 0.5, 0.6],
        reviewed: true,
      },
    ],
  },

  'lavender-halo-ring-r11912': {
    family: 'goldwork',
    image: { kind: 'local', id: 'p09-hero' },
    assertion: 'regions-of-one-photograph',
    regions: [
      {
        key: 'halo',
        label: 'The halo',
        note: 'Reference R11912 — 21K gold, 9.444 grams. The lavender stone is held by a ring of small diamonds that widen the face of the piece.',
        rect: [0.25, 0.15, 0.5, 0.5],
        reviewed: true,
      },
    ],
  },

  'timeless-feathered-cluster-ring': {
    family: 'goldwork',
    image: { kind: 'local', id: 'p10-hero' },
    assertion: 'regions-of-one-photograph',
    regions: [
      {
        key: 'cluster',
        label: 'The cluster',
        note: 'Diamonds set close together so the light crosses between them rather than off one stone.',
        rect: [0.23, 0.24, 0.56, 0.56],
        reviewed: true,
      },
    ],
  },
};

export const semanticFor = (slug: string): SemanticDescriptor | undefined => SEMANTIC[slug];

/** Every rectangle in this file is one Stage 1 reviewed; nothing waits on a sign-off yet. */
export const AWAITING_REGION_SIGN_OFF = Object.entries(SEMANTIC).flatMap(([slug, d]) =>
  d.regions.filter((r) => !r.reviewed).map((r) => `${slug}:${r.key}`),
);
