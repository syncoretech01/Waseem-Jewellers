import type { ImageRef } from './types';

/**
 * The jewellery moments: four ways of looking at a piece that are not a camera moving over a
 * photograph. Each is authored against one piece Waseem publishes, and each is honest in the
 * same way the semantic figures are — nothing is shown that was not photographed.
 *
 *   study     a drawing of the piece, derived from its own photograph, becomes the photograph;
 *             then the piece turns between two angles Waseem actually shot.
 *   light     the frame goes dark and one light finds the parts of a suite in turn, and names
 *             them, before the whole suite is lit again. The photograph never moves.
 *   parted    one photograph of a pair, cut at the joints a jeweller would name — crown, bell,
 *             tassel — and drawn apart so each part can be read on its own, then closed.
 *
 * Every rectangle, band and ellipse below is a fraction of the one frame it belongs to. The
 * captions say what is in the frame and what Waseem publishes; they never narrate a making.
 */

export interface StudyMoment {
  /** The angle the drawing is traced from, and the photograph it becomes. */
  hero: ImageRef;
  /** A second angle of the same piece, as shot — the turn ends on it. */
  second: ImageRef;
  /** The drawing: a pencil pass over the hero, rendered by scripts/assets/sketch.mjs. */
  sketch: { dir: string; widths: number[]; alt: string };
  beats: { drawn: string; made: string; turned: string };
}

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

export const STUDY: Record<string, StudyMoment> = {
  'lavender-halo-ring-r11912': {
    hero: { kind: 'local', id: 'p09-hero' },
    second: { kind: 'local', id: 'p09-second' },
    sketch: { dir: '/assets/waseem/images/products/lavender-halo-ring-r11912', widths: [640, 1080, 1600], alt: 'The lavender halo ring, drawn' },
    beats: {
      drawn: 'Drawn first: the oval stone, the halo, the split shank.',
      made: 'Then made — in rose gold, stamped 21K on the inside. Reference R11912, 9.444 grams.',
      turned: 'And seen from above: the halo of small white diamonds, and the four claws that hold the stone clear of it.',
    },
  },
};

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

export const studyFor = (slug: string) => STUDY[slug];
export const lightsFor = (slug: string) => LIGHTS[slug];
export const partedFor = (slug: string) => PARTED[slug];
