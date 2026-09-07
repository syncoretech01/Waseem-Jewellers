'use client';

import dynamic from 'next/dynamic';
import { useQualityStore } from '@/state/qualityStore';
import { OrbStatic } from './OrbStatic';
import type { ConciergeState } from '@/state/conciergeStore';

const OrbCanvas = dynamic(() => import('./OrbCanvas').then((m) => m.OrbCanvas), { ssr: false, loading: () => null });

interface OrbProps {
  state: ConciergeState;
  size: number;
  /** Voice stage: the WebGL liquid-metal orb where the tier allows; the CSS gem elsewhere. */
  stage?: boolean;
  className?: string;
}

export function Orb({ state, size, stage = false, className }: OrbProps) {
  const renderer = useQualityStore((s) => s.orbRenderer);
  if (stage && renderer === 'webgl') {
    return (
      <span className={className} style={{ width: size, height: size, display: 'inline-block', position: 'relative' }} aria-hidden>
        <OrbCanvas state={state} size={size} />
      </span>
    );
  }
  return <OrbStatic state={state} size={size} live={stage} className={className} />;
}

export function preloadOrbCanvas() {
  void import('./OrbCanvas');
}
