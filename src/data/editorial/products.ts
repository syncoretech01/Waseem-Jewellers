import type { Category, Material, SetRole, StyleTag, WorldSlug } from '../types';

/**
 * Authored copy, keyed by the shop's own product handle.
 *
 * This file is human-owned. No script writes to it. Everything here is layered on top of
 * the generated catalogue at module load in src/data/products.ts, so a re-sync can add,
 * remove or respecify products without touching a word anyone wrote.
 *
 * Hard specifications are deliberately absent: weight, purity, carat, clarity, colour and
 * the item code are re-derived from what Waseem publishes on every sync. Writing them here
 * would create a second source of truth that could quietly disagree with the first.
 *
 * What belongs here is what only a person can supply — a name worth reading, a lede, the
 * craft and care notes, the stones and techniques read off the photograph, and the
 * complementary graph.
 */
export interface ProductEditorial {
  slug?: string;
  editorialTitle?: string;
  urdu?: string;
  campaign?: string;
  world?: WorldSlug;
  category?: Category;
  subcategory?: string;
  material?: Material;
  tags?: string[];
  styleTags?: StyleTag[];
  /** Read off the photograph, not from a specification sheet. */
  stones?: string[];
  technique?: string[];
  featuredRank?: number;
  setId?: string;
  setRole?: SetRole;
  story?: { lede?: string; craft?: string; care?: string };
  media?: { hero?: string; gallery?: string[]; macro?: string; video?: string };
  complementary?: string[];
}

export const EDITORIAL: Record<string, ProductEditorial> = {
  'royal-wedding': {
    slug: 'royal-wedding-polki-raani-haar',
    editorialTitle: 'Polki Raani Haar',
    campaign: 'Royal Wedding',
    world: 'royal-wedding',
    category: 'bridal-set',
    material: 'polki',
    tags: ['polki', 'raani haar', 'choker', 'tikka', 'chandbali', 'gold', 'candlelight'],
    styleTags: ['bridal', 'traditional', 'statement'],
    stones: ['uncut diamonds (polki)', 'green stone drops'],
    technique: ['closed kundan settings'],
    featuredRank: 1,
    story: {
      lede: 'A polki choker and a long raani haar, worn together with a tikka and chandbali earrings.',
      craft: 'Uncut stones sit in closed gold settings; green drops trace the edge of the choker and the earrings answer it. The set is composed to be worn as one.',
      care: 'Store flat in its case. Keep away from perfume, water and heat.',
    },
    media: {
      hero: 'p01-hero',
      gallery: ['p01-hero', 'p01-second', 'p01-third'],
    },
    complementary: ['aks-e-noor-satlada-haar', 'emerald-tassel-earrings-t06768', 'rukh-e-jana-pleated-collar'],
  },
  'rukhe-jana': {
    slug: 'rukh-e-jana-pleated-collar',
    editorialTitle: 'Pleated Gold Collar',
    campaign: 'Rukh-e-Jana',
    world: 'rukh-e-jana',
    category: 'necklace',
    material: 'gold',
    tags: ['gold', 'collar', 'necklace', 'kundan', 'velvet', 'candlelight', 'leaf'],
    styleTags: ['bridal', 'traditional'],
    stones: ['red kundan drop'],
    technique: ['pleated gold', 'kundan setting'],
    featuredRank: 2,
    story: {
      lede: 'A collar pleated like silk, closed with a single kundan leaf.',
      craft: 'Fine gold folds run the length of the collar and catch candlelight along their edges; the leaf drop is set in a closed kundan bezel.',
      care: 'Wipe with a soft dry cloth after wear. Store separately so the pleats are not pressed.',
    },
    media: {
      hero: 'p02-hero',
      gallery: ['p02-hero', 'p02-second', 'p02-third'],
    },
    complementary: ['lavender-halo-ring-r11912', 'aks-e-noor-satlada-haar', 'royal-wedding-polki-raani-haar'],
  },
  'naqsh-e-gul': {
    slug: 'naqsh-e-gul-pearl-blossom-choker',
    editorialTitle: 'Pearl Blossom Choker',
    campaign: 'Naqsh-e-Gul',
    category: 'necklace',
    material: 'diamond',
    tags: ['diamond', 'pearl', 'choker', 'floral', 'white', 'jali', 'earrings'],
    styleTags: ['bridal', 'contemporary', 'statement'],
    stones: ['diamonds', 'pearls'],
    technique: ['pavé setting', 'floral openwork'],
    featuredRank: 3,
    story: {
      lede: 'A floral choker of white diamonds and pearls, worn against red before a lattice of light.',
      craft: 'Blossoms of pavé-set stones are linked into a collar that follows the neckline; pearls hang from the lower edge, and the earrings repeat the blossom.',
      care: 'Pearls dislike perfume and heat: put the piece on last, take it off first.',
    },
    media: {
      hero: 'p03-hero',
      gallery: ['p03-hero', 'p03-macro', 'p03-detail'],
      macro: 'p03-macro',
    },
    complementary: ['timeless-feathered-cluster-ring', 'diamond-bridal-sapphire-suite', 'emerald-tassel-earrings-t06768'],
  },
  'dewan-2': {
    slug: 'dewan-bridal-suite',
    editorialTitle: 'Bridal Suite',
    campaign: 'Dewan',
    world: 'dewan',
    category: 'bridal-set',
    material: 'gold-diamond',
    tags: ['gold', 'diamond', 'choker', 'haar', 'medallion', 'nath', 'tikka', 'lilac'],
    styleTags: ['bridal', 'statement'],
    stones: ['diamonds', 'pearls'],
    technique: ['two-tone gold', 'pavé setting'],
    featuredRank: 4,
    story: {
      lede: 'A choker, a long haar with a medallion, a nath and a tikka, worn as one suite in lilac light.',
      craft: 'Gold and diamond work alternate across the choker; the haar drops to a single medallion, and the smaller pieces echo its outline.',
      care: 'Store each piece in its own compartment. Have the clasps checked before the day.',
    },
    media: {
      hero: 'p04-hero',
      gallery: ['p04-hero', 'p04-macro', 'still-dewaan-13'],
      macro: 'p04-macro',
    },
    complementary: ['diamond-bridal-sapphire-suite', 'timeless-feathered-cluster-ring', 'lavender-halo-ring-r11912'],
  },
  'aks-e-noor-5': {
    slug: 'aks-e-noor-satlada-haar',
    editorialTitle: 'Satlada Haar',
    campaign: 'Aks-e-Noor',
    world: 'aks-e-noor',
    category: 'necklace',
    material: 'gold',
    tags: ['gold', 'satlada', 'haar', 'strands', 'filigree', 'choker', 'jali', 'velvet'],
    styleTags: ['bridal', 'traditional', 'statement'],
    stones: ['gold beads'],
    technique: ['filigree', 'beaded strands'],
    featuredRank: 5,
    story: {
      lede: 'A filigree choker above five strands of gold, worn in dark green velvet before a gold jali.',
      craft: 'The strands are graded in length so they fall as one curve; the filigree panels of the choker sit flat against the collarbone.',
      care: 'Hang the strands from their clasp when not worn. Wipe with a soft dry cloth.',
    },
    media: {
      hero: 'p05-hero',
      gallery: ['p05-hero', 'p05-macro', 'p05-second'],
      macro: 'p05-macro',
    },
    complementary: ['rukh-e-jana-pleated-collar', 'royal-wedding-polki-raani-haar', 'emerald-tassel-earrings-t06768'],
  },
  'gold-bridal-set-1': {
    slug: 'rang-e-jamal-emerald-suite',
    editorialTitle: 'Emerald & Diamond Suite',
    campaign: 'Rang-e-Jamal',
    world: 'rang-e-jamal',
    category: 'bridal-set',
    material: 'diamond',
    tags: ['emerald', 'diamond', 'choker', 'haar', 'strands', 'tikka', 'ivory'],
    styleTags: ['bridal', 'statement'],
    stones: ['emeralds', 'diamonds'],
    technique: ['pavé setting', 'multi-strand'],
    featuredRank: 6,
    story: {
      lede: 'An emerald and diamond choker with a seven-strand haar and a tikka, on ivory.',
      craft: 'Emeralds anchor the choker at intervals; the strands beneath are strung so the green repeats down the length of the haar.',
      care: 'Emeralds are softer than diamonds: avoid knocks, store apart, clean with a dry cloth only.',
    },
    media: {
      hero: 'p06-hero',
      gallery: ['p06-hero', 'p06-macro', 'p06-second'],
      macro: 'p06-macro',
    },
    complementary: ['diamond-bridal-sapphire-suite', 'emerald-tassel-earrings-t06768', 'timeless-feathered-cluster-ring'],
  },
  'diamond-bridal-set-1': {
    slug: 'diamond-bridal-sapphire-suite',
    editorialTitle: 'Sapphire Pendant Suite',
    category: 'bridal-set',
    material: 'diamond',
    tags: ['diamond', 'sapphire', 'necklace', 'pendant', 'chandelier earrings', 'white', 'ivory'],
    styleTags: ['bridal', 'contemporary'],
    stones: ['diamonds', 'sapphire'],
    featuredRank: 7,
    story: {
      lede: 'A diamond necklace closing on a single sapphire, with chandelier earrings to match.',
      craft: 'The necklace narrows toward the pendant so the sapphire carries the eye; the earrings repeat its drop at a smaller scale.',
      care: 'Store in its case. Have the settings checked once a year.',
    },
    media: {
      hero: 'p07-hero',
      gallery: ['p07-hero', 'p07-macro', 'p07-detail'],
      macro: 'p07-macro',
    },
    complementary: ['timeless-feathered-cluster-ring', 'rang-e-jamal-emerald-suite', 'naqsh-e-gul-pearl-blossom-choker'],
  },
  'gold-earings-t06768': {
    slug: 'emerald-tassel-earrings-t06768',
    editorialTitle: 'Emerald Tassel Earrings',
    category: 'earrings',
    material: 'gold-diamond',
    tags: ['earrings', 'emerald', 'diamond', 'tassel', 'gold', 'jhumki'],
    styleTags: ['bridal', 'traditional', 'everyday'],
    stones: ['emeralds', 'diamonds'],
    featuredRank: 8,
    story: {
      lede: 'Emerald and diamond drops above a gold tassel that moves as you do.',
      craft: 'Two square emeralds sit between diamond links; the tassel hangs from a small bell so it swings freely.',
      care: 'Keep the tassels straight in the case. Wipe with a soft dry cloth.',
    },
    media: {
      hero: 'p08-hero',
      gallery: ['p08-hero', 'p08-macro'],
      macro: 'p08-macro',
    },
    complementary: ['lavender-halo-ring-r11912', 'rang-e-jamal-emerald-suite', 'royal-wedding-polki-raani-haar'],
  },
  'gold-ring-r11912': {
    slug: 'lavender-halo-ring-r11912',
    editorialTitle: 'Lavender Halo Ring',
    category: 'ring',
    material: 'gold',
    tags: ['ring', 'gold', 'rose gold', 'lavender', 'halo', 'diamond'],
    styleTags: ['contemporary', 'everyday'],
    stones: ['lavender stone', 'diamonds'],
    featuredRank: 9,
    story: {
      lede: 'An oval lavender stone in a halo of small diamonds, on a rose-gold band.',
      craft: 'The halo is set flush to the stone so the ring reads as one form; the band tapers toward the back for comfort.',
      care: 'Remove before hand-washing and sport. Clean with warm water and a soft brush.',
    },
    media: {
      hero: 'p09-hero',
      gallery: ['p09-hero', 'p09-second', 'p09-macro'],
      macro: 'p09-macro',
    },
    complementary: ['emerald-tassel-earrings-t06768', 'rukh-e-jana-pleated-collar', 'timeless-feathered-cluster-ring'],
  },
  'timeless-treasure': {
    slug: 'timeless-feathered-cluster-ring',
    editorialTitle: 'Feathered Cluster Ring',
    category: 'ring',
    material: 'diamond',
    tags: ['ring', 'diamond', 'cluster', 'white gold', 'feathers'],
    styleTags: ['contemporary', 'statement'],
    stones: ['diamonds'],
    technique: ['cluster setting'],
    featuredRank: 10,
    story: {
      lede: 'A cluster of diamonds around a central stone, photographed on white feathers.',
      craft: 'The outer stones are set slightly lower than the centre so the cluster reads as one rounded form; the shank is kept plain.',
      care: 'Clean with warm water and a soft brush. Have the claws checked once a year.',
    },
    media: {
      hero: 'p10-hero',
      gallery: ['p10-hero', 'p10-macro'],
      macro: 'p10-macro',
    },
    complementary: ['lavender-halo-ring-r11912', 'naqsh-e-gul-pearl-blossom-choker', 'diamond-bridal-sapphire-suite'],
  },
};
