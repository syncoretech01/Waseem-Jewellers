'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/motion/gsap';
import { loadObserver } from '@/lib/motion/lazyPlugins';
import { snapLocked, snapWithLenis } from '@/lib/motion/snapWithLenis';
import { useChapter } from '@/motion/hooks/useChapter';
import { useFocusScroll } from '@/motion/hooks/useFocusScroll';
import { useOpenProduct } from '@/motion/hooks/useFlipNavigate';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { overrideVisibleProducts } from '@/state/visibility';
import { currentScroll, scrollTo } from '@/state/runtime';
import { Img } from '@/components/media/Img';
import { PieceLink } from '@/components/commerce/PieceLink';
import { WORLDS } from '@/data/worlds';
import { COPY } from '@/data/copy';
import { heroOf, pieceRefOf, priceLabelOf } from '@/data/clientIndex';
import type { PieceRow } from '@/lib/facets';
import { cn } from '@/lib/cn';

const DELTA_PHI = 0.34;
/** Scroll travel per piece. Short enough that the vitrine never feels like a trap. */
const VH_PER_ITEM = 22;
/** How far the hand travels, as a share of the viewport, to bring the next piece to the centre. */
const DRAG_PER_ITEM = 0.26;

/**
 * CH07 — the spatial collection slider. Eight pieces stand in a vitrine facing the viewer,
 * receding with depth on either side of the centre.
 *
 * Scroll is the single source of truth and is never taken back from the visitor: the wheel
 * moves the vitrine continuously and nothing snaps on its own. Settling onto a piece happens
 * only on explicit intent — the arrows, the numerals, a released drag, or the arrow keys.
 */
export function Ch07Slider({ rows }: { rows: PieceRow[] }) {
  const { ref, ready } = useChapter({ id: 'slider', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const openProduct = useOpenProduct();
  const setFocused = useSiteStore((s) => s.setFocusedProduct);
  const [centre, setCentre] = useState(0);
  const [pinned, setPinned] = useState(false);
  const pin = useRef<{ start: number; length: number }>({ start: 0, length: 1 });
  const current = useRef(0);
  /**
   * The eight arrive from the server, like the wall's cuts and the vitrine's three — the
   * browser has no catalogue to look them up in, and should not.
   *
   * Every count and index below is taken from what actually resolved. The pin length used to
   * be derived from the slug list rather than from the pieces, so a withdrawn piece would
   * have left the vitrine scrubbing through a position that is not there.
   */
  const products = rows;
  const N = products.length;

  const positionOf = useCallback((i: number) => pin.current.start + (pin.current.length * i) / (N - 1), [N]);

  /** Explicit navigation — the only thing allowed to move the page on the visitor's behalf. */
  const goTo = useCallback(
    (i: number) => {
      if (!pinned || pin.current.length <= 1) return;
      const target = Math.max(0, Math.min(N - 1, i));
      const distance = Math.abs(target - current.current);
      snapWithLenis(positionOf(target), { duration: Math.min(1.1, 0.5 + 0.18 * distance) });
    },
    [pinned, positionOf, N],
  );

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        if (mobile || still) {
          ready();
          return;
        }
        const items = root.querySelectorAll<HTMLElement>('.vitrine-item');
        const washes = root.querySelectorAll<HTMLElement>('.vitrine-wash');
        const shadows = root.querySelectorAll<HTMLElement>('.vitrine-shadow');
        const plaques = root.querySelectorAll<HTMLElement>('.vitrine-plaque');
        const setX = [...items].map((el) => gsap.quickSetter(el, 'x', 'px'));
        const setZ = [...items].map((el) => gsap.quickSetter(el, 'z', 'px'));
        const setWash = [...washes].map((el) => gsap.quickSetter(el, 'opacity'));
        const setShadow = [...shadows].map((el) => gsap.quickSetter(el, 'opacity'));
        const setPlaque = [...plaques].map((el) => gsap.quickSetter(el, 'opacity'));
        const setScale = [...items].map((el) => gsap.quickSetter(el, 'scale'));
        const setAlpha = [...items].map((el) => gsap.quickSetter(el, 'opacity'));
        let lastCentre = -1;

        const layout = (c: number) => {
          const R = window.innerWidth * 1.15;
          items.forEach((_, i) => {
            const phi = (i - c) * DELTA_PHI;
            const cos = Math.cos(phi);
            const d = Math.abs(i - c);
            setX[i]!(R * Math.sin(phi));
            setZ[i]!(R * (cos - 1) * 0.55);
            setScale[i]!(0.86 + 0.14 * Math.max(0, cos));
            setWash[i]!(Math.min(0.85, 1 - cos * cos));
            setShadow[i]!(Math.max(0, cos) * 0.7);
            setPlaque[i]!(Math.max(0, 1 - d * 2.2));
            setAlpha[i]!(d > 2.6 ? 0 : d > 2 ? 1 - (d - 2) / 0.6 : 1);
          });
          const near = Math.round(c);
          if (near !== lastCentre) {
            lastCentre = near;
            setCentre(near);
            const slugs = [near, near - 1, near + 1].filter((k) => k >= 0 && k < N).map((k) => products[k]!.s);
            overrideVisibleProducts(slugs);
            setFocused(products[near]?.s ?? null);
          }
        };

        const st = ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: `+=${N * VH_PER_ITEM}%`,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            pin.current = { start: self.start, length: self.end - self.start };
            layout(self.progress * (N - 1));
          },
          onUpdate: (self) => {
            current.current = self.progress * (N - 1);
            layout(current.current);
          },
          onLeave: () => overrideVisibleProducts(null),
          onLeaveBack: () => overrideVisibleProducts(null),
        });
        layout(0);
        setPinned(true);
        ready();

        // Drag: the pointer writes the scroll position directly, and only a release settles
        // onto a piece — in the direction the visitor was actually travelling.
        let observer: { kill: () => void } | null = null;
        let startScroll = 0;
        void loadObserver().then((Observer) => {
          // gsap contexts report isReverted, not isActive — the wrong name silently killed drag
          if (ctx.isReverted) return;
          observer = Observer.create({
            target: root.querySelector('.vitrine-stage'),
            type: 'pointer',
            dragMinimum: 4,
            onPress: () => {
              startScroll = currentScroll();
              root.dataset.dragging = '1';
            },
            onDrag: (self) => {
              if (snapLocked()) return;
              const k = pin.current.length / (N - 1) / (window.innerWidth * DRAG_PER_ITEM);
              // the hand's intent accumulates: re-reading the scroll here would race Lenis's
              // own write and the drag would stand still
              const min = pin.current.start;
              const max = pin.current.start + pin.current.length;
              startScroll = Math.max(min, Math.min(max, startScroll - self.deltaX * k));
              scrollTo(startScroll, { immediate: true });
            },
            onRelease: (self) => {
              root.dataset.dragging = '0';
              const c = current.current;
              const v = self.velocityX;
              // a decisive flick leans toward the next piece rather than adding a whole one, so a
              // long haul lands where the hand left it and a short flick still carries
              const lean = v > 250 ? -0.35 : v < -250 ? 0.35 : 0;
              const target = Math.max(0, Math.min(N - 1, Math.round(c + lean)));
              snapWithLenis(positionOf(target), { duration: 0.55 });
            },
          });
        });
        return () => {
          setPinned(false);
          observer?.kill();
          st.kill();
        };
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  useFocusScroll(
    ref,
    useCallback(
      (el: HTMLElement) => {
        const i = Number(el.closest<HTMLElement>('[data-index]')?.dataset.index ?? -1);
        return i >= 0 && pin.current.length > 1 ? positionOf(i) : null;
      },
      [positionOf],
    ),
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (coarse || reduced) return;
    const c = Math.round(current.current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(c + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(N - 1);
    } else if (e.key === 'Enter') {
      const item = ref.current?.querySelector<HTMLElement>(`[data-index="${c}"] img`);
      const slug = products[c]?.s;
      if (slug) openProduct(slug, item);
    }
  };

  useEffect(() => () => overrideVisibleProducts(null), []);

  return (
    <section ref={ref} id="ch07" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-labelledby="slider-title">
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-gutter pt-[7svh]">
        <p className="micro text-champagne">{COPY.slider.eyebrow}</p>
        <h2 id="slider-title" className="sr-only">
          The Collection
        </h2>
      </div>

      {/* desktop vitrine */}
      <div
        className="vitrine-stage relative hidden h-full select-none md:block"
        style={{ perspective: '1400px', perspectiveOrigin: '50% 46%' }}
        role="region"
        aria-roledescription="carousel"
        aria-label="The collection"
        tabIndex={0}
        onKeyDown={onKey}
        /* the cards are links, and a link drags its own URL — that native drag cancels the
           pointer stream and the vitrine would answer the hand only once */
        onDragStart={(e) => e.preventDefault()}
        data-cursor="drag"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42svh]" style={{ background: 'linear-gradient(180deg, transparent 0%, #0d0b0a 55%, #0B0A09 100%)' }} />
        <div className="pointer-events-none absolute left-1/2 top-[62%] h-[30svh] w-[60vw] -translate-x-1/2 rounded-[100%] opacity-70" style={{ background: 'radial-gradient(ellipse, rgba(216,195,165,0.16) 0%, rgba(216,195,165,0.04) 45%, transparent 70%)' }} />
        {products.map((p, i) => {
          const world = p.cp ? WORLDS.find((w) => w.slug === p.cp) : undefined;
          const isCentre = i === centre;
          return (
            <div key={p.s} className="vitrine-item absolute left-1/2 top-1/2 w-[28vw] -translate-x-1/2 -translate-y-[58%]" data-index={i} style={{ transformStyle: 'preserve-3d' }}>
              <div className="vitrine-shadow pointer-events-none absolute -bottom-[6%] left-[8%] right-[8%] h-[8%] rounded-[100%] bg-black/80 blur-xl" />
              {isCentre ? (
                <PieceLink product={pieceRefOf(p)} sizes="28vw" aspect="4 / 5" cursor="view">
                  <span className="vitrine-wash pointer-events-none absolute inset-0 bg-ink" aria-hidden />
                </PieceLink>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Bring the ${p.t} to the centre`}
                  className="group/side relative block w-full outline-none focus-visible:ring-1 focus-visible:ring-gold-hi"
                  data-cursor="explore"
                >
                  <span className="relative block w-full overflow-hidden bg-bg-2" style={{ aspectRatio: '4 / 5' }}>
                    <span className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/side:scale-[1.03]">
                      <Img image={heroOf(p)} sizes="28vw" plain />
                    </span>
                    <span className="vitrine-wash pointer-events-none absolute inset-0 bg-ink" aria-hidden />
                  </span>
                </button>
              )}
              <div className="vitrine-plaque pointer-events-none mt-5 flex flex-col items-center gap-1 text-center">
                <p className="font-display text-[1.0625rem] text-ivory" style={{ fontVariationSettings: '"opsz" 16' }}>
                  {p.t}
                </p>
                <p className="micro text-champagne/80">{world ? `${world.name} · ${priceLabelOf(p)}` : priceLabelOf(p)}</p>
              </div>
            </div>
          );
        })}

        {/* the house's own hands on the vitrine */}
        <div className="vitrine-controls absolute inset-x-0 bottom-[7svh] z-20 flex flex-col items-center gap-5">
          <div className="flex items-center gap-7">
            <VitrineArrow direction="prev" disabled={centre === 0} onClick={() => goTo(centre - 1)} />
            <ol className="flex items-center" aria-label="Pieces in the vitrine">
              {products.map((p, i) => (
                <li key={p.s}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`${p.t}, piece ${i + 1} of ${N}`}
                    aria-current={i === centre ? 'true' : undefined}
                    className="group/tick block px-1.5 py-3 outline-none focus-visible:ring-1 focus-visible:ring-gold-hi"
                  >
                    <span className={cn('block h-px w-7 transition-colors duration-500', i === centre ? 'bg-gold-hi' : 'bg-ivory/25 group-hover/tick:bg-ivory/55')} />
                  </button>
                </li>
              ))}
            </ol>
            <VitrineArrow direction="next" disabled={centre === N - 1} onClick={() => goTo(centre + 1)} />
          </div>
          <p className="micro text-ivory/40" aria-hidden>
            <span className="text-champagne">{String(centre + 1).padStart(2, '0')}</span> — {String(N).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* mobile: native snap */}
      <div className="slider-rail no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-[12vw] pb-16 pt-[16svh] md:hidden" data-lenis-prevent-wheel>
        {products.map((p) => (
          <div key={p.s} className="w-[76vw] shrink-0 snap-center">
            <PieceLink product={pieceRefOf(p)} sizes="76vw" aspect="4 / 5" />
            <p className="mt-4 font-display text-[1rem] text-ivory" style={{ fontVariationSettings: '"opsz" 14' }}>
              {p.t}
            </p>
            <p className="micro mt-1 text-champagne/80">{priceLabelOf(p)}</p>
          </div>
        ))}
        <div className="w-[6vw] shrink-0" aria-hidden />
      </div>
    </section>
  );
}

/** A hairline ring with a single stroke inside it — the house's arrow. */
function VitrineArrow({ direction, disabled, onClick }: { direction: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous piece' : 'Next piece'}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full border outline-none transition-colors duration-500',
        'focus-visible:ring-1 focus-visible:ring-gold-hi',
        disabled ? 'cursor-default border-ivory/10 text-ivory/20' : 'border-ivory/30 text-ivory/70 hover:border-gold-hi hover:text-ivory',
      )}
      data-cursor={disabled ? undefined : 'explore'}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
        {direction === 'prev' ? <path d="M15 4 L7 12 L15 20" strokeLinecap="round" /> : <path d="M9 4 L17 12 L9 20" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
