'use client';

import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';

/**
 * The frame-rate sampler that acts early, and never takes it back.
 *
 * `detectQuality` picks a tier before anything renders, from what the device *says* it is —
 * GPU strings, core counts, memory. That is a guess about capability, and it says nothing
 * about a laptop on battery with forty tabs open. This is the other half: what the page is
 * *actually* achieving, measured on the same ticker that drives every tween, so the sample is
 * the animation's own heartbeat rather than a parallel loop that costs a frame to run.
 *
 * Two readings demote, and either is enough:
 *
 *  - **two consecutive seconds** under the floor — 50 fps on a coarse pointer, 48 on a fine one.
 *    The floor is scaled to 80 % of the display's own rate, measured over seconds in which
 *    nothing scrolled, so a 30 Hz screen is not demoted for being one;
 *  - **three stalls** — frames of 120 ms or longer — inside any three-second window. A visitor who
 *    has watched the page catch three times in three seconds has already seen it stutter; the
 *    monitor does not wait for an average to confirm it.
 *
 * Frames are counted per wall-clock second, not averaged over a ring, so one long frame — the
 * craft object's shader compile, a large decode — cannot drag a whole window under the floor
 * by itself. A second that was mostly one stall is the stall's business, not the average's.
 *
 * The step is one tier: HIGH → MEDIUM → LOW → the still (WebGL withheld, so the craft chapter
 * shows its prerendered object). Once per session, never back up — a page that promotes itself
 * the moment it recovers oscillates, and the visitor sees the site change its mind. REDUCED is
 * a preference the visitor set, never a place to be demoted to.
 *
 * Held off where a low reading would be true and irrelevant: during the loading ritual, while
 * a route transition is in flight (`html.is-transitioning`), for a second after any
 * `ScrollTrigger.refresh()` — refresh measures the whole document synchronously and the frame
 * that contains it is always long — and while the document is hidden.
 *
 * Not drei's `PerformanceMonitor`, which sees only R3F frames. This page's cost is overwhelmingly
 * DOM and compositing, and the object it would be watching is the smallest part of it.
 */

const FLOOR_FINE = 48;
const FLOOR_COARSE = 50;
/** A second is judged against 80 % of the display's own rate. */
const FLOOR_OF_DISPLAY = 0.8;
const LOW_SECONDS = 2;
const STALL_MS = 120;
const STALLS_TO_DEMOTE = 3;
const STALL_WINDOW_MS = 3000;
const REFRESH_HOLD_MS = 1000;
/** The first moments after a hold lifts are settling, not evidence. */
const SETTLE_MS = 700;

export interface FpsSample {
  fps: number;
  longTasks: number;
}

let installed = false;

export function installFpsMonitor(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;

  let heldUntil = 0;
  let demoted = false;
  let longTasks = 0;
  // per-second counting
  let secondStart = 0;
  let framesThisSecond = 0;
  let longestThisSecond = 0;
  let scrollAtSecondStart = 0;
  let lowSeconds = 0;
  /** The best second the display has shown while nothing scrolled: its own refresh rate. */
  let displayRate = 0;
  const history: number[] = [];
  // stalls: timestamps of frames at or over STALL_MS
  const stalls: number[] = [];
  let wasHeld = true;
  let releasedAt = 0;

  const onRefresh = () => {
    heldUntil = performance.now() + REFRESH_HOLD_MS;
  };
  ScrollTrigger.addEventListener('refresh', onRefresh);

  /**
   * Long tasks are counted for the dev inspector; they do not demote by themselves — a frame
   * that ran long is already a stall above, and a task that ran long between frames is not
   * something the visitor watched.
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

  const isHeld = () =>
    !useSiteStore.getState().loaderDone || performance.now() < heldUntil || document.documentElement.classList.contains('is-transitioning') || document.hidden;

  const act = (fps: number) => {
    const quality = useQualityStore.getState();
    demoted = true;
    if (quality.tier === 'HIGH') quality.demote('MEDIUM', fps);
    else if (quality.tier === 'MEDIUM') quality.demote('LOW', fps);
    else if (quality.tier === 'LOW') quality.demoteToStill(fps);
  };

  const beginSecond = (now: number) => {
    secondStart = now;
    framesThisSecond = 0;
    longestThisSecond = 0;
    scrollAtSecondStart = window.scrollY;
  };

  const tick = (_time: number, deltaTime: number) => {
    if (demoted) return;
    const now = performance.now();

    const held = isHeld();
    if (held) {
      wasHeld = true;
      secondStart = 0;
      lowSeconds = 0;
      stalls.length = 0;
      return;
    }
    if (wasHeld) {
      wasHeld = false;
      releasedAt = now;
    }
    if (now - releasedAt < SETTLE_MS) return;

    // stalls: the visitor saw this frame hang
    if (deltaTime >= STALL_MS) {
      stalls.push(now);
      while (stalls.length && now - stalls[0]! > STALL_WINDOW_MS) stalls.shift();
      if (stalls.length >= STALLS_TO_DEMOTE) {
        act(Math.round(1000 / deltaTime));
        return;
      }
    }

    // frames per wall-clock second
    if (!secondStart) beginSecond(now);
    framesThisSecond++;
    longestThisSecond = Math.max(longestThisSecond, deltaTime);
    const elapsed = now - secondStart;
    if (elapsed < 1000) return;
    const fps = Math.round((framesThisSecond * 1000) / elapsed);
    const idle = window.scrollY === scrollAtSecondStart;
    // a second that was mostly one long frame is a stall, counted above, not a rate
    const stalled = longestThisSecond >= elapsed * 0.5;
    beginSecond(now);
    history.push(fps);
    if (history.length > 30) history.shift();
    if (idle && !stalled) displayRate = Math.max(displayRate, fps);
    current = { fps, longTasks };
    if (stalled) return;

    const coarse = useQualityStore.getState().coarse;
    const floor = Math.min(coarse ? FLOOR_COARSE : FLOOR_FINE, Math.round((displayRate || 60) * FLOOR_OF_DISPLAY));
    if (fps >= floor) {
      lowSeconds = 0;
      return;
    }
    lowSeconds++;
    if (lowSeconds >= LOW_SECONDS) act(fps);
  };

  gsap.ticker.add(tick);

  // readable from a QA build, so the demotion can be proven in a browser rather than trusted
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_QA_TIER_OVERRIDE === '1') {
    (window as unknown as { __wjFps?: () => FpsSample & { held: boolean; demoted: boolean; displayRate: number; history: number[]; stalls: number } }).__wjFps = () => ({
      ...current,
      held: isHeld(),
      demoted,
      displayRate,
      history: [...history],
      stalls: stalls.length,
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

/** The latest reading, for the dev inspector. Zero until the first full second has been counted. */
export const fpsSample = (): FpsSample => current;
