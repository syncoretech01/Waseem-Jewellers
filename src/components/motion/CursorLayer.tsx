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
 * A 7px champagne bead with bare caption labels beside it. No glow, no specular, no blend
 * modes. Fine pointers only; never a dependency (every target is a real control).
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
    let visible = false;
    let flipped = false;
    // GSAP owns both offsets entirely (Tailwind's `translate` would fight its transform)
    gsap.set(bead.current, { xPercent: -50, yPercent: -50 });
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
        className="absolute left-0 top-0 h-[7px] w-[7px] rounded-full opacity-0 will-change-transform"
        style={{
          background: 'radial-gradient(circle at 50% 38%, #f1e2bf 0%, #d8c3a5 58%, #b8975a 100%)',
          boxShadow: '0 0 0 0.5px rgb(11 10 9 / 0.35)',
        }}
      />
      <div
        ref={label}
        className="micro absolute left-0 top-0 whitespace-nowrap text-champagne opacity-0"
        style={{ textShadow: '0 1px 3px rgb(11 10 9 / 0.6)' }}
      >
        {text}
      </div>
    </div>
  );
}
