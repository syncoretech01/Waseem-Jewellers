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
 * separate by a tenth of the frame so each part sits on its own with its name beside it, hold
 * there while the parts are read one by one, and close again into the one photograph. Every
 * band is the photograph itself, in place; nothing is redrawn, mirrored or moved sideways.
 * The cut is a reading, not a claim that the parts come away.
 *
 * The beats are exported so a chapter that drives the moment can put its own words to the
 * same fractions. One writer per property: each band's transform is tweened by this
 * timeline and nothing else; the names beside the bands are one CSS-transitioned attribute
 * each, lit while their part is read.
 */

/** Where the reading happens in the moment's 0–1: whole, parting, one hold per part, closing. */
export const PARTED_BEATS = { partAt: 0.1, holdFrom: 0.3, holdTo: 0.82, closeBy: 0.94 };

/** The beat a progress value is in: 'whole' before the parts are read, a part's index during, 'closing' after. */
export function partedBeatAt(p: number, n: number): { kind: 'whole' | 'part' | 'closing'; index: number } {
  const { holdFrom, holdTo } = PARTED_BEATS;
  if (p < holdFrom) return { kind: 'whole', index: -1 };
  if (p >= holdTo) return { kind: 'closing', index: -1 };
  return { kind: 'part', index: Math.min(n - 1, Math.floor(((p - holdFrom) / (holdTo - holdFrom)) * n)) };
}

export function PartedPiece({ moment, slug, sizes, className, driven, ref, onLit, captions = 'inside' }: { moment: PartedMoment; slug: string; sizes: string; className?: string; driven?: boolean; ref?: Ref<MomentHandle>; onLit?: (key: string | null) => void; /** `inside` writes the closing line over the photograph; `none` leaves every word to the chapter. */ captions?: 'inside' | 'none' }) {
  const root = useRef<HTMLDivElement>(null);
  const litRef = useRef(onLit);
  useEffect(() => {
    litRef.current = onLit;
  }, [onLit]);
  const [lit, setLit] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const bands = moment.bands;
  const lastTo = bands[bands.length - 1]?.to ?? 1;

  const { still } = useMoment(
    root,
    (tl, el) => {
      const parts = [...el.querySelectorAll<HTMLElement>('.parted-band')];
      const rest = el.querySelector<HTMLElement>('.parted-rest');
      if (parts.length !== bands.length) return;
      const n = bands.length;
      const { partAt, holdFrom, holdTo, closeBy } = PARTED_BEATS;
      // how far the bands part: nearly a tenth of the frame, so the reading is unmistakable and
      // still a reading — the whole set eased down a little so the crown's top is never cut
      const gap = 9;
      const offset = (i: number) => (i - (n - 1) / 2) * gap + 3;
      // written as a percentage of each band's own height, which is what a transform's % means
      const ofBand = (framePct: number, from: number, to: number) => `${(framePct / (to - from)).toFixed(3)}%`;
      let last: string | null = null;
      const light = (key: string | null) => {
        if (key === last) return;
        last = key;
        setLit(key);
        litRef.current?.(key);
      };
      // whole, then parted — the parts separate over a fifth of the moment and hold
      parts.forEach((p, i) => tl.to(p, { y: ofBand(offset(i), bands[i]!.from, bands[i]!.to), duration: holdFrom - partAt, ease: 'power2.inOut' }, partAt));
      if (rest) tl.to(rest, { y: ofBand(offset(n - 1) + gap, lastTo, 1), opacity: 0.25, duration: holdFrom - partAt, ease: 'power2.inOut' }, partAt);
      // then closed again into one photograph
      parts.forEach((p) => tl.to(p, { y: '0%', duration: closeBy - holdTo, ease: 'power2.inOut' }, holdTo));
      if (rest) tl.to(rest, { y: '0%', opacity: 1, duration: closeBy - holdTo, ease: 'power2.inOut' }, holdTo);
      tl.set({}, {}, 1);
      let lastClosed = false;
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        const beat = partedBeatAt(p, n);
        light(beat.kind === 'part' ? bands[beat.index]!.key : null);
        const c = p >= closeBy;
        if (c !== lastClosed) {
          lastClosed = c;
          setClosed(c);
        }
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
              {/* a hairline along the joint, drawn while this part is read */}
              <span aria-hidden data-lit={lit === b.key ? '1' : '0'} className="pointer-events-none absolute inset-x-[8%] bottom-0 h-px origin-left scale-x-0 bg-gold-deep/50 transition-transform duration-700 ease-[var(--ease-out-expo)] data-[lit=1]:scale-x-100" />
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

          {/* the names, each beside its part in the right margin — lit one at a time, never a note inside the frame */}
          <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
            {bands.map((b, i) => {
              const n = bands.length;
              const mid = ((b.from + b.to) / 2) * 100 + (i - (n - 1) / 2) * 9 + 3;
              return (
                <p key={b.key} data-lit={lit === b.key ? '1' : '0'} className="parted-label absolute right-[4%] flex -translate-y-1/2 items-center gap-2 opacity-0 transition-opacity duration-500 data-[lit=1]:opacity-100" style={{ top: `${mid}%` }}>
                  <span className="h-px w-5 bg-ink/50" />
                  <span className="micro text-ink">{b.label}</span>
                </p>
              );
            })}
            {captions === 'inside' && closed && (
              <p className="stage-note absolute bottom-5 left-5 right-5 max-w-[30em] font-display text-[0.9375rem] leading-snug text-ink md:bottom-7 md:left-7 md:right-7 md:text-[1.0625rem]" style={{ fontVariationSettings: '"opsz" 18' }}>
                {moment.closing}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
