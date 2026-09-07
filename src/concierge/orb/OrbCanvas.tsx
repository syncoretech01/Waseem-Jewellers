'use client';

import { OrbStatic } from './OrbStatic';
import type { ConciergeState } from '@/state/conciergeStore';

/**
 * M5 replaces this with the shader-driven liquid-metal orb (sphereGeometry, simplex
 * displacement, champagne matcap). Until then the voice stage uses the live CSS gem.
 */
export function OrbCanvas({ state, size }: { state: ConciergeState; size: number }) {
  return <OrbStatic state={state} size={size} live />;
}
