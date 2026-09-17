'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import type { ConciergeState } from '@/state/conciergeStore';
import { OrbCrest } from './OrbCrest';
import { cn } from '@/lib/cn';

interface OrbProps {
  state: ConciergeState;
  className?: string;
}

/**
 * The trigger: Waseem's crest on a small disc, one hairline ring, a soft inner shade. No
 * sphere, no glow, no canvas. The chapter's theme decides the colours through the `.wj-orb`
 * custom properties in globals.css — champagne on ink for the dark chapters, ink on pearl for
 * the ivory ones — and every state is a change to the ring (its colour, a light travelling it,
 * a pulse) or a trace drawn round the crest's outline. The mark itself never changes shape or
 * size.
 *
 * Writers: the stylesheet's keyframes and transitions own the ring and the trace; this
 * component's one GSAP timeline owns the specular band alone — its opacity and the gradient's
 * transform — because a `gradientTransform` cannot be keyframed from a stylesheet. It runs once
 * per hover, the way the ritual runs it once per load, and never under `html[data-rm="1"]`.
 */
export function Orb({ state, className }: OrbProps) {
  const root = useRef<HTMLSpanElement>(null);
  const hovered = state === 'HOVER';

  useEffect(() => {
    const el = root.current;
    if (!hovered || !el || document.documentElement.hasAttribute('data-rm')) return;
    const band = el.querySelector<SVGPathElement>('[data-mark="crest-specular"]');
    const gradient = el.querySelector<SVGElement>('[data-mark="specular"]');
    if (!band || !gradient) return;
    // how bright the light may get is the theme's decision: a band through champagne can be
    // near white, a band through ink must stay a glint
    const peak = parseFloat(getComputedStyle(el).getPropertyValue('--orb-sweep')) || 0.8;
    const tl = gsap.timeline();
    tl.fromTo(gradient, { attr: { gradientTransform: 'translate(-1.2 0)' } }, { attr: { gradientTransform: 'translate(1.2 0)' }, duration: 1.1, ease: 'power2.inOut' }, 0.05)
      .to(band, { opacity: peak, duration: 0.3, ease: 'none' }, 0.05)
      .to(band, { opacity: 0, duration: 0.35, ease: 'none' }, 0.85);
    return () => {
      tl.kill();
      gsap.set(band, { clearProps: 'opacity' });
    };
  }, [hovered]);

  return (
    <span ref={root} className={cn('wj-orb', className)} data-state={state} aria-hidden>
      <span className="wj-orb-disc" />
      <svg viewBox="0 0 56 56" className="wj-orb-ring" focusable="false">
        <circle cx="28" cy="28" r="27.5" className="wj-orb-ring-line" vectorEffect="non-scaling-stroke" />
        <circle cx="28" cy="28" r="27.5" className="wj-orb-ring-light" pathLength={100} strokeDasharray="14 86" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <OrbCrest className="wj-orb-mark" />
    </span>
  );
}

/**
 * The trigger has no canvas to warm any more. The hero and closing invitations still call this
 * on pointer-enter, so it stays as a no-op rather than making two other files change for it.
 */
export function preloadOrbCanvas() {
  // nothing to preload: the sphere renderer is gone
}
