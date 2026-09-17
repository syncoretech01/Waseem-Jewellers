'use client';

import { useEffect, useRef, type Ref } from 'react';
import { Img } from '@/components/media/Img';
import { useMoment, type MomentHandle } from './useMoment';
import type { StudyMoment } from '@/data/moments';
import { cn } from '@/lib/cn';

/**
 * The study: a drawing becomes the piece, and the piece turns.
 *
 * The drawing is a pencil pass over the piece's own photograph, so every line in it is a line
 * the photograph has. It develops into the photograph — line first, then tone, then colour —
 * and the ring then turns to a second angle Waseem actually shot: the frame tilts on its
 * vertical axis and the first photograph gives way to the second at the moment the tilt is
 * deepest, so the visitor reads a turn rather than a cut. Nothing is rendered; both angles are
 * photographs.
 *
 * One writer per property: the crossfades are opacity tweens on three sibling images, the
 * turn is a single rotateY on the wrapper that holds them, and the captions are opacity
 * tweens on their own elements. No element is written by two tweens.
 */
export function RingStudy({ study, slug, sizes, className, driven, ref, onBeat }: { study: StudyMoment; slug: string; sizes: string; className?: string; driven?: boolean; ref?: Ref<MomentHandle>; onBeat?: (key: 'drawn' | 'made' | 'turned' | null) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const beatRef = useRef(onBeat);
  useEffect(() => {
    beatRef.current = onBeat;
  }, [onBeat]);

  const { still } = useMoment(
    root,
    (tl, el) => {
      const sketch = el.querySelector<HTMLElement>('.study-sketch');
      const hero = el.querySelector<HTMLElement>('.study-hero');
      const second = el.querySelector<HTMLElement>('.study-second');
      const turn = el.querySelector<HTMLElement>('.study-turn');
      const caps = el.querySelectorAll<HTMLElement>('.study-cap');
      if (!sketch || !hero || !second || !turn) return;
      // the beat is read from the playhead, so it is right in both directions of a scrub
      let last: 'drawn' | 'made' | 'turned' | null = null;
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        const key = p < 0.21 ? 'drawn' : p < 0.6 ? 'made' : 'turned';
        if (key !== last) {
          last = key;
          beatRef.current?.(key);
        }
      });
      // the timeline is one unit long: its fractions are the moment's fractions
      tl.set(hero, { opacity: 0, filter: 'grayscale(1) contrast(1.15)' }, 0);
      tl.set(second, { opacity: 0 }, 0);
      tl.set(turn, { rotateY: 0 }, 0);
      tl.fromTo(caps[0]!, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.02);
      // the photograph develops out of the drawing: the drawing thins as tone arrives, then colour
      tl.to(caps[0]!, { autoAlpha: 0, y: -6, duration: 0.04 }, 0.2);
      tl.to(hero, { opacity: 1, duration: 0.14 }, 0.2);
      tl.to(sketch, { opacity: 0, duration: 0.12 }, 0.26);
      tl.to(hero, { filter: 'grayscale(0) contrast(1)', duration: 0.12 }, 0.32);
      tl.fromTo(caps[1]!, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.3);
      // the turn: the frame tilts on its vertical axis; the second angle takes over at the deepest point
      tl.to(caps[1]!, { autoAlpha: 0, y: -6, duration: 0.04 }, 0.56);
      tl.to(turn, { rotateY: -16, duration: 0.13, ease: 'power2.in' }, 0.58);
      tl.to(second, { opacity: 1, duration: 0.05 }, 0.685);
      tl.to(turn, { rotateY: 0, duration: 0.14, ease: 'power2.out' }, 0.71);
      tl.fromTo(caps[2]!, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.74);
      tl.set({}, {}, 1);
    },
    { driven, ref },
  );

  const srcset = study.sketch.widths.map((w) => `${study.sketch.dir}/sketch-${w}w.webp ${w}w`).join(', ');
  const caps = [study.beats.drawn, study.beats.made, study.beats.turned];

  return (
    <div ref={root} className={cn('relative w-full overflow-hidden bg-pearl', className)} style={{ aspectRatio: '1 / 1', perspective: '1400px' }} data-moment="study" data-still={still ? '1' : '0'}>
      {/* the turn: this wrapper's transform has exactly one writer */}
      <div className="study-turn absolute inset-0 will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-0">
          {/* the drawing: a plain image at the page's own sizes, under the photograph it was traced from */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="study-sketch absolute inset-0 h-full w-full object-contain" src={`${study.sketch.dir}/sketch-1080w.webp`} srcSet={srcset} sizes={sizes} alt={study.sketch.alt} decoding="async" loading="lazy" draggable={false} style={{ opacity: still ? 0 : 1 }} />
        </div>
        <div className="study-hero absolute inset-0" style={{ opacity: still ? 1 : 0 }}>
          <Img image={study.hero} sizes={sizes} plain data={{ 'flip-source': slug }} />
        </div>
        <div className="study-second absolute inset-0" style={{ opacity: 0 }} aria-hidden>
          <Img image={study.second} sizes={sizes} plain alt="" />
        </div>
      </div>

      {/* the captions, each a plain fact: written over the pearl at the foot of the frame */}
      {!still && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0" aria-hidden>
          {caps.map((c) => (
            <p key={c} className="study-cap absolute bottom-5 left-5 right-5 max-w-[30em] font-display text-[0.9375rem] leading-snug text-ink opacity-0 md:bottom-7 md:left-7 md:right-7 md:text-[1.0625rem]" style={{ fontVariationSettings: '"opsz" 18' }}>
              {c}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
