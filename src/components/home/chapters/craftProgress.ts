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

/**
 * The pre-rendered sequence: the same object, from the same scene at the highest tier, cut
 * once by scripts/assets/craft-frames.mjs at each of these progress values and shown where
 * the live object is not mounted (every phone, no WebGL, a context lost twice). The frames
 * sample the live object's own choreography — the stone lifting through .12–.30, the bezel
 * dropping through .30–.48, the band through .48–.64, the turn and the polish through
 * .64–.82, the return and the pull back through .82–1 — densely enough that a crossfade
 * between neighbours reads as the part moving, not as two prints of it. Six frames at the
 * centre of each beat were tried first: a dissolve across a whole beat showed two stones,
 * or two bands, at once for most of the scroll. Frame i is `ring-f{i}-{640,1080,1600}w.webp`;
 * the whole 1080w set is ~1.1 MB (23 frames on transparent ground, ~47 KB each).
 * `key` names the beat the frame closes, for the harness and for the reader; the crossfade
 * from frame i−1 to frame i runs from `max(p[i−1], window(p[i]).from)` to `p[i]`, so the
 * object holds still exactly where the live one does (the assembled hold, 0–.12).
 */
export const CRAFT_FRAMES: { key: CraftStage; p: number }[] = [
  { key: 'assembled', p: 0.06 },
  { key: 'stone', p: 0.18 },
  { key: 'stone', p: 0.24 },
  { key: 'stone', p: 0.3 },
  { key: 'setting', p: 0.39 },
  { key: 'setting', p: 0.48 },
  { key: 'metal', p: 0.52 },
  { key: 'metal', p: 0.56 },
  { key: 'metal', p: 0.6 },
  { key: 'metal', p: 0.64 },
  { key: 'finish', p: 0.685 },
  { key: 'finish', p: 0.73 },
  { key: 'finish', p: 0.775 },
  { key: 'finish', p: 0.82 },
  // the close moves everything at once — the parts return, the object pulls back and rises —
  // so it is sampled twice as densely as the beats before it
  { key: 'craft', p: 0.84 },
  { key: 'craft', p: 0.86 },
  { key: 'craft', p: 0.88 },
  { key: 'craft', p: 0.9 },
  { key: 'craft', p: 0.92 },
  { key: 'craft', p: 0.94 },
  { key: 'craft', p: 0.96 },
  { key: 'craft', p: 0.98 },
  { key: 'craft', p: 1 },
];

/** The frames' natural size (one crop box for all of them), from the last run of craft-frames.mjs. */
export const CRAFT_FRAME_SIZE = { width: 1620, height: 2132 };

/** The window a frame closes: the one whose span ends at or after `p` and begins before it. */
function windowClosing(p: number): { from: number; to: number } {
  return CRAFT_WINDOWS.find((w) => w.from < p && p <= w.to) ?? { from: 0.82, to: 1 };
}

/**
 * When each frame takes over from the one before it: frame i fades in, and frame i−1 out,
 * between `from` and `to`. The first frame has no fade; it stands from the start.
 */
export function craftFrameFades(): { from: number; to: number }[] {
  return CRAFT_FRAMES.map((f, i) => {
    const before = CRAFT_FRAMES[i - 1];
    if (!before) return { from: 0, to: 0 };
    return { from: Math.max(before.p, windowClosing(f.p).from), to: f.p };
  });
}
