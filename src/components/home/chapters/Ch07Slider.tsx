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
import { getProduct } from '@/data';
import { WORLDS } from '@/data/worlds';
import { COPY } from '@/data/copy';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';

const ORDER = [
  'royal-wedding-polki-raani-haar',
  'rukh-e-jana-pleated-collar',
  'aks-e-noor-satlada-haar',
  'naqsh-e-gul-pearl-blossom-choker',
  'dewan-bridal-suite',
  'rang-e-jamal-emerald-suite',
  'diamond-bridal-sapphire-suite',
  'timeless-feathered-cluster-ring',
];
const N = ORDER.length;
const DELTA_PHI = 0.34;

/**
 * CH07 — the spatial collection slider. Eight pieces stand in a vitrine facing the viewer,
 * receding with depth on either side of the centre. Scroll is the truth: the wheel moves it
 * through Lenis, a drag writes the scroll position directly and releases with inertia into a
 * snap, and the arrow keys step. Enter opens the centred piece.
 */
export function Ch07Slider() {
  const { ref, ready } = useChapter({ id: 'slider', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const openProduct = useOpenProduct();
  const setFocused = useSiteStore((s) => s.setFocusedProduct);
  const [centre, setCentre] = useState(0);
  const pin = useRef<{ start: number; length: number }>({ start: 0, length: 1 });
  const current = useRef(0);
  const products = ORDER.map((s) => getProduct(s)!).filter(Boolean);

  const positionOf = useCallback((i: number) => pin.current.start + (pin.current.length * i) / (N - 1), []);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
        const { mobile } = ctx.conditions as { mobile: boolean };
        if (mobile || reduced) {
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
        let settle = 0;

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
            setAlpha[i]!(d > 2.6 ? 0 : d > 2 ? 1 - (d - 2) / 0.6 : 1);
            setShadow[i]!(Math.max(0, cos) * 0.7);
            setPlaque[i]!(Math.max(0, 1 - Math.abs(i - c) * 2.2));
          });
          const near = Math.round(c);
          if (near !== lastCentre) {
            lastCentre = near;
            setCentre(near);
            const slugs = [near, near - 1, near + 1].filter((k) => k >= 0 && k < N).map((k) => ORDER[k]!);
            overrideVisibleProducts(slugs);
            setFocused(ORDER[near] ?? null);
          }
        };

        const st = ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: `+=${N * 50}%`,
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
            window.clearTimeout(settle);
            if (root.dataset.dragging === '1' || !self.isActive || self.progress <= 0 || self.progress >= 1) return;
            settle = window.setTimeout(() => {
              const c = current.current;
              const nearest = Math.round(c);
              if (Math.abs(c - nearest) > 0.02 && !snapLocked()) snapWithLenis(positionOf(nearest), { duration: 0.6 });
            }, 240);
          },
          onLeave: () => overrideVisibleProducts(null),
          onLeaveBack: () => overrideVisibleProducts(null),
        });
        layout(0);
        ready();

        // drag: the pointer writes the scroll position; release carries inertia into a snap
        let observer: { kill: () => void } | null = null;
        let startScroll = 0;
        void loadObserver().then((Observer) => {
          if (!ctx.isActive) return;
          observer = Observer.create({
            target: root.querySelector('.vitrine-stage'),
            type: 'pointer',
            dragMinimum: 4,
            onPress: () => {
              startScroll = currentScroll();
              root.dataset.dragging = '1';
            },
            onDrag: (self) => {
              const k = pin.current.length / (N - 1) / (window.innerWidth * 0.32);
              scrollTo(startScroll - self.deltaX * k, { immediate: true });
              startScroll = currentScroll();
            },
            onRelease: (self) => {
              root.dataset.dragging = '0';
              const c = current.current;
              const v = self.velocityX;
              let projected = c - Math.max(-3.5, Math.min(3.5, v * 0.0012));
              if (Math.abs(v) > 250 && Math.abs(projected - c) < 1) projected = c - Math.sign(v);
              const target = Math.max(0, Math.min(N - 1, Math.round(projected)));
              snapWithLenis(positionOf(target), { duration: 0.55 + 0.18 * Math.abs(target - c) });
            },
          });
        });
        return () => {
          window.clearTimeout(settle);
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

  // keyboard on the stage
  const onKey = (e: React.KeyboardEvent) => {
    if (coarse || reduced) return;
    const c = Math.round(current.current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const target = Math.max(0, Math.min(N - 1, c + (e.key === 'ArrowRight' ? 1 : -1)));
      snapWithLenis(positionOf(target), { duration: 0.7 });
    } else if (e.key === 'Enter') {
      const item = ref.current?.querySelector<HTMLElement>(`[data-index="${c}"] img`);
      const slug = ORDER[c];
      if (slug) openProduct(slug, item);
    }
  };

  useEffect(() => () => overrideVisibleProducts(null), []);

  return (
    <section ref={ref} id="ch07" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-labelledby="slider-title">
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-gutter pt-[7svh]">
        <p className="micro text-champagne">{COPY.slider.eyebrow}</p>
        <h2 id="slider-title" className="sr-only">
          The Collection
        </h2>
        <p className="micro hidden text-ivory/45 md:block" aria-hidden>
          {COPY.slider.hint} · {String(centre + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
        </p>
      </div>

      {/* desktop vitrine */}
      <div
        className="vitrine-stage relative hidden h-full select-none md:block data-[dragging=1]:cursor-grabbing"
        style={{ perspective: '1400px', perspectiveOrigin: '50% 46%' }}
        role="region"
        aria-roledescription="carousel"
        aria-label="The collection"
        tabIndex={0}
        onKeyDown={onKey}
        data-cursor="drag"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42svh]" style={{ background: 'linear-gradient(180deg, transparent 0%, #0d0b0a 55%, #0B0A09 100%)' }} />
        <div className="pointer-events-none absolute left-1/2 top-[64%] h-[30svh] w-[60vw] -translate-x-1/2 rounded-[100%] opacity-70" style={{ background: 'radial-gradient(ellipse, rgba(216,195,165,0.16) 0%, rgba(216,195,165,0.04) 45%, transparent 70%)' }} />
        {products.map((p, i) => {
          const world = p.world ? WORLDS.find((w) => w.slug === p.world) : undefined;
          return (
            <div
              key={p.slug}
              className="vitrine-item absolute left-1/2 top-1/2 w-[28vw] -translate-x-1/2 -translate-y-[56%]"
              data-index={i}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="vitrine-shadow pointer-events-none absolute -bottom-[6%] left-[8%] right-[8%] h-[8%] rounded-[100%] bg-black/80 blur-xl" />
              <PieceLink
                product={p}
                sizes="28vw"
                aspect="4 / 5"
                cursor={i === centre ? 'view' : 'drag'}
                onOpen={() => undefined}
                className={cn('block', i !== centre && 'pointer-events-none')}
              >
                <span className="vitrine-wash pointer-events-none absolute inset-0 bg-ink" aria-hidden />
              </PieceLink>
              <div className="vitrine-plaque pointer-events-none mt-5 flex flex-col items-center gap-1 text-center">
                <p className="font-display text-[1.0625rem] text-ivory" style={{ fontVariationSettings: '"opsz" 16' }}>
                  {p.editorialTitle}
                </p>
                <p className="micro text-champagne/80">{world ? `${world.name} · ${formatPrice(p.price)}` : formatPrice(p.price)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* mobile: native snap */}
      <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-[12vw] pb-16 pt-[16svh] md:hidden" data-lenis-prevent-wheel>
        {products.map((p) => (
          <div key={p.slug} className="w-[76vw] shrink-0 snap-center">
            <PieceLink product={p} sizes="76vw" aspect="4 / 5" />
            <p className="mt-4 font-display text-[1rem] text-ivory" style={{ fontVariationSettings: '"opsz" 14' }}>
              {p.editorialTitle}
            </p>
            <p className="micro mt-1 text-champagne/80">{formatPrice(p.price)}</p>
          </div>
        ))}
        <div className="w-[6vw] shrink-0" aria-hidden />
      </div>
      <span className="sr-only">
        <Img id="p01-hero" sizes="1px" alt="" />
      </span>
    </section>
  );
}
