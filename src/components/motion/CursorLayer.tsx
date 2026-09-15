'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { COPY } from '@/data/copy';

/**
 * The cursor's vocabulary — every state a target can put it in, and the word for each.
 *
 * The words come from the copy file so they can be reviewed with the rest of the customer-
 * facing text. A target picks a state with `data-cursor="<state>"`; `data-cursor-text`
 * overrides the word where a control's own label is the truer one (the microphone while it
 * is listening says what it will do next).
 */
export type CursorState = keyof typeof COPY.cursor;

const LABELS: Record<string, string> = COPY.cursor;

/** States whose target is an act of moving something rather than opening it. */
const HELD_STATES = new Set<string>(['drag']);

/**
 * A fine-pointer cursor: a small bead, a hairline ring when it is over something it can act
 * on, and a word beside it only while it is. It never grows, never springs, never follows
 * with a lag the hand can feel. Colours come from the theme tokens, so it is ink on the
 * paper chapters and ivory on the dark ones without a shadow to keep it legible.
 *
 * It is decoration for a mouse and never a dependency: every target it labels is a real
 * control. Touch, pen, a coarse pointer and reduced motion all keep the native cursor —
 * on a hybrid device the bead steps aside the moment a finger or pen is used, and returns
 * with the mouse.
 */
export function CursorLayer() {
  const coarse = useQualityStore((s) => s.coarse);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const detected = useQualityStore((s) => s.detected);
  const bead = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const enabled = detected && !coarse && !reduced;

  useEffect(() => {
    if (!enabled || !bead.current || !label.current) return;
    const html = document.documentElement;
    const beadEl = bead.current;
    const labelEl = label.current;
    const bx = gsap.quickTo(beadEl, 'x', { duration: 0.1, ease: 'power3' });
    const by = gsap.quickTo(beadEl, 'y', { duration: 0.1, ease: 'power3' });
    const lx = gsap.quickTo(labelEl, 'x', { duration: 0.18, ease: 'power3' });
    const ly = gsap.quickTo(labelEl, 'y', { duration: 0.18, ease: 'power3' });
    let visible = false;
    let flipped = false;
    let native = false;
    // GSAP owns both offsets entirely (Tailwind's `translate` would fight its transform)
    gsap.set(beadEl, { xPercent: -50, yPercent: -50 });
    gsap.set(labelEl, { xPercent: 0, yPercent: -50 });

    const takeOver = () => {
      if (!native) return;
      native = false;
      html.classList.add('has-cursor');
    };
    const standAside = () => {
      native = true;
      html.classList.remove('has-cursor');
      hide();
    };
    const show = () => {
      if (visible) return;
      visible = true;
      gsap.to(beadEl, { opacity: 1, duration: 0.25 });
    };
    const hide = () => {
      visible = false;
      gsap.to([beadEl, labelEl], { opacity: 0, duration: 0.2 });
    };

    html.classList.add('has-cursor');

    // a route change removes the element that was hovered; the word must not outlive it
    const unsubscribe = useSiteStore.subscribe((now, prev) => {
      if (now.navEpoch === prev.navEpoch) return;
      setState(null);
      setText(null);
      setHeld(false);
    });

    const onMove = (e: PointerEvent) => {
      // a finger or a pen on a hybrid device: the native pointer is the right one
      if (e.pointerType !== 'mouse') {
        standAside();
        return;
      }
      takeOver();
      bx(e.clientX);
      by(e.clientY);
      const flip = e.clientX > window.innerWidth - 160;
      if (flip !== flipped) {
        flipped = flip;
        gsap.set(labelEl, { xPercent: flip ? -100 : 0 });
      }
      lx(e.clientX + (flip ? -16 : 16));
      ly(e.clientY);
      show();
    };
    const targetOf = (e: Event) => (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor], input, textarea, select, iframe') ?? null;
    const onOver = (e: Event) => {
      const t = targetOf(e);
      if (!t) {
        setState(null);
        setText(null);
        return;
      }
      if (t.matches('input, textarea, select, iframe')) {
        // text fields keep the I-beam; a frame keeps whatever it draws
        setState(null);
        setText(null);
        html.classList.remove('has-cursor');
        return;
      }
      if (!native) html.classList.add('has-cursor');
      const key = t.dataset.cursor ?? '';
      setState(key || null);
      setText(t.dataset.cursorText ?? LABELS[key] ?? null);
    };
    const onOut = (e: Event) => {
      const t = targetOf(e);
      if (t && !(e as PointerEvent).relatedTarget) {
        setState(null);
        setText(null);
      }
      if (t?.matches('input, textarea, select, iframe') && !native) html.classList.add('has-cursor');
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]');
      if (t && HELD_STATES.has(t.dataset.cursor ?? '')) setHeld(true);
    };
    const onUp = () => setHeld(false);
    const onLeave = () => hide();
    const onVis = () => {
      if (document.visibilityState !== 'visible') hide();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      unsubscribe();
      html.classList.remove('has-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      for (const q of [bx, by, lx, ly]) q.tween.kill();
    };
  }, [enabled]);

  // the word appears only while over a target, and never while the hand is holding something
  useEffect(() => {
    if (!label.current) return;
    gsap.to(label.current, { opacity: text && !held ? 1 : 0, duration: 0.2 });
  }, [text, held]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-cursor)' }} data-cursor-state={state ?? ''} data-cursor-held={held ? '1' : '0'}>
      {/* the bead: a dot at rest, a hairline ring over a control, a larger ring while dragging */}
      <div ref={bead} className="wj-cursor absolute left-0 top-0 opacity-0 will-change-transform" data-on={state ? '1' : '0'} data-held={held ? '1' : '0'} />
      <div ref={label} className="wj-cursor-label micro absolute left-0 top-0 whitespace-nowrap opacity-0">
        {text}
      </div>
    </div>
  );
}
