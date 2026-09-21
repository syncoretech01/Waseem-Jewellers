'use client';

import { useLayoutEffect } from 'react';
import { useQualityStore } from '@/state/qualityStore';

/**
 * Resolves the quality tier in the first layout effect of the page, before any chapter's.
 *
 * React runs layout effects in tree order — a sibling that comes first runs its layout effect
 * before the subtree after it runs any of its own — and `useGSAP` builds its timelines in a
 * layout effect. Rendered before the routed page, this component's effect therefore runs
 * before any chapter's `useGSAP`, so the store's tier is known by the time the first
 * ScrollTrigger is created, the first video chooses its file and the first figure decides
 * its fidelity. `QualityDetector` (`src/state/trackers.tsx`) still owns the reduced-motion
 * listener and the frame-rate monitor; its own `detect()` call finds the work already done.
 *
 * The first render is still tier-neutral: the tier is written to the store, never read
 * during hydration, so server and client markup agree.
 */
export function TierResolver() {
  useLayoutEffect(() => {
    useQualityStore.getState().detect();
  }, []);
  return null;
}
