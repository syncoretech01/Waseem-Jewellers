'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useQualityStore } from '@/state/qualityStore';

const LABELS: Record<string, string> = {
  view: 'View',
  'view-piece': 'View piece',
  explore: 'Explore',
  drag: 'Drag',
  play: 'Play',
  pause: 'Pause',
  discover: 'Discover',
  inspect: 'Inspect',
  ask: 'Ask',
  save: 'Save',
  close: 'Close',
};

/**
 * A 9px metallic bead whose specular highlight follows the pointer's velocity, with bare
 * caption labels beside it. Fine pointers only; never a dependency (every target is a real control).
 */
export function CursorLayer() {
  const coarse = useQualityStore((s) => s.coarse);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const detected = useQualityStore((s) => s.detected);
  const bead = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string | null>(null);
  const enabled = detected && !coarse && !reduced;

  useEffect(() => {
    if (!enabled || !bead.current || !label.current) return;
    const html = document.documentElement;
    html.classList.add('has-cursor');
    const bx = gsap.quickTo(bead.current, 'x', { duration: 0.12, ease: 'power3' });
    const by = gsap.quickTo(bead.current, 'y', { duration: 0.12, ease: 'power3' });
    const lx = gsap.quickTo(label.current, 'x', { duration: 0.25, ease: 'power3' });
    const ly = gsap.quickTo(label.current, 'y', { duration: 0.25, ease: 'power3' });
    const angle = gsap.quickTo(bead.current, '--angle', { duration: 0.4, ease: 'power2' });
    let last = { x: 0, y: 0 };
    let visible = false;
    let flipped = false;
    // GSAP owns the label's offset entirely (Tailwind's `translate` would fight it)
    gsap.set(label.current, { xPercent: 0, yPercent: -50 });
    const show = () => {
      if (visible) return;
      visible = true;
      gsap.to(bead.current, { opacity: 1, duration: 0.3 });
    };
    const hide = () => {
      visible = false;
      gsap.to([bead.current, label.current], { opacity: 0, duration: 0.25 });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      bx(e.clientX);
      by(e.clientY);
      const flip = e.clientX > window.innerWidth - 140;
      if (flip !== flipped) {
        flipped = flip;
        gsap.set(label.current, { xPercent: flip ? -100 : 0 });
      }
      lx(e.clientX + (flip ? -14 : 14));
      ly(e.clientY);
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (Math.hypot(dx, dy) > 2) angle((Math.atan2(dy, dx) * 180) / Math.PI);
      last = { x: e.clientX, y: e.clientY };
      show();
    };
    const onOver = (e: Event) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor], input, textarea, select, iframe');
      if (!t) {
        setText(null);
        return;
      }
      if (t.matches('input, textarea, select, iframe')) {
        setText(null);
        html.classList.remove('has-cursor');
        return;
      }
      html.classList.add('has-cursor');
      const key = t.dataset.cursor ?? '';
      setText(t.dataset.cursorText ?? LABELS[key] ?? null);
    };
    const onOut = (e: Event) => {
      const t = (e.target as HTMLElement | null)?.closest('[data-cursor], input, textarea, select, iframe');
      if (t && !(e as PointerEvent).relatedTarget) setText(null);
      if (t?.matches('input, textarea, select, iframe')) html.classList.add('has-cursor');
    };
    const onLeave = () => hide();
    const onVis = () => {
      if (document.visibilityState !== 'visible') hide();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      html.classList.remove('has-cursor');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);

  useEffect(() => {
    if (!label.current) return;
    gsap.to(label.current, { opacity: text ? 1 : 0, duration: 0.25 });
  }, [text]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-cursor)' }}>
      <div
        ref={bead}
        className="absolute left-0 top-0 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 will-change-transform"
        style={{
          ['--angle' as string]: '0',
          background: 'radial-gradient(circle at 35% 30%, #fbf3e0 0%, #e4cfa3 28%, #a8894f 62%, #5a4520 100%)',
          boxShadow: '0 0 0 0.5px rgba(228,207,163,0.55), 0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from calc(var(--angle) * 1deg), rgba(255,255,255,0.55) 0deg, transparent 70deg, transparent 290deg, rgba(255,255,255,0.35) 360deg)',
            mixBlendMode: 'screen',
          }}
        />
      </div>
      <div ref={label} className="micro absolute left-0 top-0 whitespace-nowrap text-champagne opacity-0 mix-blend-difference">
        {text}
      </div>
    </div>
  );
}
