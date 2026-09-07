'use client';

import { useEffect, useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useParallax, useRise } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SaveButton } from '@/components/commerce/SaveButton';
import { Img } from '@/components/media/Img';
import { getProduct } from '@/data';
import { WORLDS } from '@/data/worlds';
import { COPY } from '@/data/copy';
import { formatPrice } from '@/lib/format';
import { bindPointer, pointer } from '@/lib/motion/pointer';
import { cn } from '@/lib/cn';

interface Slot {
  slot: string;
  slug?: string;
  image?: string;
  alt?: string;
  col: string;
  aspect: string;
  offset?: string;
  parallax: number;
  campaign?: boolean;
}

/** W1–W11 in reading order; W5 is a campaign image and the grid keeps whitespace on purpose. */
const SLOTS: Slot[] = [
  { slot: 'W1', slug: 'diamond-bridal-sapphire-suite', col: 'md:col-start-5 md:col-span-4', aspect: '4 / 5', parallax: 0 },
  { slot: 'W2', slug: 'lavender-halo-ring-r11912', alt: 'p09-second', col: 'md:col-start-2 md:col-span-3', aspect: '1 / 1', offset: 'md:-mt-[10svh]', parallax: -0.06 },
  { slot: 'W3', slug: 'timeless-feathered-cluster-ring', image: 'p10-macro', col: 'md:col-start-9 md:col-span-3', aspect: '4 / 5', offset: 'md:mt-[8svh]', parallax: 0.08 },
  { slot: 'W4', slug: 'aks-e-noor-satlada-haar', col: 'md:col-start-1 md:col-span-4', aspect: '4 / 5', parallax: 0.04 },
  { slot: 'W5', image: 'wall-campaign', col: 'md:col-start-7 md:col-span-6', aspect: '3 / 2', offset: 'md:mt-[22svh]', parallax: -0.05, campaign: true },
  { slot: 'W6', slug: 'emerald-tassel-earrings-t06768', col: 'md:col-start-3 md:col-span-3', aspect: '4 / 5', offset: 'md:-mt-[6svh]', parallax: 0.07 },
  { slot: 'W7', slug: 'naqsh-e-gul-pearl-blossom-choker', col: 'md:col-start-6 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[14svh]', parallax: -0.04 },
  { slot: 'W8', slug: 'dewan-bridal-suite', col: 'md:col-start-10 md:col-span-3', aspect: '4 / 5', parallax: 0.09 },
  { slot: 'W9', slug: 'rang-e-jamal-emerald-suite', col: 'md:col-start-1 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[6svh]', parallax: 0.03 },
  { slot: 'W10', slug: 'rukh-e-jana-pleated-collar', col: 'md:col-start-6 md:col-span-3', aspect: '4 / 5', offset: 'md:mt-[18svh]', parallax: -0.07 },
  { slot: 'W11', slug: 'royal-wedding-polki-raani-haar', col: 'md:col-start-9 md:col-span-4', aspect: '4 / 5', parallax: 0.05 },
];

/**
 * CH06 — the jewellery wall. Ivory, a twelve-column composition of eleven pieces with
 * whitespace. Batch reveals own the pieces, parallax owns the columns, the pointer owns
 * a three-degree tilt, lift and sheen on the hovered piece. Click flies into the product.
 */
export function Ch06Wall() {
  const { ref } = useChapter({ id: 'wall', theme: 'ivory' });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
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
  }, [ref, coarse, reduced]);

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
    <section ref={ref} id="ch06" className="relative bg-ivory px-gutter pb-[14svh] pt-[10svh] text-ink md:pb-[18svh] md:pt-[6svh]" aria-labelledby="wall-title">
      <div className="mb-[8svh] flex flex-col gap-4 md:mb-[10svh] md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3" data-rise>
          <p className="micro text-ink/60">{COPY.wall.eyebrow}</p>
          <h2 id="wall-title" className="display text-[clamp(1.75rem,3vw,3.25rem)] leading-tight text-ink">
            {COPY.wall.title}
          </h2>
        </div>
        <span className="wall-rule rule block w-full origin-left md:w-[28vw]" />
      </div>

      <div className="grid grid-cols-1 gap-x-[2vw] gap-y-[10svh] md:grid-cols-12 md:gap-y-[6svh]">
        {SLOTS.map((s) => {
          const product = s.slug ? getProduct(s.slug) : undefined;
          const world = product?.world ? WORLDS.find((w) => w.slug === product.world) : undefined;
          return (
            <div key={s.slot} className={cn('wall-col', s.col, s.offset)} data-parallax={s.parallax}>
              {product ? (
                <div className="wall-piece group/wall" data-rise style={{ perspective: '1200px' }}>
                  <div className="piece-3d relative transition-shadow duration-700 data-[lit=1]:shadow-[0_30px_60px_-30px_rgba(11,10,9,0.45)]" style={{ transformStyle: 'preserve-3d' }} data-lit="0">
                    <PieceLink product={product} imageId={s.image} sizes="(min-width: 768px) 34vw, 92vw" aspect={s.aspect} cursor="view">
                      {s.alt && (
                        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/piece:opacity-100" aria-hidden>
                          <Img id={s.alt} sizes="(min-width: 768px) 34vw, 92vw" alt="" className="object-cover" />
                        </span>
                      )}
                      <span className="wall-sheen pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/piece:opacity-100" aria-hidden />
                    </PieceLink>
                    <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-500 group-hover/wall:opacity-100 focus-within:opacity-100">
                      <SaveButton slug={product.slug} variant="compact" />
                    </div>
                  </div>
                  <div className="meta mt-4 flex items-baseline justify-between gap-4">
                    <p className="font-display text-[1rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 14' }}>
                      {product.editorialTitle}
                    </p>
                    <p className="micro shrink-0 text-ink/55">{world ? world.name : formatPrice(product.price)}</p>
                  </div>
                </div>
              ) : (
                <figure className="relative" data-rise>
                  <div className="relative w-full overflow-hidden bg-pearl" style={{ aspectRatio: s.aspect }}>
                    <Img id={s.image!} sizes="(min-width: 768px) 50vw, 92vw" className="object-cover" />
                  </div>
                  <figcaption className="micro mt-4 text-ink/55">From the salons · MM Alam Road</figcaption>
                </figure>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
