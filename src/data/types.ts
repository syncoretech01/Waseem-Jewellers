/**
 * The data contract every route, chapter, store and concierge tool depends on.
 * Content is authored by hand in src/data/*.ts; asset entries come from the
 * generated asset map. Nothing here contains a file path.
 */

export type Material = 'gold' | 'diamond' | 'polki' | 'gold-diamond';
export type Category = 'bridal-set' | 'necklace' | 'earrings' | 'ring' | 'bracelet' | 'bangle';
export type StyleTag = 'bridal' | 'traditional' | 'contemporary' | 'statement' | 'everyday';
export type Karat = '18K' | '21K' | '22K';
export type WorldSlug = 'rukh-e-jana' | 'aks-e-noor' | 'rang-e-jamal' | 'dewan' | 'royal-wedding';
export type AssetRole = 'packshot' | 'macro' | 'campaign' | 'world' | 'heritage' | 'brand' | 'still' | 'poster';

export type Price = { kind: 'onRequest' } | { kind: 'fixed'; pkr: number };

export interface ImageAsset {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  blurDataURL: string;
  focal: [number, number];
  role: AssetRole;
  maxDisplayWidth: number;
}

export interface VideoAsset {
  id: string;
  src1280: string;
  src720: string;
  srcPortrait: string;
  poster: string;
  posterBlur: string;
  width: number;
  height: number;
  duration: number;
  subject: [number, number];
  label: string;
}

export interface ProductMetadata {
  karat?: Karat;
  grossWeightGrams?: number;
  diamondColour?: string;
  clarity?: string;
  carat?: number;
  itemCode?: string;
  stones?: string[];
  technique?: string[];
}

export interface ProductStory {
  lede: string;
  craft: string;
  care: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  editorialTitle: string;
  house?: string;
  collection: 'bridal';
  world?: WorldSlug;
  category: Category;
  material: Material;
  tags: string[];
  styleTags: StyleTag[];
  metadata: ProductMetadata;
  price: Price;
  media: {
    hero: string;
    gallery: string[];
    macro?: string;
    campaign?: string;
  };
  story: ProductStory;
  complementary: [string, string, string];
  featuredRank: number;
  source: { handle: string; url: string; note?: string };
}

export interface CollectionWorld {
  slug: WorldSlug;
  name: string;
  urdu?: string;
  mood: string;
  palette: { bg: string; accent: string };
  imagery: { column: [string, string, string]; hero: string };
  href: string;
  pieces: string[];
  numeral: string;
}

export type StoryBlock =
  | { kind: 'solo'; piece: string; scale: 'full' | 'wide'; caption?: string }
  | { kind: 'duet'; pieces: [string, string]; offset: 'left' | 'right' }
  | { kind: 'interlude'; lines: string[]; image?: string; video?: string; urdu?: string; theme?: 'dark' | 'ivory' };

export interface CollectionChapter {
  id: string;
  numeral: string;
  title: string;
  theme: 'dark' | 'ivory';
  blocks: StoryBlock[];
}

export interface Collection {
  slug: string;
  name: string;
  urdu?: string;
  tagline: string;
  intro: string[];
  opening: { video?: string; still: string };
  pieces: string[];
  chapters: CollectionChapter[];
  edits: { gold: string[]; diamond: string[] };
  wornTogether: string[];
}

export interface HeritageMoment {
  id: string;
  numeral: string;
  line: string;
  fact?: string;
  image: string;
  treatment: 'monochrome-to-colour' | 'mounted';
  ratio: '4:5' | '3:2' | '1:1' | '21:9';
  parallax: number;
  caption?: string;
}

export interface MenuItem {
  id: 'gold' | 'diamond' | 'bridal' | 'collections' | 'bespoke' | 'house';
  label: string;
  numeral: string;
  kind: 'route' | 'chapter' | 'modal';
  target: string;
  media: { still: string; video?: string };
  line: string;
}

export interface Showroom {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
}

export interface SiteInfo {
  name: string;
  since: 1952;
  founder: string;
  successor: string;
  showrooms: Showroom[];
  hours: string;
  phone: string;
  whatsapp: string;
  whatsappHref: string;
  email: string;
  socials: { label: string; href: string }[];
}
