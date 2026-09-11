'use client';

import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';

/**
 * The frame-rate sampler that acts, once, and never takes it back.
 *
 * `QualityDetector` picks a tier before anything renders, from what the device *says* it is —
 * GPU strings, core counts, memory. That is a guess about capability, and it says nothing
 * about a laptop on battery with forty tabs open. This is the other half: what the page is
 * *actually* achieving, measured on the same ticker that drives every tween, so the sample is
 * the animation's own heartbeat rather than a parallel loop that costs a frame to run.
 *
 * Three consecutive seconds under 45 frames a second demotes the tier one step. Once per
 * session, never back up — a page that promotes itself the moment it recovers oscillates,
 * and the visitor sees the site change its mind. The demotion cascades through the store the
 * way a detected tier does: DPR cap, refraction bounces, video variant, the craft object.
 *
 * It is held off where a low reading would be true and irrelevant: during the loading ritual,
 * while a route transition is in flight (`html.is-transitioning`), and for 800 ms after any
 * `ScrollTrigger.refresh()` — the one place a stale-clock trap actually lives, because refresh
 * measures the whole document synchronously and the frame that contains it is always long.
 *
 * Not drei's `PerformanceMonitor`, which sees only R3F frames. This page's cost is overwhelmingly
 * DOM and compositing, and the object it would be watching is the smallest part of it.
 */

const RING = 120;
const LOW_FPS = 45;
const LOW_SECONDS = 3;
const REFRESH_HOLD_MS = 800;

/** The step down. REDUCED is a preference the visitor set, never a place to be demoted to. */
const DEMOTE: Record<string, 'MEDIUM' | 'LOW' | null> = { HIGH: 'MEDIUM', MEDIUM: 'LOW', LOW: null, REDUCED: null };

export interface FpsSample {
  fps: number;
  longTasks: number;
}

let installed = false;

export function installFpsMonitor(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;

  const frames = new Float32Array(RING);
  let head = 0;
  let filled = 0;
  let lowSince: number | null = null;
  let heldUntil = 0;
  let demoted = false;
  let longTasks = 0;

  const onRefresh = () => {
    heldUntil = performance.now() + REFRESH_HOLD_MS;
  };
  ScrollTrigger.addEventListener('refresh', onRefresh);

  /**
   * Long tasks are counted but do not by themselves demote: one 200 ms task while an image
   * decodes is not a slow machine. They are exposed for the dev inspector and they make a low
   * FPS reading harder to dismiss as a measurement artefact.
   */
  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      longTasks += list.getEntries().length;
    });
    observer.observe({ type: 'longtask', buffered: false });
  } catch {
    observer = null;
  }

  const tick = (_time: number, deltaTime: number) => {
    // ring buffer of frame durations, in ms
    frames[head] = deltaTime;
    head = (head + 1) % RING;
    if (filled < RING) filled++;

    const now = performance.now();
    const site = useSiteStore.getState();
    const quality = useQualityStore.getState();

    // a low reading that would be true and irrelevant
    const held = !site.loaderDone || now < heldUntil || document.documentElement.classList.contains('is-transitioning') || document.hidden;
    if (held || demoted || filled < RING) {
      lowSince = null;
      return;
    }

    let sum = 0;
    for (let i = 0; i < RING; i++) sum += frames[i]!;
    const fps = 1000 / (sum / RING);
    current = { fps, longTasks };

    if (fps >= LOW_FPS) {
      lowSince = null;
      return;
    }
    if (lowSince === null) {
      lowSince = now;
      return;
    }
    if (now - lowSince < LOW_SECONDS * 1000) return;

    const next = DEMOTE[quality.tier];
    if (!next) {
      demoted = true;
      return;
    }
    demoted = true;
    quality.demote(next, Math.round(fps));
  };

  gsap.ticker.add(tick);

  // readable from a QA build, so the demotion can be proven in a browser rather than trusted
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_QA_TIER_OVERRIDE === '1') {
    (window as unknown as { __wjFps?: () => FpsSample & { held: boolean; filled: number; demoted: boolean } }).__wjFps = () => ({
      ...current,
      held: !useSiteStore.getState().loaderDone || performance.now() < heldUntil || document.documentElement.classList.contains('is-transitioning') || document.hidden,
      filled,
      demoted,
    });
  }

  return () => {
    gsap.ticker.remove(tick);
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    observer?.disconnect();
    installed = false;
  };
}

let current: FpsSample = { fps: 0, longTasks: 0 };

/** The latest reading, for the dev inspector. Zero until the ring has filled once. */
export const fpsSample = (): FpsSample => current;
