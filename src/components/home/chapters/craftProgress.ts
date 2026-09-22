/**
 * The craft chapter's scrub progress, shared with the WebGL object (M5) without React state.
 * `stage` names the current beat so labels and the scene agree.
 */
export type CraftStage = 'assembled' | 'stone' | 'setting' | 'metal' | 'finish' | 'craft';

/**
 * A pose of the object, in the scene's own units (CraftScene's damped targets): how far the
 * stone is lifted, the bezel and the band dropped, the claws eased, the polish, the pull back
 * of the close, and the object's turn about its axis (the total, rest angle excluded). Set only
 * by scripts/assets/craft-frames.mjs through the development handle below while it renders
 * the states; `null` on every visitor's page, where the scroll's progress poses the object.
 */
export interface CraftPose {
  lift: number;
  bezelDrop: number;
  bandDrop: number;
  claw: number;
  finish: number;
  pull: number;
  spin: number;
}

export const craftProgress = {
  value: 0,
  stage: 'assembled' as CraftStage,
  pose: null as CraftPose | null,
};

// the render script poses the object through this handle; a production page has no handle
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as unknown as { __wjCraft?: typeof craftProgress }).__wjCraft = craftProgress;
}

export const CRAFT_WINDOWS: { stage: CraftStage; from: number; to: number }[] = [
  { stage: 'assembled', from: 0, to: 0.12 },
  { stage: 'stone', from: 0.12, to: 0.3 },
  { stage: 'setting', from: 0.3, to: 0.48 },
  { stage: 'metal', from: 0.48, to: 0.64 },
  { stage: 'finish', from: 0.64, to: 0.82 },
  { stage: 'craft', from: 0.82, to: 1 },
];

export function stageAt(p: number): CraftStage {
  for (const w of CRAFT_WINDOWS) if (p < w.to) return w.stage;
  return 'craft';
}

/**
 * The pre-rendered layers: the same object, from the same scene at the highest tier, cut once
 * by scripts/assets/craft-frames.mjs — the stone, the setting (bezel and claws) and the band
 * (band, gallery, shoulders) each rendered alone at rest, plus the whole ring polished — on one
 * crop box, from one camera at one angle — and shown wherever the live object is not mounted:
 * every phone, a browser without WebGL, a context lost twice. A beat moves a layer by a
 * transform (the stone lifts, the setting drops, the band falls away) and the finish dissolves
 * the three layers into the polished whole (src/styles/craft.css); the compositor runs all of
 * it, and nothing is ever drawn twice.
 *
 * Why layers and not a scrubbed sequence (22 Sep 2026): the twenty-three frames that stood here
 * were sampled from the desktop choreography, in which the object also turns some sixty
 * degrees across the chapter; every crossfade between neighbours therefore dissolved two
 * whole rings at different angles, and on a phone — where the scrub's 0.6 s lag left the
 * dissolve sitting at its midpoint after every thumb — the visitor saw two bands, two stones
 * and two bezels, brightened by the additive blend, and a band edge that strobed under a slow
 * drag. Measured on the live build at 390×844 and 430×932 (.cache/s22/craft2/repro). Five
 * whole-ring stills from a fixed camera were tried next: the band and the parts that stayed put
 * were the same pixels in every one and summed cleanly, but the part that moved was still two
 * parts for the length of the dissolve — a second band beneath the first as the metal beat
 * came in. So the parts are layers, and a beat moves them.
 *
 * Each pose is CraftScene's own vocabulary; the parts that are not the layer's are posed far
 * out of the frame (six units, three crops away; the bezel fourteen, since the claws follow it
 * at half its drop). `spin` is 0: the poster's own angle, so the
 * still and the layers hand over without a turn.
 */
export const CRAFT_LAYERS: { key: CraftLayer; pose: CraftPose }[] = [
  // the band, the gallery and the shoulders: the stone and the setting posed out of the frame
  { key: 'band', pose: { lift: 6, bezelDrop: 14, bandDrop: 0, claw: 0, finish: 0, pull: 0, spin: 0 } },
  // the closed bezel and its four claws
  { key: 'setting', pose: { lift: 6, bezelDrop: 0, bandDrop: 6, claw: 0, finish: 0, pull: 0, spin: 0 } },
  // the emerald, in its seat
  { key: 'stone', pose: { lift: 0, bezelDrop: 14, bandDrop: 6, claw: 0, finish: 0, pull: 0, spin: 0 } },
  // the whole ring, hand finished: the polish, the claws eased, the light up
  { key: 'polished', pose: { lift: 0, bezelDrop: 0, bandDrop: 0, claw: 1, finish: 1, pull: 0, spin: 0 } },
];

export type CraftLayer = 'band' | 'setting' | 'stone' | 'polished';

/** The layers a beat needs on the stage before it can be shown. */
export function layersFor(stage: CraftStage): CraftLayer[] {
  return stage === 'finish' || stage === 'craft' ? ['polished'] : ['band', 'setting', 'stone'];
}

/** The layers' natural size (one crop box for all of them), from the last run of craft-frames.mjs. */
export const CRAFT_FRAME_SIZE = { width: 1266, height: 1632 };
