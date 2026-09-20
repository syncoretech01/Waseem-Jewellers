'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { Img } from '@/components/media/Img';
import { resolveImage } from '@/data';
import { useMoment, type MomentHandle } from './useMoment';
import type { BangleMoment } from '@/data/moments';
import { cn } from '@/lib/cn';

/**
 * The bangle study: one set of bangles, turned in the hand.
 *
 * Two photographs the shop took — the stack on its side, and raised so the inside shows —
 * and a camera that reads the set the way a hand turns it: the profile whole, the surface
 * close, the rhythm of the motif as the camera travels along the face, then the turn — the
 * frame tilts on its horizontal axis as the stack rises and the second photograph takes over
 * at the deepest point — the inside, and the complete set. Nothing is rendered or invented:
 * two angles, one camera.
 *
 * One writer per property: the camera element's transform is composed from one state object
 * by one writer (the scrub tweens the state); the turn is a single rotateX on the wrapper
 * that holds the two images, whose opacities are tweened one each.
 */
export function BangleStudy({ moment, slug, sizes, className, driven, ref, onLit, captions = 'inside' }: { moment: BangleMoment; slug: string; sizes: string; className?: string; driven?: boolean; ref?: Ref<MomentHandle>; onLit?: (key: string | null) => void; captions?: 'inside' | 'none' }) {
  const root = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const litRef = useRef(onLit);
  useEffect(() => {
    litRef.current = onLit;
  }, [onLit]);
  const [lit, setLit] = useState<string | null>(null);
  const state = useRef({ cx: 0.5, cy: 0.5, scale: 1 });
  const asset = resolveImage(moment.profile);
  const holds = moment.holds;
  const last = holds[holds.length - 1]!;

  const capFor = (scale: number) => {
    const w = root.current?.clientWidth || 640;
    return Math.min(scale, Math.max(1, asset.width / w));
  };
  const transformFor = (cx: number, cy: number, scale: number) => `translate3d(${((0.5 - cx) * 100 * scale).toFixed(3)}%, ${((0.5 - cy) * 100 * scale).toFixed(3)}%, 0) scale(${scale.toFixed(4)})`;
  const write = () => {
    const cam = camera.current;
    if (!cam) return;
    const s = state.current;
    cam.style.transform = transformFor(s.cx, s.cy, s.scale);
  };

  const { still } = useMoment(
    root,
    (tl, el) => {
      const s = state.current;
      const turn = el.querySelector<HTMLElement>('.bangle-turn');
      const profile = el.querySelector<HTMLElement>('.bangle-profile');
      const raised = el.querySelector<HTMLElement>('.bangle-raised');
      if (!turn || !profile || !raised) return;
      const n = holds.length;
      const per = 1 / n;
      const travel = per * 0.4;
      const first = holds[0]!;
      Object.assign(s, { cx: first.cx, cy: first.cy, scale: capFor(first.scale) });
      write();
      tl.set(profile, { opacity: 1 }, 0);
      tl.set(raised, { opacity: 0 }, 0);
      tl.set(turn, { rotateX: 0 }, 0);
      holds.forEach((h, i) => {
        if (i === 0) return;
        const at = per * i;
        const prev = holds[i - 1]!;
        // the turn between the two angles: the frame tilts as the stack rises, and the second
        // photograph takes over at the deepest point of the tilt
        if (h.angle !== prev.angle) {
          tl.to(turn, { rotateX: h.angle === 'raised' ? 14 : -14, duration: travel * 0.5, ease: 'power2.in' }, at);
          tl.to(profile, { opacity: h.angle === 'raised' ? 0 : 1, duration: travel * 0.25 }, at + travel * 0.4);
          tl.to(raised, { opacity: h.angle === 'raised' ? 1 : 0, duration: travel * 0.25 }, at + travel * 0.4);
          tl.to(turn, { rotateX: 0, duration: travel * 0.5, ease: 'power2.out' }, at + travel * 0.5);
        }
        if (h.from) {
          // a travel: the camera arrives at the near end and pans along the face while it holds
          tl.to(s, { cx: h.from.cx, cy: h.from.cy, scale: capFor(h.scale), duration: travel * 0.5, ease: 'power2.inOut', onUpdate: write }, at);
          tl.to(s, { cx: h.cx, cy: h.cy, duration: per - travel * 0.5, ease: 'none', onUpdate: write }, at + travel * 0.5);
        } else {
          tl.to(s, { cx: h.cx, cy: h.cy, scale: capFor(h.scale), duration: travel, ease: 'power2.inOut', onUpdate: write }, at);
        }
      });
      tl.set({}, {}, 1);
      let lastKey: string | null = null;
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        const i = Math.min(n - 1, Math.floor(p / per));
        // a hold is named once the camera has arrived (a third of the way into its beat)
        const key = p - per * i >= travel * 0.6 || i === 0 ? holds[i]!.key : holds[Math.max(0, i - 1)]!.key;
        if (key !== lastKey) {
          lastKey = key;
          setLit(key);
          litRef.current?.(key);
        }
      });
    },
    { driven, ref, dependencies: [holds.length] },
  );

  const cap = holds.find((h) => h.key === lit);

  return (
    <div ref={root} className={cn('relative w-full overflow-hidden bg-pearl', className)} style={{ aspectRatio: '1 / 1', perspective: '1400px' }} data-moment="bangle" data-lit-region={lit ?? ''} data-still={still ? '1' : '0'}>
      {/* the turn: this wrapper's transform has exactly one writer; inside it the camera has one too */}
      <div className="bangle-turn absolute inset-0 will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
        <div ref={camera} className="absolute inset-0 will-change-transform" style={still ? { transform: transformFor(last.cx, last.cy, last.scale) } : undefined}>
          <div className="bangle-profile absolute inset-0" style={{ opacity: still ? 0 : 1 }}>
            <Img image={moment.profile} sizes={sizes} plain data={{ 'flip-source': slug }} />
          </div>
          <div className="bangle-raised absolute inset-0" style={{ opacity: still ? 1 : 0 }} aria-hidden={!still}>
            <Img image={moment.raised} sizes={sizes} plain alt={still ? undefined : ''} data={still ? { 'flip-source': slug } : undefined} />
          </div>
        </div>
      </div>

      {captions === 'inside' && !still && cap && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" aria-hidden style={{ background: 'linear-gradient(to top, rgb(237 229 216 / 0.96), rgb(237 229 216 / 0.7) 45%, transparent)' }}>
          <p key={cap.key} className="stage-note absolute bottom-5 left-5 right-5 max-w-[30em] font-display text-[0.9375rem] leading-snug text-ink md:bottom-7 md:left-7 md:right-7 md:text-[1.0625rem]" style={{ fontVariationSettings: '"opsz" 18' }}>
            <span className="micro mr-3 text-gold-deep">{cap.label}</span>
            {cap.note}
          </p>
        </div>
      )}
    </div>
  );
}
