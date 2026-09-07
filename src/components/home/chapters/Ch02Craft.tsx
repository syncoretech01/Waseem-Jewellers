'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { Img } from '@/components/media/Img';
import { LoaderStone } from '@/components/loader/LoaderStone';
import { COPY } from '@/data/copy';
import { craftProgress, CRAFT_WINDOWS, stageAt } from './craftProgress';
import { cn } from '@/lib/cn';
import { useSiteStore } from '@/state/siteStore';

const CraftScene = dynamic(() => import('@/components/three/craft/CraftScene'), { ssr: false, loading: () => null });

/**
 * CH02 — the signature craft object. Pinned 450 vh; the hero's end frame dissolves as the
 * stone condenses out of the dark, then stone, setting, metal and hand finishing separate
 * beneath fixed editorial labels. The WebGL object (M5) mounts in `.craft-scene`; until then
 * the stage carries the house stone in SVG, filling with light as the visitor scrolls.
 */
export function Ch02Craft() {
  const { ref, ready } = useChapter({ id: 'craft', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const tier = useQualityStore((s) => s.tier);
  const webgl = useQualityStore((s) => s.webgl);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const stage = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [lostOnce, setLostOnce] = useState(0);
  const wantsScene = webgl && (tier === 'HIGH' || tier === 'MEDIUM') && loaderDone && near && lostOnce < 2;

  // the object mounts when the chapter is within a viewport of the visitor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setNear(true)), { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneLost = useCallback(() => {
    setSceneReady(false);
    setLostOnce((n) => n + 1);
  }, []);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
        const { mobile } = ctx.conditions as { mobile: boolean };
        const backdrop = root.querySelector<HTMLElement>('.craft-backdrop');
        const stone = root.querySelector<HTMLElement>('.craft-stone');
        const halo = root.querySelector<HTMLElement>('.craft-halo');
        const ring = root.querySelector<HTMLElement>('.craft-ring');
        const band = root.querySelector<HTMLElement>('.craft-band');
        const labels = root.querySelectorAll<HTMLElement>('.craft-label');
        const notes = root.querySelectorAll<HTMLElement>('.craft-note');
        const closing = root.querySelector<HTMLElement>('.craft-closing');
        const eyebrow = root.querySelector<HTMLElement>('.craft-eyebrow');
        if (!stone || !backdrop) return;
        const setReveal = gsap.quickSetter(stone, '--reveal');

        if (reduced) {
          gsap.set(backdrop, { opacity: 0 });
          setReveal(1);
          gsap.set([labels, notes, closing, eyebrow], { autoAlpha: 1 });
          ready();
          return;
        }

        const lit = (i: number, on: boolean) => {
          const l = labels[i];
          const n = notes[i];
          if (l) l.dataset.lit = on ? '1' : '0';
          if (n) n.dataset.lit = on ? '1' : '0';
        };

        const proxy = { p: 0 };
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: mobile ? '+=260%' : '+=450%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (st) => {
              craftProgress.value = st.progress;
              const s = stageAt(st.progress);
              craftProgress.stage = s;
              CRAFT_WINDOWS.forEach((w, i) => i > 0 && lit(i - 1, w.stage === s));
            },
          },
        });

        // 0 – .16: the hero frame dissolves; the stone condenses
        tl.to(backdrop, { opacity: 0, ease: 'none', duration: 0.08 }, 0.08)
          .fromTo(stone, { scale: 0.72, opacity: 0.35 }, { scale: 1, opacity: 1, ease: 'none', duration: 0.16 }, 0)
          .to(proxy, { p: 1, ease: 'none', duration: 0.64, onUpdate: () => setReveal(proxy.p) }, 0.04)
          .fromTo(halo, { opacity: 0, scale: 0.8 }, { opacity: 0.55, scale: 1.1, ease: 'none', duration: 0.3 }, 0.1)
          .fromTo(eyebrow, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.06 }, 0.1)
          // .12 – .30 the stone lifts
          .to(stone, { y: mobile ? '-6svh' : '-9svh', ease: 'none', duration: 0.18 }, 0.12)
          // .30 – .48 the setting separates
          .fromTo(ring, { opacity: 0, scale: 0.9 }, { opacity: 0.9, scale: 1, ease: 'none', duration: 0.1 }, 0.26)
          .to(ring, { y: mobile ? '6svh' : '9svh', ease: 'none', duration: 0.18 }, 0.3)
          // .48 – .64 the band drops
          .fromTo(band, { opacity: 0, scaleX: 0.7 }, { opacity: 0.8, scaleX: 1, ease: 'none', duration: 0.1 }, 0.44)
          .to(band, { y: mobile ? '14svh' : '22svh', ease: 'none', duration: 0.16 }, 0.48)
          // .64 – .82 hand finishing: the stone brightens, rotates a breath
          .to(stone, { rotate: 12, filter: 'brightness(1.18)', ease: 'none', duration: 0.18 }, 0.64)
          .to(halo, { opacity: 0.85, ease: 'none', duration: 0.18 }, 0.64)
          // .82 – 1 hold + pull back + closing line
          .to([stone, ring, band, halo], { scale: 0.86, y: '-6svh', ease: 'none', duration: 0.18 }, 0.82)
          .to([ring, band], { opacity: 0.12, ease: 'none', duration: 0.12 }, 0.86)
          .to(halo, { opacity: 0.35, ease: 'none', duration: 0.12 }, 0.86)
          .fromTo(closing, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.12 }, 0.86);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <section ref={ref} id="ch02" className="relative h-svh overflow-hidden bg-ink text-ivory" aria-labelledby="craft-title">
      {/* hero end-state backdrop, dissolving */}
      <div className="craft-backdrop pointer-events-none absolute inset-0">
        <div className="absolute inset-0 origin-center scale-[0.84] -translate-y-[4svh]">
          <Img id="still-royal-13" sizes="100vw" alt="" className="object-cover" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(11,10,9,0.55) 78%, rgba(11,10,9,0.9) 100%)' }} />
          <div className="absolute inset-x-0 top-0 h-[12svh] origin-top scale-y-[0.7] bg-ink" />
          <div className="absolute inset-x-0 bottom-0 h-[12svh] origin-bottom scale-y-[0.7] bg-ink" />
        </div>
      </div>

      {/* the stage */}
      <div ref={stage} className="craft-scene absolute inset-0" data-craft-scene data-webgl={sceneReady ? '1' : '0'}>
        {wantsScene && (
          <div className={cn('absolute inset-0 transition-opacity duration-700', sceneReady ? 'opacity-100' : 'opacity-0')}>
            <CraftScene key={lostOnce} onReady={onSceneReady} onLost={onSceneLost} />
          </div>
        )}
        <div className="craft-halo pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,70svh)] w-[min(70vw,70svh)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0" style={{ background: 'radial-gradient(circle, rgba(228,207,163,0.22) 0%, rgba(228,207,163,0.06) 38%, transparent 66%)' }} />
        <div className="craft-band pointer-events-none absolute left-1/2 top-1/2 h-[min(9vw,9svh)] w-[min(58vw,58svh)] -translate-x-1/2 -translate-y-1/2 rounded-[100%] opacity-0" style={{ background: 'linear-gradient(180deg, #f1e2bf 0%, #a8894f 45%, #4a3818 100%)', boxShadow: '0 12px 40px -10px rgba(0,0,0,.8)' }} />
        <div className="craft-ring pointer-events-none absolute left-1/2 top-1/2 h-[min(40vw,40svh)] w-[min(40vw,40svh)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0" style={{ border: '2px solid transparent', background: 'linear-gradient(#0b0a09,#0b0a09) padding-box, conic-gradient(from 200deg, #6e5527, #f1e2bf 30%, #a8894f 55%, #f1e2bf 80%, #6e5527) border-box', boxShadow: '0 0 40px -8px rgba(228,207,163,0.35)' }} />
        <div className="craft-stone absolute left-1/2 top-1/2 h-[min(46vw,46svh)] w-[min(46vw,46svh)] -translate-x-1/2 -translate-y-1/2" style={{ ['--reveal' as string]: 0 }}>
          <LoaderStone id="craft" />
        </div>
      </div>

      {/* editorial labels */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-gutter py-[9svh] md:py-[10svh]">
        <div className="flex items-start justify-between">
          <p className="craft-eyebrow micro text-champagne opacity-0">{COPY.craft.eyebrow}</p>
          <h2 id="craft-title" className="sr-only">
            {COPY.craft.title}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <ol className="flex flex-col gap-2 md:gap-3">
            {COPY.craft.labels.map((l) => (
              <li key={l.key} className={cn('craft-label flex items-baseline gap-4 transition-all duration-500 data-[lit=1]:translate-x-2 data-[lit=1]:opacity-100', 'opacity-25')} data-lit="0">
                <span className="font-display text-[0.75rem] text-champagne" style={{ fontVariationSettings: '"opsz" 12' }}>
                  {l.numeral}
                </span>
                <span className="micro text-ivory">{l.name}</span>
              </li>
            ))}
          </ol>
          <div className="relative min-h-[3.5rem] md:text-right">
            {COPY.craft.labels.map((l) => (
              <p key={l.key} className="craft-note absolute inset-x-0 bottom-0 font-display italic text-[1.0625rem] leading-snug text-ivory/85 opacity-0 transition-opacity duration-500 data-[lit=1]:opacity-100" style={{ fontVariationSettings: '"opsz" 16' }} data-lit="0">
                {l.note}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="craft-closing pointer-events-none absolute inset-x-0 bottom-[9svh] flex flex-col items-center opacity-0 md:bottom-[10svh]">
        <p className="display text-center text-[clamp(2rem,5vw,5rem)] leading-[1.02] text-ivory">
          {COPY.craft.closing[0]}
          <br />
          <span className="italic text-champagne">{COPY.craft.closing[1]}</span>
        </p>
      </div>
    </section>
  );
}
