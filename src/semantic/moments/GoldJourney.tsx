'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { Img } from '@/components/media/Img';
import { resolveImage } from '@/data';
import { useMoment, type MomentHandle } from './useMoment';
import type { JourneyMoment } from '@/data/moments';
import { cn } from '@/lib/cn';

/**
 * The goldwork journey: from the work to the piece.
 *
 * The camera opens on the pattern of one collar panel filling the frame, travels down the
 * haar to its relief and its edge, and pulls back until the whole piece is in view — one
 * photograph, at scales its source can carry. On the whole piece, four places become live:
 * hover, focus or tap one and the camera drifts closer to it and says what it is; leave and
 * it settles back. Inspection, not a tooltip.
 *
 * One writer: the camera element's transform is composed as a single string by one writer
 * from one state object; the scrub tweens that object, and so do the hotspots — a hotspot's
 * tween runs only on the whole piece, where the scrub is at rest, is killed when the next
 * begins, and the scrub, when it moves again, writes absolute values, so the two never fight.
 * The markers are lit by a data attribute and faded by CSS; GSAP never touches them.
 */
export function GoldJourney({ moment, slug, sizes, className, driven, ref, onLit, onWhole, captions = 'inside' }: { moment: JourneyMoment; slug: string; sizes: string; className?: string; driven?: boolean; ref?: Ref<MomentHandle>; onLit?: (key: string | null) => void; onWhole?: (whole: boolean) => void; captions?: 'inside' | 'none' }) {
  const root = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const litRef = useRef(onLit);
  const wholeRef = useRef(onWhole);
  useEffect(() => {
    litRef.current = onLit;
    wholeRef.current = onWhole;
  }, [onLit, onWhole]);
  const [lit, setLit] = useState<string | null>(null);
  const [whole, setWhole] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  // where the camera looks and how close; the transform is derived from these three
  const state = useRef({ cx: 0.5, cy: 0.5, scale: 1 });
  const asset = resolveImage(moment.image);
  const holds = moment.holds;
  const last = holds[holds.length - 1]!;

  // the frame's width, so the camera never magnifies past the negative
  const capFor = (scale: number) => {
    const w = root.current?.clientWidth || 720;
    return Math.min(scale, Math.max(1, asset.width / w));
  };
  /**
   * The element scales about its centre, and the translation is applied in the frame's space
   * after the scale — so to bring the point (cx, cy) of the photograph to the frame's centre the
   * element moves by (0.5 − c) of its own size, multiplied by the scale.
   */
  const transformFor = (cx: number, cy: number, scale: number) => `translate3d(${((0.5 - cx) * 100 * scale).toFixed(3)}%, ${((0.5 - cy) * 100 * scale).toFixed(3)}%, 0) scale(${scale.toFixed(4)})`;
  const write = () => {
    const cam = camera.current;
    if (!cam) return;
    const s = state.current;
    cam.style.transform = transformFor(s.cx, s.cy, s.scale);
  };
  const toHold = (h: { cx: number; cy: number; scale: number }) => ({ cx: h.cx, cy: h.cy, scale: capFor(h.scale) });

  const { still } = useMoment(
    root,
    (tl) => {
      const s = state.current;
      const first = holds[0]!;
      Object.assign(s, toHold(first));
      write();
      // holds and travels: a beat per hold, the last one the whole piece
      const n = holds.length;
      const travel = 0.14;
      const per = (0.84 - travel) / (n - 1);
      holds.slice(1).forEach((h, i) => {
        const at = 0.1 + per * i;
        tl.to(s, { ...toHold(h), duration: travel, ease: 'power2.inOut', onUpdate: write }, at);
      });
      tl.set({}, {}, 1);
      let lastKey: string | null = null;
      let lastWhole = false;
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        // the hold the camera is at or travelling towards
        const i = p < 0.1 ? 0 : Math.min(n - 1, Math.floor((p - 0.1) / per) + 1);
        const key = holds[i]!.key;
        if (key !== lastKey) {
          lastKey = key;
          setLit(key);
          litRef.current?.(key);
        }
        const w = i === n - 1 && p >= 0.1 + per * (n - 2) + travel;
        if (w !== lastWhole) {
          lastWhole = w;
          setWhole(w);
          wholeRef.current?.(w);
        }
      });
    },
    { driven, ref, dependencies: [holds.length] },
  );

  // a hotspot: the camera drifts closer while it is held, and settles back when it is let go
  // (the hotspot tween is tracked and killed by hand: `overwrite` would kill the scrub's tweens
  // of the same state object, and the journey would lose its choreography after one hover)
  const lookTween = useRef<gsap.core.Tween | null>(null);
  const look = (key: string | null) => {
    if (!whole) return;
    const target = key ? moment.hotspots.find((h) => h.key === key) : undefined;
    setHot(key);
    litRef.current?.(key ?? last.key);
    lookTween.current?.kill();
    lookTween.current = gsap.to(state.current, { ...(target ? toHold(target) : toHold(last)), duration: 1.1, ease: 'power3.out', onUpdate: write });
  };
  useEffect(
    () => () => {
      lookTween.current?.kill();
    },
    [],
  );

  const caps = [...holds.map((h) => ({ key: h.key, label: h.label, note: h.note })), ...moment.hotspots.map((h) => ({ key: h.key, label: h.label, note: h.note }))];
  const shown = hot ?? lit;

  return (
    <div ref={root} className={cn('relative w-full overflow-hidden bg-bg-2', className)} style={{ aspectRatio: '1 / 1' }} data-moment="journey" data-lit-region={lit ?? ''} data-whole={whole ? '1' : '0'} data-still={still ? '1' : '0'}>
      {/* the camera: this element's transform has exactly one writer */}
      <div ref={camera} className="absolute inset-0 will-change-transform" style={still ? { transform: transformFor(last.cx, last.cy, last.scale) } : undefined}>
        <Img image={moment.image} sizes={sizes} plain data={{ 'flip-source': slug }} />
      </div>

      {/* the places on the whole piece: live only once the camera has pulled back */}
      {!still && (
        <div className={cn('absolute inset-0 transition-opacity duration-700', whole ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={!whole}>
          {moment.hotspots.map((h) => {
            // the marker sits where the place is in the whole-piece framing
            const sx = (h.cx - last.cx) * last.scale + 0.5;
            const sy = (h.cy - last.cy) * last.scale + 0.5;
            return (
              <button
                key={h.key}
                type="button"
                className="group/hot absolute -translate-x-1/2 -translate-y-1/2 p-3"
                style={{ left: `${sx * 100}%`, top: `${sy * 100}%` }}
                onPointerEnter={() => look(h.key)}
                onPointerLeave={() => look(null)}
                onFocus={() => look(h.key)}
                onBlur={() => look(null)}
                onClick={() => look(hot === h.key ? null : h.key)}
                aria-label={`${h.label} — look closer`}
                aria-pressed={hot === h.key}
                data-lit={hot === h.key ? '1' : '0'}
                tabIndex={whole ? 0 : -1}
              >
                <span className="block h-2.5 w-2.5 rounded-full bg-gold-hi ring-1 ring-ivory/70 transition-transform duration-500 group-hover/hot:scale-125 group-data-[lit=1]/hot:scale-125" />
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-hi/70 opacity-60 transition-transform duration-700 group-hover/hot:scale-150 group-data-[lit=1]/hot:scale-150" />
              </button>
            );
          })}
        </div>
      )}

      {captions === 'inside' && !still && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(to top, rgba(11,10,9,0.78), rgba(11,10,9,0.4) 45%, transparent)' }} />
          {/* one node: the caption for what the camera is looking at; a change replaces it, never overlaps it */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {(() => {
              const c = caps.find((x) => x.key === shown);
              return c ? (
                <p key={c.key} className="stage-note absolute bottom-5 left-5 right-5 max-w-[30em] font-display text-[0.9375rem] leading-snug text-ivory md:bottom-7 md:left-7 md:right-7 md:text-[1.0625rem]" style={{ fontVariationSettings: '"opsz" 18' }}>
                  <span className="micro mr-3 text-champagne">{c.label}</span>
                  {c.note}
                </p>
              ) : null;
            })()}
          </div>
        </>
      )}
    </div>
  );
}
