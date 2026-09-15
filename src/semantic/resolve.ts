import type { Fidelity, Region, SemanticDescriptor } from './types';

/**
 * Whether a figure can be supported, and at what fidelity — and how close the camera may go.
 *
 * The resolution rule is the important one, and it is display-relative rather than a fixed
 * number. A region is worth travelling to when the negative can carry it *at the size it
 * will be shown*: magnifying until one source pixel is stretched across two screen pixels
 * shows the visitor the JPEG, not the jewellery, and a teaching moment that resolves to mush
 * teaches the wrong thing. So the camera's scale for every region is capped by
 * `honestScale` — the point at which the region's source pixels equal the pixels it is
 * displayed across — and a region that could not be magnified at all is dropped rather
 * than held on.
 *
 * A family that cannot be supported does not render as a degraded family — the caller shows
 * its ordinary image instead. There is no broken lesson.
 */

/** Below this many source pixels on its shorter side, a region is a caption, not a hold. */
export const REGION_FLOOR_PX = 420;
/** The camera never goes closer than this, whatever the negative could carry. */
export const MAX_SCALE = 3.2;
/** Assumed until the host has measured its own box. */
export const DEFAULT_DISPLAY_PX = 720;

export const regionPixels = (region: Region, sourceWidth: number, sourceHeight: number) =>
  Math.min(region.rect[2] * sourceWidth, region.rect[3] * sourceHeight);

/**
 * The scale at which a region fills the box — or, if the negative runs out first, the scale
 * at which its source pixels equal the screen pixels they are shown across. Never more than
 * `MAX_SCALE`, never less than 1.
 *
 * `displayPx` is the box's rendered width in CSS pixels. The source has `sourceWidth` pixels
 * across the same box at scale 1, so the honest ceiling is simply their ratio.
 */
export function honestScale(region: Region, sourceWidth: number, displayPx: number): number {
  const [, , rw, rh] = region.rect;
  const fill = 1 / Math.max(rw, rh);
  const negative = sourceWidth / Math.max(1, displayPx);
  return Math.max(1, Math.min(MAX_SCALE, fill, negative));
}

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
  /**
   * `reduced` is the camera moving without magnifying far: the tier or the pointer says the
   * device would rather not composite a 3× photograph every frame. The honest ceiling still
   * applies on top of it, so neither fidelity ever shows a source pixel twice.
   */
  if (modest) return { fidelity: 'reduced', regions, supported: true };
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
 * The scroll a figure deserves when a chapter drives it from its own pin: enough for every
 * hold to be read, in viewport-heights. Chapters use it to size their pins rather than
 * fitting the figure to whatever was left.
 */
export const pinLengthFor = (regionCount: number) => Math.min(260, Math.max(150, 60 + 45 * regionCount));
