'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { voiceMeter } from '../voice/meter';
import type { ConciergeState } from '@/state/conciergeStore';
import { cn } from '@/lib/cn';

interface OrbStaticProps {
  state: ConciergeState;
  size?: number;
  className?: string;
  /** Follow the microphone / speech envelope (voice stage only). */
  live?: boolean;
}

/**
 * The CSS gem: a champagne cabochon with a specular highlight, a still bezel and a level ring.
 * State is expressed through glow, tint and breath — never through spinners.
 */
export function OrbStatic({ state, size = 56, className, live = false }: OrbStaticProps) {
  const ring = useRef<HTMLSpanElement>(null);
  const core = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ringEl = ring.current;
    const coreEl = core.current;
    if (!live || !ringEl || !coreEl) return;
    const setRing = gsap.quickSetter(ringEl, 'scale');
    const setRingOpacity = gsap.quickSetter(ringEl, 'opacity');
    const setCore = gsap.quickSetter(coreEl, 'scale');
    const tick = () => {
      const level = state === 'LISTENING' ? voiceMeter.level : state === 'SPEAKING' ? voiceMeter.speech : 0;
      setRing(1 + level * 0.9);
      setRingOpacity(0.15 + level * 0.6);
      setCore(1 + level * 0.06);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gsap.set([ringEl, coreEl], { clearProps: 'transform,opacity' });
    };
  }, [live, state]);

  return (
    <span className={cn('wj-orb relative inline-block', className)} data-state={state} style={{ width: size, height: size }} aria-hidden>
      <span ref={ring} className="wj-orb-ring absolute inset-0 rounded-full" />
      <span className="wj-orb-bezel absolute inset-0 rounded-full" />
      <span ref={core} className="wj-orb-core absolute rounded-full" style={{ inset: Math.round(size <= 64 ? size * 0.14 : size * 0.085) }}>
        <span className="wj-orb-specular absolute inset-0 rounded-full" />
        <span className="wj-orb-sweep absolute inset-0 rounded-full" />
      </span>
      <span className="wj-orb-glint absolute inset-0 rounded-full" />
    </span>
  );
}
