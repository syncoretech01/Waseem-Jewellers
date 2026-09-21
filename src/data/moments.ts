import type { ImageRef } from './types';

/**
 * The jewellery moments: four ways of looking at a piece that are not a camera moving over a
 * photograph. Each is authored against one piece Waseem publishes, and each is honest in the
 * same way the semantic figures are — nothing is shown that was not photographed.
 *
 *   bangle    one set of bangles, turned in the hand between the two angles the shop
 *             photographed: profile, surface, rhythm, inside, the complete set.
 *   light     the frame goes dark and one light finds the parts of a suite in turn, and names
 *             them, before the whole suite is lit again. The photograph never moves.
 *   parted    one photograph of a pair, cut at the joints a jeweller would name — crown, bell,
 *             tassel — and drawn apart so each part can be read on its own, then closed.
 *   journey   the goldwork, from the work to the piece: the camera opens on the pattern of one
 *             panel, travels down the piece and pulls back until the whole is in view, where
 *             a few places can be looked at more closely.
 *
 * Every rectangle, band and ellipse below is a fraction of the one frame it belongs to. The
 * captions say what is in the frame and what Waseem publishes; they never narrate a making.
 */

export interface Light {
  key: string;
  label: string;
  note: string;
  /** centre and radii of the ellipse the light makes, as fractions of the frame */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LightMoment {
  image: ImageRef;
  lede: string;
  lights: Light[];
  closing: string;
}

export interface Band {
  key: string;
  label: string;
  note: string;
  /** the band's top and bottom, as fractions of the frame's height */
  from: number;
  to: number;
}

export interface PartedMoment {
  image: ImageRef;
  lede: string;
  bands: Band[];
  closing: string;
}

export const LIGHTS: Record<string, LightMoment> = {
  'diamond-bridal-sapphire-suite': {
    image: { kind: 'local', id: 'p07-hero' },
    lede: 'One suite, in one light.',
    lights: [
      { key: 'earring', label: 'The chandelier earring', note: 'Three tiers of pavé, hung so the earring moves when the head turns.', cx: 0.4, cy: 0.52, rx: 0.08, ry: 0.13 },
      { key: 'necklace', label: 'The necklace', note: 'A line of pavé diamonds set to lie along the collarbone — graded H and VVS1, as Waseem publishes them.', cx: 0.5, cy: 0.73, rx: 0.22, ry: 0.08 },
      { key: 'pendant', label: 'The pendant', note: 'A sapphire held in a pavé surround. The suite is published at 21K, 94.68 grams, with 13.26 carats of diamonds.', cx: 0.47, cy: 0.86, rx: 0.08, ry: 0.09 },
    ],
    closing: 'Worn together, as the studio shot them.',
  },
};

export const PARTED: Record<string, PartedMoment> = {
  'emerald-tassel-earrings-t06768': {
    image: { kind: 'local', id: 'p08-hero' },
    lede: 'One pair, read at the joints.',
    bands: [
      { key: 'crown', label: 'The crown', note: 'One square emerald to each ear, held between diamond links, with a diamond cluster beneath.', from: 0.03, to: 0.26 },
      { key: 'bell', label: 'The bell', note: 'A small bell of worked gold, rimmed with diamonds, from which the tassel hangs.', from: 0.26, to: 0.43 },
      { key: 'tassel', label: 'The tassel', note: 'Fine gold chains falling to pink stones, matched drop for drop across the pair.', from: 0.43, to: 0.7 },
    ],
    closing: 'Reference T06768 — 21K, 16.452 grams, as published.',
  },
};

/** A hold of the journey's camera: where it looks and how close, as fractions of the frame and a scale. */
export interface Hold {
  key: string;
  label: string;
  note: string;
  cx: number;
  cy: number;
  scale: number;
}

/** A place on the whole piece a visitor can look at more closely — inspection, not a tooltip. */
export interface Hotspot {
  key: string;
  label: string;
  note: string;
  cx: number;
  cy: number;
  scale: number;
}

export interface JourneyMoment {
  image: ImageRef;
  lede: string;
  /** The holds in order; the last is the whole piece, where the hotspots become live. */
  holds: Hold[];
  hotspots: Hotspot[];
}

/**
 * The goldwork journey: the camera opens on the work itself — the pattern of one collar
 * panel filling the frame — travels down the piece, and pulls back until the whole haar is
 * in view. Every hold is a rectangle of one photograph at a scale its source can carry
 * (2250 px across a frame no wider than ~60vw); the captions say what is in the frame.
 */
export const JOURNEYS: Record<string, JourneyMoment> = {
  'aks-e-noor-satlada-haar': {
    image: { kind: 'local', id: 'p05-hero' },
    lede: 'Gold, from the work to the piece.',
    holds: [
      { key: 'pattern', label: 'The pattern', note: 'Filigree panels worked with one repeating motif, set flat against the collar, with drops hung along the edge.', cx: 0.5, cy: 0.55, scale: 2.6 },
      { key: 'relief', label: 'The relief', note: 'Each link of the haar is raised and chased so the light catches its edges rather than its face.', cx: 0.5, cy: 0.63, scale: 2.0 },
      { key: 'edge', label: 'The edge', note: 'The medallion at the end of the haar, bordered and finished with drops, as the piece closes.', cx: 0.5, cy: 0.8, scale: 2.2 },
      { key: 'whole', label: 'The whole piece', note: 'Collar and haar together, on velvet, as the Aks-e-Noor campaign photographed them.', cx: 0.5, cy: 0.68, scale: 1.55 },
    ],
    hotspots: [
      { key: 'collar', label: 'The collar', note: 'Filigree panels, worked flat, with drops along the edge.', cx: 0.5, cy: 0.47, scale: 2.3 },
      { key: 'links', label: 'The links', note: 'The links of the haar, chased in relief, graded to fall as one curve.', cx: 0.4, cy: 0.62, scale: 2.1 },
      { key: 'medallion', label: 'The medallion', note: 'The pendant that closes the haar, bordered and finished with drops.', cx: 0.5, cy: 0.8, scale: 2.2 },
      { key: 'drops', label: 'The drops', note: 'Hung from the edge of the collar and from the medallion, so the piece moves with the wearer.', cx: 0.6, cy: 0.52, scale: 2.4 },
    ],
  },
};

/** A hold of the bangle study's camera on one of the two angles. */
export interface BangleHold {
  key: string;
  label: string;
  note: string;
  /** which of the two photographs the camera is on */
  angle: 'profile' | 'raised';
  cx: number;
  cy: number;
  scale: number;
  /** a travel: the camera pans from `from` to (cx, cy) at the same scale while it holds */
  from?: { cx: number; cy: number };
}

export interface BangleMoment {
  profile: ImageRef;
  raised: ImageRef;
  lede: string;
  holds: BangleHold[];
}

/**
 * The bangle study: one set of bangles, the two angles the shop photographed — on its side,
 * and raised so the inside shows. The camera reads the set the way a hand turns it: the
 * profile, the surface close, the rhythm of the motif along the face, then the turn to the
 * raised angle and the inside, and the complete set. Two photographs, nothing invented.
 */
export const BANGLES: Record<string, BangleMoment> = {
  'gold-bangles-k13798': {
    profile: { kind: 'local', id: 'p11-profile' },
    raised: { kind: 'local', id: 'p11-raised' },
    lede: 'One set, turned in the hand.',
    holds: [
      { key: 'profile', label: 'The set', note: 'Bangles in 21K gold, as the shop photographed them: on their side, the pattern running across every face.', angle: 'profile', cx: 0.5, cy: 0.5, scale: 1 },
      { key: 'surface', label: 'The surface', note: 'A pierced lattice, cut through the gold so the light comes through it, worked in more than one finish.', angle: 'profile', cx: 0.4, cy: 0.5, scale: 2.4 },
      { key: 'rhythm', label: 'The rhythm', note: 'The same motif repeated along the face of each bangle, and matched from one bangle to the next.', angle: 'profile', cx: 0.6, cy: 0.5, scale: 2.4, from: { cx: 0.3, cy: 0.5 } },
      { key: 'inside', label: 'The inside', note: 'Raised, the stack shows its inside: the pierced rim, and the polished inner face that sits against the wrist.', angle: 'raised', cx: 0.5, cy: 0.3, scale: 2.0 },
      { key: 'whole', label: 'The complete set', note: 'Reference K13798 — 21K, 83.124 grams, as published.', angle: 'raised', cx: 0.5, cy: 0.5, scale: 1 },
    ],
  },
};

export const bangleFor = (slug: string) => BANGLES[slug];
export const journeyFor = (slug: string) => JOURNEYS[slug];
export const lightsFor = (slug: string) => LIGHTS[slug];
export const partedFor = (slug: string) => PARTED[slug];
