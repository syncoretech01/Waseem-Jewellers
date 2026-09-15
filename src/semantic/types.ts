import type { ImageRef } from '@/data/types';

/**
 * The jewellery motion language.
 *
 * The discovery this is built on: Waseem's photography is **one high-resolution frame per
 * piece**. `p03-hero`, `p03-macro` and `p03-detail` are not three photographs — they are
 * three rectangles of a single 4500px source, cut by sharp at build time. So what exists is
 * one picture containing every named part as a region, and that fact decides what can
 * honestly be built and what cannot.
 *
 * **Terminology is a correctness rule here, not a style preference.** Where an interaction
 * only moves attention between regions of a finished photograph, nothing in the code, the
 * copy, the labels or the docs may describe it as how the piece was *constructed* or
 * *assembled*. It is composition, not process. Construction language is reserved for the day
 * genuine process imagery exists — a band before its stone, an empty setting — and none does.
 *
 * Five families survive that test, and all five are the same mechanism — attention travelling
 * to named rectangles of one photograph and holding there — differing only in what the
 * rectangles are and what may be said while looking:
 *
 *   goldwork      a scale ladder over one photograph: surface, then relief, then the
 *                 filigree. It claims nothing except "this is the same picture, closer",
 *                 which is why it needs the fewest authored words, and why it can run on the
 *                 ~550 images that clear 2200px.
 *   craft-detail  attention travelling to named regions of one frame and holding there.
 *                 Every region is a rectangle a person chose and a person reviewed.
 *   composition   the same mechanism at the scale of a suite — the parts named in place.
 *                 It says what is *in* the frame; it never claims the parts were
 *                 photographed apart.
 *   setting       the anatomy of one setting as it was photographed: the stone, the claws
 *                 that hold it, the halo around it, the shank beneath. It names what a
 *                 jeweller would point at with a loupe. It never shows a loose stone or an
 *                 empty seat, because none was ever photographed.
 *   pair          the two of a pair, named across one frame — crowns, bells, drops — with the
 *                 pull-back showing them side by side as they were shot. Never a mirrored
 *                 half: the right earring in the frame is the right earring.
 *
 * Deliberately not built: ring anatomy from teardown photography (none exists), layering
 * compositors, loose-stone setting sequences. All three would require showing the jewellery
 * in states it was never photographed in, which means inventing physical construction.
 */
export type FamilyId = 'goldwork' | 'craft-detail' | 'composition' | 'setting' | 'pair';

/**
 * What the figure is allowed to claim about its own source.
 *
 * `regions-of-one-photograph` is the only assertion any family here makes, and it is
 * literally true: the rectangles are fractions of the frame being shown.
 */
export type Assertion = 'regions-of-one-photograph';

export interface Region {
  key: string;
  /** Required. A region with no name teaches nothing. */
  label: string;
  /**
   * Required on any region the family holds on. This is the caption test: every beat is a
   * plain fact about the piece, or the beat is cut.
   */
  note: string;
  /** [x, y, w, h] as fractions of the one source frame. */
  rect: [number, number, number, number];
  /**
   * True where the rectangle is one Stage 1 already cut, published and reviewed as its own
   * image. Those need nothing from anyone. A region authored fresh is a new claim about
   * which part of a piece is which, and waits for Waseem to confirm it.
   */
  reviewed: boolean;
}

export interface SemanticDescriptor {
  family: FamilyId;
  /** The single frame every region is a rectangle of. */
  image: ImageRef;
  regions: Region[];
  assertion: Assertion;
  /** The opening line, if the figure carries one. */
  lede?: string;
}

/**
 * How much of the family runs.
 *
 * `static` is not a failure state: it is the captioned sequence, and it has to teach on its
 * own. If the lesson only exists in the movement, the movement was spectacle.
 */
export type Fidelity = 'full' | 'reduced' | 'static';
