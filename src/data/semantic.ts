import type { SemanticDescriptor } from '@/semantic/types';

/**
 * Which pieces can be looked at closely, and what may be said while looking.
 *
 * Two kinds of rectangle live here. The first kind is one Stage 1 already cut from the source
 * frame, published as its own image, and reviewed — `p03-macro` is literally
 * `crop: [0.26, 0.5, 0.48, 0.36]` of `p03-hero`; those carry `reviewed: true`. The second
 * kind was placed by looking at the photograph and naming what is plainly in it — the four
 * claws on a ring, the two crowns of a pair of earrings, the collar of a suite — and carries
 * `reviewed: false` until Waseem confirms the naming. `AWAITING_REGION_SIGN_OFF` lists them
 * by name so the ask is concrete.
 *
 * No note says anything the photograph and the published specification do not already
 * support. Weights, purities and references are the catalogue's; everything else is what a
 * person can see in the frame.
 *
 * That is also why this list is nine pieces rather than six hundred. There is no family
 * that scales without a person writing about the jewellery: a scale ladder still has to say
 * what it is showing, and "the filigree" is a claim about a piece that may have none. The
 * honest constraint is that teaching requires knowledge, and the knowledge is Waseem's.
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

  /**
   * The suite, named in place. The photograph shows the tikka, the earrings, the choker and
   * the haar as they were worn for the shoot; the figure travels between them and says what
   * each is. Waseem's own description of the piece is the source of every claim below.
   */
  'rang-e-jamal-emerald-suite': {
    family: 'composition',
    image: { kind: 'local', id: 'p06-hero' },
    assertion: 'regions-of-one-photograph',
    lede: 'One suite, four pieces, one photograph.',
    regions: [
      {
        key: 'tikka',
        label: 'The tikka',
        note: 'At the parting, one emerald in a diamond surround — the smallest piece of the suite.',
        rect: [0.4, 0.01, 0.16, 0.16],
        reviewed: false,
      },
      {
        key: 'earrings',
        label: 'The earrings',
        note: 'Long diamond earrings with emeralds set down their length, ending in a drop that moves with the head.',
        rect: [0.4, 0.26, 0.27, 0.2],
        reviewed: false,
      },
      {
        key: 'choker',
        label: 'The choker',
        note: 'The choker sits at the throat, its emeralds set at intervals along a band of diamonds.',
        rect: [0.43, 0.38, 0.24, 0.17],
        reviewed: false,
      },
      {
        key: 'haar',
        label: 'The haar',
        note: 'Beneath it, a seven-strand haar strung so the green repeats down its length, each strand a little longer than the last.',
        rect: [0.24, 0.46, 0.52, 0.4],
        reviewed: true,
      },
    ],
  },

  /**
   * A pair, read across one frame: the crowns, the bells, the drops — and the pull-back shows
   * the two side by side exactly as they were photographed. The right earring is the right
   * earring; nothing is mirrored.
   */
  'emerald-tassel-earrings-t06768': {
    family: 'pair',
    image: { kind: 'local', id: 'p08-hero' },
    assertion: 'regions-of-one-photograph',
    lede: 'Two of a pair, one photograph.',
    regions: [
      {
        key: 'crowns',
        label: 'The crowns',
        note: 'One square emerald to each ear, held between diamond links, with a diamond cluster beneath.',
        rect: [0.33, 0.03, 0.35, 0.28],
        reviewed: false,
      },
      {
        key: 'bells',
        label: 'The bells',
        note: 'Each tassel hangs from a small bell of worked gold, rimmed with diamonds, so the drop swings freely.',
        rect: [0.31, 0.27, 0.39, 0.22],
        reviewed: false,
      },
      {
        key: 'drops',
        label: 'The drops',
        note: 'Fine gold chains falling to pink stones, matched drop for drop across the pair. Reference T06768 — 21K gold, 16.452 grams.',
        rect: [0.25, 0.1, 0.5, 0.6],
        reviewed: true,
      },
    ],
  },

  /**
   * The anatomy of one setting, as it was photographed. Stone, claws, halo, shank — the four
   * things a jeweller would point at with a loupe, each a rectangle of the same frame. There
   * is no loose stone and no empty seat here, because none was ever photographed.
   */
  'lavender-halo-ring-r11912': {
    family: 'setting',
    image: { kind: 'local', id: 'p09-hero' },
    assertion: 'regions-of-one-photograph',
    lede: 'Stone, claws, halo, shank.',
    regions: [
      {
        key: 'stone',
        label: 'The stone',
        note: 'One oval lavender stone, held at its four quarters and lifted clear of the halo.',
        rect: [0.34, 0.18, 0.4, 0.34],
        reviewed: false,
      },
      {
        key: 'halo',
        label: 'The halo',
        note: 'A halo of small white diamonds, set flush to the stone so the ring reads as one form.',
        rect: [0.25, 0.15, 0.5, 0.5],
        reviewed: true,
      },
      {
        key: 'shank',
        label: 'The shank',
        note: 'A split rose-gold shank, stamped 21K on the inside. Reference R11912 — 9.444 grams.',
        rect: [0.24, 0.44, 0.52, 0.46],
        reviewed: false,
      },
    ],
  },

  /**
   * The gold set from the Rang-e-Jamal campaign — the world frame `w-rang-3` is cut from the
   * same photograph Waseem publishes as this piece's own hero, so the figure and the door
   * beneath it are the same piece. 21K, 252.84 grams across the set, as published.
   */
  'gold-bridal-set-2': {
    family: 'goldwork',
    image: { kind: 'local', id: 'w-rang-3' },
    assertion: 'regions-of-one-photograph',
    lede: 'Gold, at the distance a jeweller looks from.',
    regions: [
      {
        key: 'collar',
        label: 'The collar',
        note: 'A broad collar of worked gold with pearls set along its edge, lying flat across the collarbone. Waseem publishes the set at 21K, 252.84 grams.',
        rect: [0.36, 0.5, 0.42, 0.24],
        reviewed: false,
      },
      {
        key: 'pendant',
        label: 'The pendant',
        note: 'A round medallion drops from the collar’s centre and ends in a single pearl.',
        rect: [0.44, 0.7, 0.2, 0.2],
        reviewed: false,
      },
      {
        key: 'earring',
        label: 'The earring',
        note: 'The earring repeats the collar’s work at a smaller scale, and ends in the same pearls.',
        rect: [0.54, 0.33, 0.2, 0.24],
        reviewed: false,
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

/** The slugs the homepage figures open onto — every descriptor is a door to its piece. */
export const FIGURE_SLUGS = Object.keys(SEMANTIC);

/**
 * Regions placed by looking at the photograph rather than cut and published in Stage 1.
 * They are named for Waseem to confirm — which part is the tikka, that the bells are the
 * bells — and until then they stay listed here, by name, as the open ask.
 */
export const AWAITING_REGION_SIGN_OFF = Object.entries(SEMANTIC).flatMap(([slug, d]) =>
  d.regions.filter((r) => !r.reviewed).map((r) => `${slug}:${r.key}`),
);
