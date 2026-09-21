'use client';

import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useFlipNavigate } from '@/motion/hooks/useFlipNavigate';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Img } from '@/components/media/Img';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { bindPointer, pointer } from '@/lib/motion/pointer';
import { COPY } from '@/data/copy';
import type { PieceRow } from '@/lib/facets';
import { cn } from '@/lib/cn';

/**
 * CH03 — the gate: two material worlds in one frame.
 *
 * Gold beneath — the satlada haar on velvet, gold looked at closely — and diamond above it
 * behind a mask whose edge follows the pointer and breathes at rest: the sapphire pendant and
 * its pavé, closer still, under a light that crosses it. The two words weigh with their side.
 * Choosing one lets that material fill the frame and carries the visitor into its department.
 * No face in either world: the gate is jewellery. (The studio film is not used here — its only
 * jewellery-only stretch is under three seconds, and the rest of it is the model's face.)
 *
 * On a phone the split is horizontal and follows the scroll through the chapter — the
 * visitor's thumb is the pointer. Under reduced motion the frame is held at the middle and
 * the two sides are simply two doors. The concierge can open the gate on one side: asked for
 * gold from another page, it sets the store's gate, brings the visitor here, and the chapter
 * opens with that side forward.
 */
export function Ch03Gate({ goldPiece, diamondPiece }: { goldPiece?: PieceRow; diamondPiece?: PieceRow }) {
  const { ref } = useChapter({ id: 'gate', theme: 'dark' });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const go = useFlipNavigate();
  const bias = useSiteStore((s) => s.gate);
  const setGate = useSiteStore((s) => s.setGate);
  const split = useRef({ pointer: 0.5, breath: 0, committed: false });
  const breathTween = useRef<gsap.core.Tween | null>(null);
  // on screen or not: the ticker writes nothing, and the breath rests, while the gate is away
  const live = useRef(false);

  // the ticker is the only writer of the mask, the divider and the words' weight
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const diamond = root.querySelector<HTMLElement>('.gate-diamond');
    const divider = root.querySelector<HTMLElement>('.gate-divider');
    const gold = root.querySelector<HTMLElement>('.gate-word-gold');
    const dia = root.querySelector<HTMLElement>('.gate-word-diamond');
    const goldNote = root.querySelector<HTMLElement>('.gate-note-gold');
    const diaNote = root.querySelector<HTMLElement>('.gate-note-diamond');
    if (!diamond || !divider || !gold || !dia) return;
    const s = split.current;
    const vertical = coarse || window.innerWidth < 768;
    if (reduced) {
      // held at the middle: two doors, no mask in motion
      diamond.style.clipPath = vertical ? 'inset(50% 0 0 0)' : 'inset(0 0 0 50%)';
      divider.style.transform = vertical ? `translate3d(0, ${(0.5 * root.clientHeight).toFixed(1)}px, 0)` : `translate3d(${(0.5 * root.clientWidth).toFixed(1)}px, 0, 0)`;
      return;
    }
    /**
     * The mask is a clip-path and the divider a transform, so a frame of the breath costs no
     * layout; the words' weight is written only when it changes by a step, because a variable
     * font setting re-shapes the text and that is layout. Nothing is written when the split
     * has not moved.
     */
    let box = { w: root.clientWidth, h: root.clientHeight };
    const onResize = () => (box = { w: root.clientWidth, h: root.clientHeight });
    window.addEventListener('resize', onResize, { passive: true });
    let lastV = -1;
    let lastStep = -1;
    const apply = () => {
      const v = Math.max(0.06, Math.min(0.94, s.pointer + s.breath));
      if (Math.abs(v - lastV) < 0.0004) return;
      lastV = v;
      const pct = (v * 100).toFixed(2);
      if (vertical) {
        diamond.style.clipPath = `inset(${pct}% 0 0 0)`;
        divider.style.transform = `translate3d(0, ${(v * box.h).toFixed(1)}px, 0)`;
      } else {
        diamond.style.clipPath = `inset(0 0 0 ${pct}%)`;
        divider.style.transform = `translate3d(${(v * box.w).toFixed(1)}px, 0, 0)`;
      }
      const g = 1 - v;
      const step = Math.round(g * 40);
      if (step !== lastStep) {
        lastStep = step;
        gold.style.fontVariationSettings = `"opsz" 96, "wght" ${Math.round(400 + 180 * g)}`;
        dia.style.fontVariationSettings = `"opsz" 96, "wght" ${Math.round(400 + 180 * v)}`;
      }
      gold.style.transform = `scale(${(1 + 0.06 * g).toFixed(3)})`;
      dia.style.transform = `scale(${(1 + 0.06 * v).toFixed(3)})`;
      if (goldNote) goldNote.style.opacity = (0.4 + 0.6 * g).toFixed(3);
      if (diaNote) diaNote.style.opacity = (0.4 + 0.6 * v).toFixed(3);
    };
    breathTween.current = gsap.to(s, { breath: 0.025, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1, onStart: () => (s.breath = -0.025) });
    const pointerTo = gsap.quickTo(s, 'pointer', { duration: 0.9, ease: 'power3' });
    // arriving with a material already in mind: open with that side forward
    if (bias) pointerTo(bias === 'gold' ? 0.8 : 0.2);
    bindPointer();
    /**
     * The handle: the visitor's own control of the split, by drag on any pointer and by the
     * arrow keys. Only the handle takes touch — the page beneath scrolls as it always does —
     * and while a drag is held the breath rests and the hover follow stands aside.
     */
    const handle = root.querySelector<HTMLElement>('.gate-handle');
    let dragging = false;
    const fractionAt = (x: number, y: number) => {
      const r = root.getBoundingClientRect();
      const f = vertical ? (y - r.top) / r.height : (x - r.left) / r.width;
      return Math.max(0.14, Math.min(0.86, f));
    };
    const say = (f: number) => {
      handle?.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      handle?.setAttribute('aria-valuetext', `${Math.round(f * 100)}% diamond, ${Math.round((1 - f) * 100)}% gold`);
    };
    const onDown = (e: PointerEvent) => {
      if (s.committed) return;
      dragging = true;
      handle?.setPointerCapture(e.pointerId);
      handle?.setAttribute('data-held', '1');
      breathTween.current?.pause();
      pointerTo(fractionAt(e.clientX, e.clientY));
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const f = fractionAt(e.clientX, e.clientY);
      pointerTo(f);
      say(f);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      handle?.releasePointerCapture(e.pointerId);
      handle?.removeAttribute('data-held');
      if (live.current) breathTween.current?.play();
    };
    const onKey = (e: KeyboardEvent) => {
      if (s.committed) return;
      const step = e.shiftKey ? 0.15 : 0.05;
      let f: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') f = Math.min(0.86, s.pointer + step);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') f = Math.max(0.14, s.pointer - step);
      if (e.key === 'Home') f = 0.14;
      if (e.key === 'End') f = 0.86;
      if (f === null) return;
      e.preventDefault();
      pointerTo(f);
      say(f);
    };
    handle?.addEventListener('pointerdown', onDown);
    handle?.addEventListener('pointermove', onMove);
    handle?.addEventListener('pointerup', onUp);
    handle?.addEventListener('pointercancel', onUp);
    handle?.addEventListener('keydown', onKey);
    say(s.pointer);
    const tick = () => {
      if (!live.current) return;
      if (!s.committed && !dragging && !vertical && pointer.active && pointer.fine) {
        const r = root.getBoundingClientRect();
        if (pointer.y >= r.top && pointer.y <= r.bottom) pointerTo(Math.max(0.14, Math.min(0.86, pointer.x / window.innerWidth)));
      }
      apply();
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
      handle?.removeEventListener('pointerdown', onDown);
      handle?.removeEventListener('pointermove', onMove);
      handle?.removeEventListener('pointerup', onUp);
      handle?.removeEventListener('pointercancel', onUp);
      handle?.removeEventListener('keydown', onKey);
      breathTween.current?.kill();
      pointerTo.tween.kill();
    };
  }, [ref, reduced, coarse, bias]);

  // the gate is live only while it is on screen; on a phone the split is the visitor's, by the handle — never the page's scroll
  useGSAP(
    () => {
      const root = ref.current;
      if (!root || reduced) return;
      // the diamond's drift and light, the ticker and the breath run only while the gate is on screen
      ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (st) => {
          live.current = st.isActive;
          root.toggleAttribute('data-live', st.isActive);
          if (st.isActive) breathTween.current?.play();
          else breathTween.current?.pause();
        },
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  const choose = (side: 'gold' | 'diamond') => {
    const root = ref.current;
    if (!root) return;
    const s = split.current;
    if (s.committed) return;
    s.committed = true;
    breathTween.current?.kill();
    gsap.to(s, { breath: 0, duration: 0.3 });
    setGate(side);
    const word = root.querySelector<HTMLElement>(side === 'gold' ? '.gate-word-gold' : '.gate-word-diamond');
    const other = root.querySelector<HTMLElement>(side === 'gold' ? '.gate-side-diamond' : '.gate-side-gold');
    // the chosen material fills the frame; its word lifts; the curtain carries the visitor on
    gsap.to(s, { pointer: side === 'gold' ? 1 : 0, duration: 0.9, ease: 'power3.inOut' });
    if (word) gsap.to(word.parentElement, { scale: 1.3, opacity: 0, duration: 0.8, ease: 'power3.in' });
    if (other) gsap.to(other, { opacity: 0, duration: 0.4 });
    window.setTimeout(() => go(`/${side}`), 420);
  };

  const credit = (row: PieceRow | undefined, cls: string) =>
    row ? (
      <TransitionLink href={`/jewellery/${row.s}`} className={cn('micro mt-3 inline-flex items-baseline gap-2 text-ivory/60 transition-colors hover:text-ivory', cls)} data-cursor="view" onClick={(e) => e.stopPropagation()}>
        <span>{COPY.gate.inFrame}</span>
        <span className="font-display normal-case tracking-normal text-[0.9375rem] text-ivory/85" style={{ fontVariationSettings: '"opsz" 14' }}>
          {row.t}
        </span>
      </TransitionLink>
    ) : null;

  return (
    <section ref={ref} id="ch03-gate" className="relative h-[100svh] overflow-hidden bg-ink text-ivory md:h-[105svh]" aria-labelledby="gate-title">
      <h2 id="gate-title" className="sr-only">
        {COPY.gate.heading}
      </h2>

      {/* gold, beneath */}
      <div className="gate-gold absolute inset-0">
        {/* on a phone the frame is tall and narrow: the haar is kept to the right so the words stand on velvet */}
        <Img id="p05-macro" sizes="100vw" plain className="h-full w-full object-cover" style={{ objectPosition: 'var(--gate-gold-pos, 50% 45%)' }} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-ink/35 max-md:bg-[linear-gradient(to_bottom,rgb(0_0_0/0.4)_0%,transparent_18%,rgb(0_0_0/0.55)_42%,rgb(0_0_0/0.6)_50%,rgb(0_0_0/0.6)_100%)]" />
      </div>
      {/* diamond, above, behind the mask */}
      <div className="gate-diamond absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
        <Img id="p07-macro" sizes="100vw" plain className="gate-drift h-full w-full object-cover" style={{ objectPosition: 'var(--gate-diamond-pos, 50% 45%)' }} />
        <div className="gate-light pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-ink/35 max-md:bg-[linear-gradient(to_bottom,transparent_48%,rgb(0_0_0/0.5)_56%,rgb(0_0_0/0.15)_78%,rgb(0_0_0/0.6)_100%)]" />
      </div>
      {/* the divider sits at the frame's origin and is moved by transform alone; the handle rides on it and is the one thing here that takes touch */}
      <div className="gate-divider pointer-events-none absolute left-0 top-0 z-20 h-full w-px bg-gold-hi/80 will-change-transform max-md:h-px max-md:w-full" style={{ transform: 'translate3d(50vw, 0, 0)' }}>
        <div
          className="gate-handle group/handle pointer-events-auto absolute left-1/2 top-1/2 z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full outline-none max-md:cursor-ns-resize"
          role="slider"
          tabIndex={reduced ? -1 : 0}
          aria-label={COPY.gate.handle}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          aria-orientation={coarse ? 'vertical' : 'horizontal'}
          data-cursor="drag"
        >
          {/* a small disc on the hairline, with the two chevrons of a thing that moves both ways */}
          <span className="gate-handle-disc flex h-7 w-7 items-center justify-center rounded-full border border-gold-hi/80 bg-ink/70 text-champagne shadow-[0_2px_12px_rgb(0_0_0/0.45)] backdrop-blur-[2px] transition-transform duration-300 group-hover/handle:scale-110 group-focus-visible/handle:scale-110 group-data-[held=1]/handle:scale-110">
            <svg viewBox="0 0 20 20" className="h-3 w-3 max-md:rotate-90" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 5 3 10l4 5M13 5l4 5-4 5" />
            </svg>
          </span>
        </div>
      </div>

      {/* the eyebrow, beneath the nav band */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-gutter pt-[calc(var(--nav-h)+1.25rem)]">
        <p className="micro text-champagne">{COPY.gate.eyebrow}</p>
        <p className="micro hidden text-ivory/50 md:block">{COPY.gate.hint}</p>
      </div>

      <div className="absolute inset-0 grid grid-rows-2 md:grid-cols-2 md:grid-rows-1">
        <div className="gate-side-gold flex flex-col items-start justify-end p-gutter text-left [text-shadow:0_1px_2px_rgb(0_0_0/0.45),0_0_28px_rgb(0_0_0/0.4)] md:justify-start md:pl-[7vw] md:pt-[22svh]">
          <button
            type="button"
            onClick={() => choose('gold')}
            onFocus={() => !split.current.committed && gsap.to(split.current, { pointer: 0.72, duration: 0.8 })}
            className="group/side flex flex-col items-start text-left"
            data-cursor="explore"
            aria-label={COPY.gate.gold.aria}
          >
            <span className="block origin-left">
              <span className="gate-word-gold display block text-[clamp(3rem,8.5vw,9.5rem)] leading-none text-ivory" style={{ fontVariationSettings: '"opsz" 96, "wght" 490' }}>
                {COPY.gate.gold.word}
              </span>
            </span>
            <span className="gate-note-gold micro mt-4 max-w-[22em] text-champagne">{COPY.gate.gold.line}</span>
            <span className="micro mt-5 text-ivory/70 underline-offset-4 transition-colors group-hover/side:text-ivory group-hover/side:underline">{COPY.gate.gold.cta}</span>
          </button>
          {credit(goldPiece, 'md:mt-6')}
        </div>
        <div className="gate-side-diamond flex flex-col items-end justify-start p-gutter text-right [text-shadow:0_1px_2px_rgb(0_0_0/0.45),0_0_28px_rgb(0_0_0/0.4)] md:justify-end md:pb-[14svh] md:pr-[7vw]">
          <button
            type="button"
            onClick={() => choose('diamond')}
            onFocus={() => !split.current.committed && gsap.to(split.current, { pointer: 0.28, duration: 0.8 })}
            className="group/side flex flex-col items-end text-right"
            data-cursor="explore"
            aria-label={COPY.gate.diamond.aria}
          >
            <span className="block origin-right">
              <span className="gate-word-diamond display block text-[clamp(3rem,8.5vw,9.5rem)] leading-none text-ivory" style={{ fontVariationSettings: '"opsz" 96, "wght" 490' }}>
                {COPY.gate.diamond.word}
              </span>
            </span>
            <span className="gate-note-diamond micro mt-4 max-w-[22em] text-champagne">{COPY.gate.diamond.line}</span>
            <span className="micro mt-5 text-ivory/70 underline-offset-4 transition-colors group-hover/side:text-ivory group-hover/side:underline">{COPY.gate.diamond.cta}</span>
          </button>
          {credit(diamondPiece, 'md:mt-6 md:text-right')}
        </div>
      </div>
    </section>
  );
}
