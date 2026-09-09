import type { Fidelity, Region, SemanticDescriptor } from './types';

/**
 * Whether a figure can be supported, and at what fidelity.
 *
 * The resolution floor is the important rule. A region is only worth travelling to if the
 * negative can carry it: holding on a 480-pixel crop of a 1080-pixel frame shows the visitor
 * the JPEG, not the jewellery, and a teaching moment that resolves to mush teaches the wrong
 * thing. So the smallest held region decides, measured in real pixels of the source.
 *
 * A family that cannot be supported does not render as a degraded family — the caller shows
 * its ordinary image instead. There is no broken lesson.
 */

/** Below this, a held region is not worth holding. */
export const REGION_FLOOR_PX = 640;
/** Below this the camera moves but does not magnify. */
export const REDUCED_CEILING_PX = 1100;

export const regionPixels = (region: Region, sourceWidth: number, sourceHeight: number) =>
  Math.min(region.rect[2] * sourceWidth, region.rect[3] * sourceHeight);

export interface ResolveInput {
  descriptor: SemanticDescriptor;
  sourceWidth: number;
  sourceHeight: number;
  /** From `gsap.matchMedia`'s `reduce` condition — the media query, never the quality store. */
  reducedMotion: boolean;
  /** LOW tier or a coarse pointer. */
  modest: boolean;
}

export interface Resolved {
  fidelity: Fidelity;
  regions: Region[];
  /** False when the caller should render its ordinary image and no figure at all. */
  supported: boolean;
}

export function resolveFigure({ descriptor, sourceWidth, sourceHeight, reducedMotion, modest }: ResolveInput): Resolved {
  const regions = descriptor.regions.filter((r) => regionPixels(r, sourceWidth, sourceHeight) >= REGION_FLOOR_PX);

  // one region is a caption, not a sequence; goldwork is the exception because its beats are
  // scales of the whole frame rather than separate places in it
  const minimum = descriptor.family === 'goldwork' ? 1 : 2;
  if (regions.length < minimum) return { fidelity: 'static', regions: descriptor.regions, supported: false };

  if (reducedMotion) return { fidelity: 'static', regions, supported: true };

  const smallest = Math.min(...regions.map((r) => regionPixels(r, sourceWidth, sourceHeight)));
  if (modest || smallest < REDUCED_CEILING_PX) return { fidelity: 'reduced', regions, supported: true };
  return { fidelity: 'full', regions, supported: true };
}

/**
 * The scroll choreography, derived rather than fitted.
 *
 * Opening hold, then travel and hold for each region, then a pull-back to the whole piece.
 * The principle that governs it: **never shorten a dwell to fit a scroll budget — drop a
 * region.** A squeezed dwell is exactly what turns teaching into spectacle.
 */
export interface Beat {
  /** Progress at which this region becomes the subject. */
  at: number;
  /** Progress at which it stops being the subject. */
  until: number;
  region: Region | null;
}

const OPENING = 0.12;
const PULL_BACK = 0.14;
const TRAVEL = 0.08;

export function beatsFor(regions: Region[]): Beat[] {
  if (regions.length === 0) return [{ at: 0, until: 1, region: null }];
  const body = 1 - OPENING - PULL_BACK;
  const per = body / regions.length;
  const beats: Beat[] = [{ at: 0, until: OPENING, region: null }];
  regions.forEach((region, i) => {
    const start = OPENING + per * i;
    beats.push({ at: start + per * TRAVEL, until: start + per, region });
  });
  beats.push({ at: 1 - PULL_BACK, until: 1, region: null });
  return beats;
}

/**
 * Kept for the day a figure earns a pin of its own. Nothing calls it: the figures read as
 * they travel through the viewport instead, which costs the page no height and cannot
 * collide with a product page's sticky column.
 */
export const pinLengthFor = (regionCount: number) => Math.min(260, Math.max(150, 60 + 45 * regionCount));
