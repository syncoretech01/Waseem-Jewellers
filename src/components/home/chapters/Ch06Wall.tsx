'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useParallax, useRise } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SaveButton } from '@/components/commerce/SaveButton';
import { Img } from '@/components/media/Img';
import { pieceRefOf } from '@/data/clientIndex';
import { DEPARTMENT_LABEL } from '@/data/labels';
import { COPY } from '@/data/copy';
import { bindPointer, pointer } from '@/lib/motion/pointer';

import type { Department } from '@/data/types';
import type { WallCut } from '@/lib/facets';
import { cn } from '@/lib/cn';

interface Slot {
  slot: string;
  /** Fixed imagery — the one slot that is a scene rather than a piece. */
  image?: string;
  col: string;
  aspect: string;
  offset?: string;
  parallax: number;
}

/**
 * W1–W11 in reading order; W5 is a campaign photograph and the grid keeps its whitespace on
 * purpose.
 *
 * There are no slugs here any more. These eleven positions were hard-bound to eleven pieces,
 * which breaks twice at 599: it cannot grow, and the version of it that could would be the
 * grid the brief forbids. So the composition is a **template** — the asymmetry, the
 * whitespace, the parallax and the tilt are what make it not a grid, and they are exactly
 * what stays fixed while different cuts of the collection move through it.
 */
const SLOTS: Slot[] = [
  { slot: 'W1', col: 'md:col-start-5 md:col-span-4', aspect: '4 / 5', parallax: 0 },
  { slot: 'W2', col: 'md:col-start-2 md:col-span-3', aspect: '1 / 1', offset: 'md:-mt-[10svh]', parallax: -0.06 },
  { slot: 'W3', col: 'md:col-start-9 md:col-span-3', aspect: '4 / 5', offset: 'md:mt-[8svh]', parallax: 0.08 },
  { slot: 'W4', col: 'md:col-start-1 md:col-span-4', aspect: '4 / 5', parallax: 0.04 },
  { slot: 'W5', image: 'wall-campaign', col: 'md:col-start-7 md:col-span-6', aspect: '3 / 2', offset: 'md:mt-[13svh]', parallax: -0.05 },
  { slot: 'W6', col: 'md:col-start-3 md:col-span-3', aspect: '4 / 5', offset: 'md:-mt-[6svh]', parallax: 0.07 },
  { slot: 'W7', col: 'md:col-start-6 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[9svh]', parallax: -0.04 },
  { slot: 'W8', col: 'md:col-start-10 md:col-span-3', aspect: '4 / 5', parallax: 0.09 },
  { slot: 'W9', col: 'md:col-start-1 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[6svh]', parallax: 0.03 },
  { slot: 'W10', col: 'md:col-start-6 md:col-span-3', aspect: '4 / 5', offset: 'md:mt-[11svh]', parallax: -0.07 },
  { slot: 'W11', col: 'md:col-start-9 md:col-span-4', aspect: '4 / 5', parallax: 0.05 },
];

/**
 * CH06 — the jewellery wall, and the door to the whole collection.
 *
 * Ivory, a twelve-column composition of ten pieces and one scene, with whitespace. Batch
 * reveals own the pieces, parallax owns the columns, the pointer owns a three-degree tilt,
 * lift and sheen on the hovered piece. Click flies into the product.
 *
 * The cut switcher changes which ten, so one screen fronts 599 pieces without ever
 * growing, and the chapter closes on the departments themselves with their real counts.
 */
export function Ch06Wall({ cuts, departments }: { cuts: WallCut[]; departments: { department: Department; count: number }[] }) {
  const { ref } = useChapter({ id: 'wall', theme: 'ivory' });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const [cutId, setCutId] = useState(cuts[0]?.id ?? 'selected');
  const cut = cuts.find((c) => c.id === cutId) ?? cuts[0];
  const grid = useRef<HTMLDivElement>(null);
  const pieceSlots = SLOTS.filter((s) => !s.image);

  /**
   * A cut change is a crossfade, and it is written as one.
   *
   * The obvious move here was `gsap/Flip` — the plugin has been registered since Stage 1 and
   * never called. But Flip animates elements from where they were to where they are, and the
   * cuts are disjoint sets of pieces dropped into positions that do not move: nothing
   * travels, so Flip would resolve to exactly this crossfade after loading 12 kB to reach
   * it. The plugin stays unused until something genuinely moves.
   */
  const switchCut = useCallback(
    (id: string) => {
      if (id === cutId) return;
      const root = grid.current;
      if (!root || reduced) {
        setCutId(id);
        return;
      }
      const pieces = root.querySelectorAll('.wall-piece');
      gsap.to(pieces, {
        opacity: 0,
        duration: 0.26,
        ease: 'power2.in',
        stagger: 0.02,
        onComplete: () => {
          setCutId(id);
          requestAnimationFrame(() => {
            gsap.fromTo(root.querySelectorAll('.wall-piece'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.62, ease: 'wj.out', stagger: 0.04 });
          });
        },
      });
    },
    [cutId, reduced],
  );
  useRise(ref, { start: 'top 88%', y: 32 });
  useParallax(ref);

  // pointer: tilt + lift + sheen on the hovered piece (one writer, one ticker)
  const hovered = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || coarse || reduced) return;
    bindPointer();
    let rx = gsap.quickTo(root, 'x');
    let ry = rx;
    let bound: HTMLElement | null = null;
    const bind = (el: HTMLElement) => {
      if (bound === el) return;
      bound = el;
      rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    };
    const tick = () => {
      const el = hovered.current;
      if (!el) return;
      bind(el);
      const r = el.getBoundingClientRect();
      const nx = ((pointer.x - r.left) / r.width) * 2 - 1;
      const ny = ((pointer.y - r.top) / r.height) * 2 - 1;
      rx(-ny * 3);
      ry(nx * 3);
      el.style.setProperty('--sx', `${((nx + 1) / 2) * 100}%`);
      el.style.setProperty('--sy', `${((ny + 1) / 2) * 100}%`);
    };
    gsap.ticker.add(tick);
    const onEnter = (e: Event) => {
      const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.piece-3d');
      if (!el) return;
      hovered.current = el;
      gsap.to(el, { y: -6, duration: 0.6, ease: 'power3.out' });
      el.dataset.lit = '1';
    };
    const onLeave = (e: Event) => {
      const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.piece-3d');
      if (!el) return;
      if (hovered.current === el) hovered.current = null;
      gsap.to(el, { y: 0, rotationX: 0, rotationY: 0, duration: 0.9, ease: 'power3.out' });
      el.dataset.lit = '0';
    };
    const pieces = root.querySelectorAll<HTMLElement>('.wall-piece');
    pieces.forEach((p) => {
      p.addEventListener('pointerenter', onEnter);
      p.addEventListener('pointerleave', onLeave);
    });
    return () => {
      gsap.ticker.remove(tick);
      pieces.forEach((p) => {
        p.removeEventListener('pointerenter', onEnter);
        p.removeEventListener('pointerleave', onLeave);
      });
    };
  }, [ref, coarse, reduced, cutId]);

  // the beat line draws in
  useGSAP(
    () => {
      const root = ref.current;
      if (!root || reduced) return;
      gsap.fromTo(root.querySelector('.wall-rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'wj.out', scrollTrigger: { trigger: root, start: 'top 75%', once: true } });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <section ref={ref} id="ch06" className="relative bg-ivory px-gutter pb-[10svh] pt-[8svh] text-ink md:pb-[12svh] md:pt-[5svh]" aria-labelledby="wall-title">
      <div className="mb-[6svh] flex flex-col gap-4 md:mb-[7svh] md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3" data-rise>
          <p className="micro text-ink/60">{COPY.wall.eyebrow}</p>
          <h2 id="wall-title" className="display text-[clamp(1.75rem,3vw,3.25rem)] leading-tight text-ink">
            {COPY.wall.title}
          </h2>
        </div>
        {cuts.length > 1 ? (
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2" role="group" aria-label="Cut">
            {cuts.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === cutId}
                onClick={() => switchCut(c.id)}
                className={cn('group/cut relative pb-1 font-display text-[1.0625rem] transition-colors', c.id === cutId ? 'text-ink' : 'text-ink/50 hover:text-ink')}
                style={{ fontVariationSettings: '"opsz" 18' }}
              >
                {c.label}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 bottom-0 h-px origin-left bg-ink/40 transition-transform duration-500',
                    c.id === cutId ? 'scale-x-100' : 'scale-x-0 group-hover/cut:scale-x-100',
                  )}
                />
              </button>
            ))}
          </div>
        ) : (
          <span className="wall-rule rule block w-full origin-left md:w-[28vw]" />
        )}
      </div>

      <div ref={grid} className="grid grid-cols-1 gap-x-[2vw] gap-y-[8svh] md:grid-cols-12 md:gap-y-[4svh]">
        {SLOTS.map((s) => {
          // the scene keeps its slot; the pieces come from whichever cut is showing
          if (s.image) {
            return (
              <div key={s.slot} className={cn('wall-col', s.col, s.offset)} data-parallax={s.parallax}>
                <figure className="relative" data-rise>
                  <div className="relative w-full overflow-hidden bg-pearl" style={{ aspectRatio: s.aspect }}>
                    <Img id={s.image} sizes="(min-width: 768px) 50vw, 92vw" className="object-cover" />
                  </div>
                  <figcaption className="micro mt-4 text-ink/55">From the salons · MM Alam Road</figcaption>
                </figure>
              </div>
            );
          }
          const row = cut?.rows[pieceSlots.indexOf(s)];
          if (!row) return null;
          return (
            <div key={s.slot} className={cn('wall-col', s.col, s.offset)} data-parallax={s.parallax}>
              <div className="wall-piece group/wall" data-rise style={{ perspective: '1200px' }}>
                <div className="piece-3d relative transition-shadow duration-700 data-[lit=1]:shadow-[0_30px_60px_-30px_rgba(11,10,9,0.45)]" style={{ transformStyle: 'preserve-3d' }} data-lit="0">
                  <PieceLink product={pieceRefOf(row)} sizes="(min-width: 768px) 34vw, 92vw" aspect={s.aspect} cursor="view">
                    <span className="wall-sheen pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/piece:opacity-100" aria-hidden />
                  </PieceLink>
                  <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-500 group-hover/wall:opacity-100 focus-within:opacity-100">
                    <SaveButton slug={row.s} variant="compact" />
                  </div>
                </div>
                <div className="meta mt-4 flex items-baseline justify-between gap-4">
                  <p className="font-display text-[1rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 14' }}>
                    {row.t}
                  </p>
                  <p className="micro shrink-0 text-ink/55">{[row.k, row.w !== undefined ? `${row.w.toFixed(1)}g` : undefined].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/**
       * The gate. The wall is one screen; the departments behind it are 599 pieces, and the
       * counts are the real ones the repository publishes rather than a number written here.
       */}
      <nav aria-label="Departments" className="mt-[10svh] flex flex-col gap-4 border-t border-ink/10 pt-10 md:mt-[12svh]">
        {departments.map(({ department, count }) => (
          <a key={department} href={`/${department}`} className="group/gate flex items-baseline justify-between gap-6 text-ink/60 transition-colors hover:text-ink" data-cursor="discover" data-rise>
            <span className="display relative text-[clamp(1.5rem,3.4vw,2.75rem)] leading-tight">
              {DEPARTMENT_LABEL[department]}
              <span aria-hidden className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-ink/40 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/gate:scale-x-100" />
            </span>
            <span className="micro shrink-0 tabular-nums text-ink/45">{count} pieces</span>
          </a>
        ))}
      </nav>
    </section>
  );
}
