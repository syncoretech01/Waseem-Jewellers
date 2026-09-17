'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { Img } from '@/components/media/Img';
import { useMoment, type MomentHandle } from './useMoment';
import type { PartedMoment } from '@/data/moments';
import { cn } from '@/lib/cn';

/**
 * The parted piece: one photograph of a pair, cut at the joints and drawn apart.
 *
 * A jeweller reads an earring in parts — the crown at the ear, the bell it hangs from, the
 * tassel that swings — and this is that reading, done to the photograph rather than to the
 * piece. The frame is cut into horizontal bands at the joints; on the way through, the bands
 * separate by a few percent of the frame so each part sits on its own with its name beside
 * it, then close again into the one photograph. Every band is the photograph itself, in
 * place; nothing is redrawn, mirrored or moved sideways. The cut is a reading, not a claim
 * that the parts come away.
 *
 * One writer per property: each band's transform is tweened by this timeline and nothing
 * else; the labels are opacity tweens on their own elements.
 */
export function PartedPiece({ moment, slug, sizes, className, driven, ref, onLit }: { moment: PartedMoment; slug: string; sizes: string; className?: string; driven?: boolean; ref?: Ref<MomentHandle>; onLit?: (key: string | null) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const litRef = useRef(onLit);
  useEffect(() => {
    litRef.current = onLit;
  }, [onLit]);
  const [lit, setLit] = useState<string | null>(null);
  const bands = moment.bands;
  const lastTo = bands[bands.length - 1]?.to ?? 1;

  const { still } = useMoment(
    root,
    (tl, el) => {
      const parts = [...el.querySelectorAll<HTMLElement>('.parted-band')];
      const rest = el.querySelector<HTMLElement>('.parted-rest');
      const labels = [...el.querySelectorAll<HTMLElement>('.parted-label')];
      const closing = el.querySelector<HTMLElement>('.parted-closing');
      if (parts.length !== bands.length) return;
      const n = bands.length;
      // how far the bands part: a few percent of the frame, so the reading stays a reading —
      // written as a percentage of each band's own height, which is what a transform's % means
      const gap = 6;
      const offset = (i: number) => (i - (n - 1) / 2) * gap;
      const ofBand = (framePct: number, from: number, to: number) => `${(framePct / (to - from)).toFixed(3)}%`;
      let last: string | null = null;
      const light = (key: string | null) => {
        if (key === last) return;
        last = key;
        setLit(key);
        litRef.current?.(key);
      };
      // the pair whole, then parted
      parts.forEach((p, i) => tl.to(p, { y: ofBand(offset(i), bands[i]!.from, bands[i]!.to), duration: 0.18, ease: 'power2.inOut' }, 0.12));
      if (rest) tl.to(rest, { y: ofBand(offset(n - 1) + gap, lastTo, 1), opacity: 0.3, duration: 0.18, ease: 'power2.inOut' }, 0.12);
      // one hold per part, its name beside it
      const holdFrom = 0.3;
      const holdTo = 0.8;
      const per = (holdTo - holdFrom) / n;
      labels.forEach((l, i) => {
        const at = holdFrom + per * i;
        tl.fromTo(l, { autoAlpha: 0, x: -8, yPercent: -50 }, { autoAlpha: 1, x: 0, yPercent: -50, duration: per * 0.2 }, at);
      });
      // then closed again into one photograph
      parts.forEach((p) => tl.to(p, { y: '0%', duration: 0.14, ease: 'power2.inOut' }, holdTo + 0.02));
      if (rest) tl.to(rest, { y: '0%', opacity: 1, duration: 0.14, ease: 'power2.inOut' }, holdTo + 0.02);
      labels.forEach((l) => tl.to(l, { autoAlpha: 0, duration: 0.06 }, holdTo));
      if (closing) tl.fromTo(closing, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, holdTo + 0.12);
      tl.set({}, {}, 1);
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        if (p < holdFrom || p >= holdTo) {
          light(null);
          return;
        }
        light(bands[Math.min(n - 1, Math.floor((p - holdFrom) / per))]!.key);
      });
    },
    { driven, ref, dependencies: [bands.length] },
  );

  /** A band shows the frame's slice from `from` to `to`: the whole photograph, positioned so only that slice is inside the band. */
  const slice = (from: number, to: number) => {
    const h = to - from;
    return { height: `${(100 / h).toFixed(4)}%`, top: `${(-100 * from) / h}%` };
  };

  return (
    <div ref={root} className={cn('relative w-full overflow-hidden bg-pearl', className)} style={{ aspectRatio: '1 / 1' }} data-moment="parted" data-lit-region={lit ?? ''} data-still={still ? '1' : '0'}>
      {still ? (
        <div className="absolute inset-0">
          <Img image={moment.image} sizes={sizes} plain data={{ 'flip-source': slug }} />
        </div>
      ) : (
        <>
          {bands.map((b, i) => (
            <div key={b.key} className="parted-band absolute inset-x-0 overflow-hidden will-change-transform" style={{ top: `${b.from * 100}%`, height: `${(b.to - b.from) * 100}%` }} data-band={b.key} data-lit={lit === b.key ? '1' : '0'}>
              <div className="absolute inset-x-0" style={slice(b.from, b.to)}>
                <Img image={moment.image} sizes={sizes} plain alt={i === 0 ? undefined : ''} data={i === 0 ? { 'flip-source': slug } : undefined} />
              </div>
            </div>
          ))}
          {/* what is left beneath the last joint — the reflection on the plate — goes with the tassel and dims */}
          {lastTo < 1 && (
            <div className="parted-rest absolute inset-x-0 overflow-hidden will-change-transform" style={{ top: `${lastTo * 100}%`, height: `${(1 - lastTo) * 100}%` }} aria-hidden>
              <div className="absolute inset-x-0" style={slice(lastTo, 1)}>
                <Img image={moment.image} sizes={sizes} plain alt="" />
              </div>
            </div>
          )}

          {/* the names, each beside its part, with a hairline to it */}
          <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
            {bands.map((b, i) => {
              const n = bands.length;
              const mid = ((b.from + b.to) / 2) * 100 + (i - (n - 1) / 2) * 6;
              return (
                <div key={b.key} className="parted-label absolute right-[3%] flex w-[27%] items-start gap-2 opacity-0" style={{ top: `${mid}%` }}>
                  <span className="mt-[0.55em] h-px w-4 shrink-0 bg-ink/40" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="micro text-ink">{b.label}</span>
                    <span className="hidden font-display text-[0.8125rem] leading-snug text-ink/70 md:block" style={{ fontVariationSettings: '"opsz" 14' }}>
                      {b.note}
                    </span>
                  </span>
                </div>
              );
            })}
            <p className="parted-closing absolute bottom-5 left-5 right-5 max-w-[30em] font-display text-[0.9375rem] leading-snug text-ink opacity-0 md:bottom-7 md:left-7 md:right-7 md:text-[1.0625rem]" style={{ fontVariationSettings: '"opsz" 18' }}>
              {moment.closing}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
