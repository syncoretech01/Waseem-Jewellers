/**
 * The craft chapter's scrub progress, shared with the WebGL object (M5) without React state.
 * `stage` names the current beat so labels and the scene agree.
 */
export type CraftStage = 'assembled' | 'stone' | 'setting' | 'metal' | 'finish' | 'craft';

export const craftProgress = {
  value: 0,
  stage: 'assembled' as CraftStage,
};

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
