import type { FlipKey } from '@/state/runtime';

export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The destination frame a FLIP clone flies to before the destination has mounted.
 * Destinations size their hero box with the same rules, and `ready()` absorbs any
 * residual delta against the real element.
 */
export function getFlipFrame(key: FlipKey, vw = window.innerWidth, vh = window.innerHeight): Frame {
  const mobile = vw < 768;
  if (key === 'collection-hero') {
    return mobile
      ? { left: vw * 0.11, top: vh * 0.15, width: vw * 0.78, height: vh * 0.7 }
      : { left: vw * 0.19, top: vh * 0.09, width: vw * 0.62, height: vh * 0.82 };
  }
  const gutter = Math.min(72, Math.max(20, vw * 0.04));
  const navH = 72;
  if (mobile) {
    const width = vw;
    return { left: 0, top: navH + 16, width, height: Math.min(width * 1.25, vh * 0.72) };
  }
  const grid = vw - gutter * 2;
  const share = vw >= 1280 ? 0.62 : 0.55;
  const width = (grid - gutter) * share;
  return { left: gutter, top: navH + 32, width, height: Math.min(width * 1.25, vh) };
}
