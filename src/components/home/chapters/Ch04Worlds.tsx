'use client';

import { useCallback, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useFlipNavigate } from '@/motion/hooks/useFlipNavigate';
import { useFocusScroll } from '@/motion/hooks/useFocusScroll';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Img } from '@/components/media/Img';
import { UrduAccent } from '@/components/ui/primitives';
import { WORLDS } from '@/data/worlds';
import { COPY } from '@/data/copy';
import { cn } from '@/lib/cn';

const SPEEDS = [1.0, -0.55, 0.8, -0.65, 1.1];

/**
 * CH04 — signature collection worlds. Five columns of three tiles moving at opposing
 * speeds; at rest only the eyebrow and numerals speak. Hover or focus raises the world's
 * name behind the columns; choosing one flies its middle tile into the Bridal House.
 */
export function Ch04Worlds() {
  const { ref, ready } = useChapter({ id: 'collections', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const go = useFlipNavigate();
  const setSelectedWorld = useSiteStore((s) => s.setSelectedWorld);
  const [active, setActive] = useState<number | null>(null);
  const drift = useRef<Record<string, number>>({ d0: 0, d1: 0, d2: 0, d3: 0, d4: 0 });
  const pinStart = useRef(0);
  const pinLength = useRef(1);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
        const { mobile } = ctx.conditions as { mobile: boolean };
        const paper = root.querySelector<HTMLElement>('.worlds-paper');
        const cols = root.querySelectorAll<HTMLElement>('.world-col');
        const lights = root.querySelectorAll<HTMLElement>('.world-toplight');
        const columnsWrap = root.querySelector<HTMLElement>('.worlds-columns');
        if (!paper || !columnsWrap) return;

        if (mobile || reduced) {
          gsap.set(paper, { autoAlpha: 0 });
          gsap.set(columnsWrap, { clipPath: 'inset(0% 0 0 0)' });
          if (!reduced) {
            root.querySelectorAll<HTMLElement>('.world-row').forEach((row) => {
              gsap.fromTo(row.querySelectorAll('.world-tile'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: 'wj.out', scrollTrigger: { trigger: row, start: 'top 85%', once: true } });
            });
          }
          ready();
          return;
        }

        const proxy = { progress: 0 };
        const setters = [...cols].map((c) => gsap.quickSetter(c, 'y', 'px'));
        const travel = () => window.innerHeight * 0.66;
        const tick = () => {
          const t = travel();
          cols.forEach((_, i) => {
            const base = -t * 0.5 * SPEEDS[i]!;
            setters[i]!(base + proxy.progress * SPEEDS[i]! * t + (drift.current[`d${i}`] ?? 0));
          });
        };
        gsap.ticker.add(tick);
        ctx.add(() => () => gsap.ticker.remove(tick));

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: '+=280%',
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: (st) => {
              pinStart.current = st.start;
              pinLength.current = st.end - st.start;
            },
          },
        });
        // seam from the paper: the columns rise beneath it while it darkens (first 20%)
        tl.fromTo(columnsWrap, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', ease: 'none', duration: 0.2 }, 0)
          // the paper darkens like light leaving it: ivory → champagne → deep gold → ink
          .fromTo(paper, { backgroundColor: '#F4EFE6' }, { backgroundColor: '#D8C3A5', ease: 'none', duration: 0.07 }, 0)
          .to(paper, { backgroundColor: '#5a4520', ease: 'none', duration: 0.07 }, 0.07)
          .to(paper, { backgroundColor: '#0B0A09', ease: 'none', duration: 0.06 }, 0.14)
          .to(paper, { autoAlpha: 0, ease: 'none', duration: 0.02 }, 0.2)
          .fromTo(lights, { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.2 }, 0.05)
          .to(proxy, { progress: 1, ease: 'none', duration: 1 }, 0);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  useFocusScroll(
    ref,
    useCallback(() => (pinLength.current > 1 ? pinStart.current + pinLength.current * 0.45 : null), []),
  );

  const hover = (i: number | null) => {
    setActive(i);
    SPEEDS.forEach((speed, k) => {
      gsap.to(drift.current, { [`d${k}`]: i === k ? -window.innerHeight * 0.04 * Math.sign(speed) : 0, duration: 1.1, ease: 'power3.out', overwrite: true });
    });
  };

  const choose = (i: number, heroEl: HTMLElement | null) => {
    const w = WORLDS[i]!;
    setSelectedWorld(w.slug);
    go(w.href, heroEl?.querySelector('img') ?? heroEl, 'collection-hero');
  };

  const activeWorld = active !== null ? WORLDS[active] : null;

  return (
    <section ref={ref} id="ch04" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-labelledby="worlds-title">
      <div className="worlds-paper pointer-events-none absolute inset-0 z-0 bg-ivory" />

      {/* names behind the columns */}
      <div className="pointer-events-none absolute inset-0 z-[1] hidden items-center justify-center md:flex" aria-hidden>
        {WORLDS.map((w, i) => (
          <div key={w.slug} className={cn('absolute flex flex-col items-center transition-all duration-700 ease-[var(--ease-out-expo)]', active === i ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')}>
            <p className="display whitespace-nowrap text-[clamp(4rem,12vw,15rem)] leading-none text-champagne/[0.09]">{w.name}</p>
            {w.urdu && <UrduAccent text={w.urdu} className="text-[clamp(1.5rem,3vw,3rem)] text-champagne/30" />}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex items-start justify-between px-gutter pt-[7svh] md:absolute md:inset-x-0 md:top-0">
        <p className="micro text-champagne">{COPY.collections.eyebrow}</p>
        <h2 id="worlds-title" className="sr-only">
          Signature Collections
        </h2>
        <p className="micro hidden text-ivory/50 md:block">{activeWorld ? activeWorld.mood : 'Five worlds'}</p>
      </div>

      {/* desktop columns */}
      <div className="worlds-columns absolute inset-0 z-[5] hidden md:block">
        <div className="absolute inset-x-[3vw] top-0 flex h-full gap-[2vw]">
          {WORLDS.map((w, i) => (
            <div key={w.slug} className="relative flex-1">
              <span className="world-toplight hairline absolute inset-x-0 top-0 z-10" />
              <div
                className={cn('world-col relative flex flex-col gap-[2vw] transition-opacity duration-700', active !== null && active !== i && 'opacity-50')}
                onPointerEnter={() => !coarse && hover(i)}
                onPointerLeave={() => !coarse && hover(null)}
              >
                {w.imagery.column.map((id, k) => {
                  const isHero = id === w.imagery.hero;
                  const tile = (
                    <div className={cn('relative w-full overflow-hidden bg-charcoal', isHero && 'world-hero')} style={{ aspectRatio: '4 / 5' }}>
                      <div className={cn('absolute inset-0 transition-transform duration-1000 ease-[var(--ease-out-expo)]', active === i && 'scale-[1.06]')}>
                        <Img id={id} sizes="18vw" plain eager className="h-full w-full object-cover" data={isHero ? { world: w.slug } : undefined} />
                      </div>
                      {isHero && <span className={cn('pointer-events-none absolute inset-0 border border-gold-hi/40 transition-opacity duration-700', active === i ? 'opacity-100' : 'opacity-0')} />}
                    </div>
                  );
                  return isHero ? (
                    <a
                      key={id}
                      href={w.href}
                      className="block outline-none focus-visible:ring-1 focus-visible:ring-gold-hi"
                      data-cursor="explore"
                      aria-label={`${w.name} — explore the world`}
                      onFocus={() => hover(i)}
                      onBlur={() => hover(null)}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) return;
                        e.preventDefault();
                        choose(i, e.currentTarget.querySelector('.world-hero'));
                      }}
                    >
                      {tile}
                    </a>
                  ) : (
                    <div key={`${id}-${k}`} aria-hidden>
                      {tile}
                    </div>
                  );
                })}
              </div>
              <p className="pointer-events-none absolute bottom-[6svh] left-0 font-display text-[0.9375rem] text-champagne/70" style={{ fontVariationSettings: '"opsz" 14' }}>
                {w.numeral}
              </p>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[18svh] bg-gradient-to-t from-ink to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[14svh] bg-gradient-to-b from-ink to-transparent" />
      </div>

      {/* mobile: rows headed by names */}
      <div className="flex flex-col gap-14 px-gutter pb-20 pt-10 md:hidden">
        {WORLDS.map((w, i) => (
          <div key={w.slug} className="world-row">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="display text-[2.4rem] leading-none text-ivory">{w.name}</p>
              <span className="font-display text-[0.875rem] text-champagne/70">{w.numeral}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={w.href}
                className="world-tile relative block overflow-hidden bg-charcoal"
                style={{ aspectRatio: '4 / 5' }}
                onClick={(e) => {
                  e.preventDefault();
                  choose(i, e.currentTarget);
                }}
                aria-label={`${w.name} — explore the world`}
              >
                <Img id={w.imagery.hero} sizes="45vw" plain className="h-full w-full object-cover" />
              </a>
              <div className="world-tile relative overflow-hidden bg-charcoal" style={{ aspectRatio: '4 / 5' }} aria-hidden>
                <Img id={w.imagery.column[2]} sizes="45vw" plain className="h-full w-full object-cover" />
              </div>
            </div>
            <p className="mt-3 font-display italic text-[0.9375rem] text-ivory/60" style={{ fontVariationSettings: '"opsz" 14' }}>
              {w.mood}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
