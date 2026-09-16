/**
 * The data contract every route, chapter, store and concierge tool depends on.
 *
 * Three rules govern this file:
 *
 *   Absence is a value. Every fact Waseem does not publish is `undefined`, never a
 *   default, a zero or an em dash. 656 products carry real gaps and the site must be able
 *   to render them as gaps rather than filling them in.
 *
 *   Generated and authored data never share a file. src/data/generated/* is machine-owned
 *   and clobbered on every sync; src/data/editorial/* is human-owned and never touched by
 *   a script. They merge at module load in src/data/products.ts.
 *
 *   A photograph is either ours or theirs. The flagship set is localised into
 *   public/assets and committed; the long tail is resized by next/image from the shop's
 *   CDN. `ImageRef` is the one place that difference lives.
 */

export type Department = 'gold' | 'diamond' | 'bridal' | 'men' | 'kids';

export type Material = 'gold' | 'diamond' | 'polki' | 'gold-diamond';

export type Category =
  | 'bridal-set'
  | 'necklace'
  | 'earrings'
  | 'ring'
  | 'bracelet'
  | 'bangle'
  | 'pendant'
  | 'chain'
  | 'nose-pin'
  | 'cufflink'
  | 'tikka'
  | 'nath';

export type Gender = 'women' | 'men' | 'kids' | 'unisex';
export type MetalColour = 'yellow' | 'white' | 'rose' | 'two-tone';
export type StyleTag = 'bridal' | 'traditional' | 'contemporary' | 'statement' | 'everyday';
export type Occasion = 'wedding' | 'mehndi' | 'baraat' | 'walima' | 'engagement' | 'everyday' | 'gift';
export type Availability = 'in-showroom' | 'made-to-order' | 'archive';
export type SetRole = 'choker' | 'haar' | 'earrings' | 'tikka' | 'nath' | 'ring' | 'bangle';
export type Karat = '18K' | '21K' | '22K' | '24K';
export type WorldSlug = 'rukh-e-jana' | 'aks-e-noor' | 'rang-e-jamal' | 'dewan' | 'royal-wedding';
export type AssetRole = 'packshot' | 'macro' | 'campaign' | 'world' | 'heritage' | 'brand' | 'still' | 'poster';
export type MediaRole = 'campaign' | 'packshot' | 'macro' | 'detail' | 'worn' | 'still';

/**
 * Where a fact came from, so a reviewer can tell a published figure from an authored one.
 * Nothing is ever `inferred` — a value we could not read is simply absent.
 */
export type SpecSource = 'shopify-field' | 'parsed-body' | 'curated';

/**
 * `asOf` exists because gold moves daily. A snapshot price presented as authoritative
 * months later is a commercial risk, not just stale data.
 */
export type Price = { kind: 'onRequest' } | { kind: 'fixed'; pkr: number; asOf: string };

/** A local id in the generated asset map, or a source the image optimiser resizes for us. */
export type ImageRef =
  | { kind: 'local'; id: string }
  | { kind: 'remote'; src: string; width: number; height: number };

export interface Stone {
  kind: string;
  count?: number;
  carat?: number;
  /** As published — 'G&H', 'H'. Never mapped onto a grading scale nobody stated. */
  colour?: string;
  clarity?: string;
  cut?: string;
}

export interface Specification {
  purity?: Karat;
  metalColour?: MetalColour;
  alloy?: string[];
  grossWeightGrams?: number;
  netWeightGrams?: number;
  stones?: Stone[];
  diamondColour?: string;
  diamondClarity?: string;
  diamondCarat?: number;
  technique?: string[];
  size?: string;
  dimensions?: { length?: number; width?: number; height?: number; unit: 'mm' };
}

export interface ProductImage {
  ref: ImageRef;
  role: MediaRole;
  order: number;
  alt: string;
  /** True when the alt was generated from the taxonomy rather than written by a person. */
  altDerived?: boolean;
  caption?: string;
}

export interface ProductMedia {
  hero: ProductImage;
  gallery: ProductImage[];
  video?: string;
}

/** What the site knows about a piece, and therefore how far it can be trusted to lead. */
export interface Completeness {
  tier: 'flagship' | 'catalogue' | 'thin';
  hasSpec: boolean;
  hasReference: boolean;
  hasEditorial: boolean;
  imageCount: number;
  maxImageWidth: number;
  gaps: string[];
}

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
  /** AV1 siblings, offered first; a browser that cannot decode them never fetches them. Absent until encoded. */
  src1280Av1?: string;
  src720Av1?: string;
  srcPortraitAv1?: string;
  poster: string;
  posterBlur: string;
  width: number;
  height: number;
  duration: number;
  subject: [number, number];
  label: string;
}

export interface ProductStory {
  lede: string;
  craft: string;
  care: string;
}

export interface Product {
  id: string;
  slug: string;
  /** The shop's own handle. The join key the editorial layer and every re-sync use. */
  sourceHandle: string;
  /** Item Code / Jewellery Code, where Waseem publishes one. */
  reference?: string;
  sku?: string;

  /** As published, title-cased. */
  title: string;
  /** Authored. Absent on the great majority; fall back to `title`. */
  editorialTitle?: string;
  urdu?: string;

  /** At least one. A gold bridal set is genuinely in both. */
  departments: Department[];
  /** Absent when the shop does not publish one — never guessed from a photograph. */
  category?: Category;
  subcategory?: string;
  gender: Gender;
  material?: Material;
  tags: string[];
  styleTags: StyleTag[];
  occasions: Occasion[];
  /** The campaign line a piece was photographed for, e.g. 'Aks-e-Noor'. */
  campaign?: string;
  campaignSlug?: string;
  world?: WorldSlug;
  setId?: string;
  setRole?: SetRole;

  spec: Specification;
  provenance: Partial<Record<keyof Specification, SpecSource>>;
  price: Price;
  availability?: Availability;

  media: ProductMedia;
  /** Authored. ~646 products have none, and the page must read well without it. */
  story?: ProductStory;
  complementary: string[];
  featuredRank?: number;

  /**
   * Whether a visitor may meet this piece, and why not. Importing and listing are separate
   * decisions: everything is imported so the data is whole and the audit can speak to it,
   * but a piece is only shown when it can be filed and named honestly.
   */
  listable: boolean;
  withheld: string[];
  completeness: Completeness;
  source: { handle: string; url: string; syncedAt: string; note?: string };
}

export interface CollectionWorld {
  slug: WorldSlug;
  name: string;
  urdu?: string;
  mood: string;
  palette: { bg: string; accent: string };
  /** `piece` is the frame of the jewellery itself (a macro where one exists); `hero` is the portrait the collection page opens on, so the FLIP lands on the same photograph. */
  imagery: { column: [string, string, string]; hero: string; piece: string; pieceFocus?: string };
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
  /**
   * Free-form, not a closed union. A closed union meant that adding a menu entry required
   * editing a component; a department is data, and the menu should be able to gain one.
   */
  id: string;
  label: string;
  numeral: string;
  kind: 'route' | 'chapter' | 'modal';
  target: string;
  /**
   * Optional, because Waseem has campaign photography for some departments and not others.
   * An entry with no still shows the ambient scene rather than a photograph of the wrong
   * kind of jewellery.
   */
  media: { still?: string; video?: string };
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
