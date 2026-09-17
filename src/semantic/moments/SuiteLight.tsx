'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { Img } from '@/components/media/Img';
import { useMoment, type MomentHandle } from './useMoment';
import type { LightMoment } from '@/data/moments';
import { cn } from '@/lib/cn';

/**
 * The light: a suite in one photograph, and one light that finds its pieces in turn.
 *
 * The photograph never moves. The frame goes dark, a soft light settles on the earring and
 * names it, travels to the necklace, then to the pendant, and at the end the whole suite is
 * lit again as the studio shot it. It is the way a piece is shown in a dark showroom under a
 * single lamp, and it says nothing about the suite except where its parts are and what
 * Waseem publishes about them.
 *
 * The light is a mask on a dark veil over the photograph. One ticker-free writer: the veil's
 * mask is composed from a single state object tweened by the timeline, written in one
 * `onUpdate`, and nothing else touches it.
 */
export function SuiteLight({ moment, slug, sizes, className, driven, ref, onLit }: { moment: LightMoment; slug: string; sizes: string; className?: string; driven?: boolean; ref?: Ref<MomentHandle>; onLit?: (key: string | null) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const litRef = useRef(onLit);
  useEffect(() => {
    litRef.current = onLit;
  }, [onLit]);
  const [lit, setLit] = useState<string | null>(null);

  const { still } = useMoment(
    root,
    (tl, el) => {
      const veil = el.querySelector<HTMLElement>('.light-veil');
      const caps = el.querySelectorAll<HTMLElement>('.light-cap');
      if (!veil) return;
      const lights = moment.lights;
      const first = lights[0]!;
      // the light's state: where it is, how wide, and how dark the rest of the room is
      const s = { cx: first.cx, cy: first.cy, rx: 0.9, ry: 0.9, dark: 0 };
      const write = () => {
        const mask = `radial-gradient(ellipse ${(s.rx * 100).toFixed(2)}% ${(s.ry * 100).toFixed(2)}% at ${(s.cx * 100).toFixed(2)}% ${(s.cy * 100).toFixed(2)}%, transparent 0%, transparent 46%, rgb(0 0 0 / 0.55) 72%, black 100%)`;
        veil.style.maskImage = mask;
        veil.style.setProperty('-webkit-mask-image', mask);
        veil.style.opacity = s.dark.toFixed(3);
      };
      write();
      let last: string | null = null;
      const light = (key: string | null) => {
        if (key === last) return;
        last = key;
        setLit(key);
        litRef.current?.(key);
      };
      // the room darkens and the light closes on the first piece
      tl.to(s, { dark: 0.86, rx: first.rx * 1.6, ry: first.ry * 1.6, duration: 0.14, onUpdate: write }, 0.02);
      // one hold per piece, the light travelling between them
      const holdFrom = 0.16;
      const holdTo = 0.84;
      const per = (holdTo - holdFrom) / lights.length;
      lights.forEach((l, i) => {
        const at = holdFrom + per * i;
        if (i > 0) tl.to(s, { cx: l.cx, cy: l.cy, rx: l.rx * 1.6, ry: l.ry * 1.6, duration: per * 0.35, ease: 'power2.inOut', onUpdate: write }, at);
        const cap = caps[i];
        if (cap) {
          tl.fromTo(cap, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: per * 0.12 }, at + per * 0.38);
          tl.to(cap, { autoAlpha: 0, y: -6, duration: per * 0.1 }, at + per * 0.98);
        }
      });
      // the whole suite, lit again
      tl.to(s, { dark: 0, rx: 0.9, ry: 0.9, duration: 0.12, onUpdate: write }, holdTo);
      const closing = caps[lights.length];
      if (closing) tl.fromTo(closing, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, holdTo + 0.06);
      tl.set({}, {}, 1);
      // the lit piece is read back from the playhead, so a scrub backwards un-lights correctly
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        if (p < holdFrom || p >= holdTo) {
          light(null);
          return;
        }
        const i = Math.min(lights.length - 1, Math.floor((p - holdFrom) / per));
        if (p - (holdFrom + per * i) >= per * 0.36) light(lights[i]!.key);
      });
    },
    { driven, ref, dependencies: [moment.lights.length] },
  );

  const caps = [...moment.lights.map((l) => ({ key: l.key, label: l.label, note: l.note })), { key: 'closing', label: '', note: moment.closing }];

  return (
    <div ref={root} className={cn('relative w-full overflow-hidden bg-bg-2', className)} style={{ aspectRatio: '1 / 1' }} data-moment="light" data-lit-region={lit ?? ''} data-still={still ? '1' : '0'}>
      <div className="absolute inset-0">
        <Img image={moment.image} sizes={sizes} plain data={{ 'flip-source': slug }} />
      </div>
      {/* the veil: its mask and opacity have exactly one writer */}
      {!still && <div className="light-veil pointer-events-none absolute inset-0 bg-ink" style={{ opacity: 0 }} aria-hidden />}

      {!still && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* the pieces are named over the darkened room in ivory; the closing line sits on the lit photograph in ink */}
          {caps.map((c) => (
            <p key={c.key} className={cn('light-cap absolute bottom-5 left-5 right-5 max-w-[30em] font-display text-[0.9375rem] leading-snug opacity-0 md:bottom-7 md:left-7 md:right-7 md:text-[1.0625rem]', c.key === 'closing' ? 'text-ink' : 'text-ivory')} style={{ fontVariationSettings: '"opsz" 18', textShadow: c.key === 'closing' ? undefined : '0 1px 2px rgb(0 0 0 / 0.5), 0 0 24px rgb(0 0 0 / 0.5)' }}>
              {c.label && <span className="micro mr-3 text-champagne">{c.label}</span>}
              {c.note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
