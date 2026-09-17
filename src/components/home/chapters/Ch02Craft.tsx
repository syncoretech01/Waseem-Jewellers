'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { COPY } from '@/data/copy';
import { craftProgress, CRAFT_WINDOWS, stageAt } from './craftProgress';
import { cn } from '@/lib/cn';
import { useSiteStore } from '@/state/siteStore';

const CraftScene = dynamic(() => import('@/components/three/craft/CraftScene'), { ssr: false, loading: () => null });

/**
 * CH02 — the signature craft object, and then the real thing.
 *
 * The stage is pinned while the stone condenses out of the dark, then stone, setting, metal
 * and hand finishing separate beneath fixed editorial labels. The WebGL object mounts in
 * `.craft-scene` on every tier that has WebGL at all. Beneath it, at every moment the object
 * is not yet — or no longer — rendering, stands a still of the same object rendered once
 * from the same scene: the visitor sees the ring, or the ring. The loading ritual's drawn
 * stone used to stand in here, and a drawing of the shop's own stone surfacing over the ring
 * for a second — while the scene compiled, or after a lost context — read as a second brand
 * mark appearing where none was meant to be. It is gone from this chapter for good.
 *
 * Then the pin releases and the coda answers the drawing with a photograph: a ring Waseem
 * actually sells, its stone, halo and shank named where they sit in the one frame. The
 * object teaches the vocabulary; the coda proves it on a piece that can be opened.
 */
export function Ch02Craft() {
  const { ref, ready } = useChapter({ id: 'craft', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const tier = useQualityStore((s) => s.tier);
  const webgl = useQualityStore((s) => s.webgl);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const stage = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  /**
   * The object's environment is pre-filtered on the GPU when it mounts, and on an Intel
   * driver the filter shader alone compiles for the best part of a second on the main
   * thread. Mounting only when the chapter is near put that second in the middle of the
   * window chapter, under the visitor's scroll (measured: an 842 ms frame at 2.3 viewports).
   * So the object is also mounted early, at the first idle moment after the loader in which
   * the visitor is not scrolling — usually while the hero is being read — where the same
   * second passes unnoticed.
   */
  const [warm, setWarm] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [lostOnce, setLostOnce] = useState(0);
  /**
   * The ring is for everyone. It used to mount only on HIGH and MEDIUM, which left every
   * phone, every 4 GB laptop, every touch-first device and every reduced-motion visitor with
   * a diagram where the client had been promised the object. LOW gets the same geometry at
   * DPR 1 with the non-refractive stone; REDUCED, and a browser with no WebGL, get the still.
   */
  const wantsScene = webgl && !reduced && loaderDone && (near || warm) && lostOnce < 2;
  // the still stands whenever the object is not on stage: before it compiles, after a lost
  // context, under reduced motion, without WebGL — never a third thing
  const stillShown = !(wantsScene && sceneReady);

  // the object mounts early, in a still moment after the loader
  useEffect(() => {
    if (!loaderDone || !webgl || reduced) return;
    let lastScroll = performance.now();
    const onScroll = () => (lastScroll = performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    let handle = 0;
    let cancelled = false;
    const ric: (cb: () => void, opts?: { timeout: number }) => number = 'requestIdleCallback' in window ? (cb, opts) => window.requestIdleCallback(cb, opts) : (cb) => window.setTimeout(cb, 300);
    const cancel: (h: number) => void = 'cancelIdleCallback' in window ? (h) => window.cancelIdleCallback(h) : (h) => window.clearTimeout(h);
    const poll = () => {
      if (cancelled) return;
      if (performance.now() - lastScroll > 900) {
        setWarm(true);
        return;
      }
      handle = ric(poll, { timeout: 1500 });
    };
    handle = ric(poll, { timeout: 2500 });
    return () => {
      cancelled = true;
      cancel(handle);
      window.removeEventListener('scroll', onScroll);
    };
  }, [loaderDone, webgl, reduced]);

  // and in any case when the chapter is within a viewport of the visitor
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
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const wrap = root.querySelector<HTMLElement>('.craft-stage-wrap');
        const halo = root.querySelector<HTMLElement>('.craft-halo');
        const labels = root.querySelectorAll<HTMLElement>('.craft-label');
        const notes = root.querySelectorAll<HTMLElement>('.craft-note');
        const index = root.querySelector<HTMLElement>('.craft-index');
        const posterImg = root.querySelector<HTMLElement>('.craft-poster img');
        const closing = root.querySelector<HTMLElement>('.craft-closing');
        const eyebrow = root.querySelectorAll<HTMLElement>('.craft-eyebrow');
        if (!wrap || !halo) return;

        if (still) {
          // composed still: the object lit, every label named, and one closing note
          // (the notes share one absolute box, so only the last may show)
          gsap.set(halo, { opacity: 0.55 });
          gsap.set([labels, eyebrow], { autoAlpha: 1 });
          gsap.set(closing, { autoAlpha: 0 });
          gsap.set(notes, { autoAlpha: 0 });
          const lastNote = notes[notes.length - 1];
          if (lastNote) gsap.set(lastNote, { autoAlpha: 1 });
          labels.forEach((l) => (l.dataset.lit = '1'));
          ready();
          return;
        }

        const lit = (i: number, on: boolean) => {
          const l = labels[i];
          const n = notes[i];
          if (l) l.dataset.lit = on ? '1' : '0';
          if (n) n.dataset.lit = on ? '1' : '0';
        };

        const tl = gsap.timeline({
          scrollTrigger: {
            // the stage pins, not the section: the coda beneath it scrolls in when the pin releases
            trigger: wrap,
            start: 'top top',
            end: mobile ? '+=140%' : '+=155%',
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

        // the light rises as the object condenses out of the dark; the object itself is the
        // scene's (or the still's) — nothing drawn stands beside it
        tl.fromTo(halo, { opacity: 0, scale: 0.8 }, { opacity: 0.55, scale: 1.1, ease: 'none', duration: 0.3 }, 0.1)
          .fromTo(eyebrow, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.06 }, 0.1)
          // .64 – .82 hand finishing: the light brightens
          .to(halo, { opacity: 0.85, ease: 'none', duration: 0.18 }, 0.64)
          // .82 – 1 hold + pull back + closing line
          .to([halo, posterImg].filter(Boolean), { scale: 0.86, y: '-6svh', ease: 'none', duration: 0.18 }, 0.82)
          .to(halo, { opacity: 0.35, ease: 'none', duration: 0.12 }, 0.86)
          // the closing line takes the index's place rather than printing over it — the index
          // fades as one box, so the labels and notes keep their own lit states beneath it
          .to(index, { autoAlpha: 0, ease: 'none', duration: 0.06 }, 0.84)
          .fromTo(closing, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.12 }, 0.86);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );


  return (
    <section ref={ref} id="ch02-craft" className="relative bg-ink text-ivory" aria-labelledby="craft-title">
      <div className="craft-stage-wrap relative h-svh overflow-hidden">
        {/* the stage */}
        <div ref={stage} className="craft-scene absolute inset-0" data-craft-scene data-webgl={wantsScene && sceneReady ? '1' : '0'} data-still={stillShown ? '1' : '0'} data-tier={tier}>
          {/* the still is always in the DOM; it fades under the object rather than being swapped for it */}
          <div className={cn('craft-poster pointer-events-none absolute left-1/2 top-1/2 h-[min(64vw,64svh)] w-[min(64vw,64svh)] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700', stillShown ? 'opacity-100' : 'opacity-0')} aria-hidden={!stillShown}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a still of the scene, cut by scripts/assets/craft-poster.mjs; it is not in the asset map because it is not a photograph */}
              <img
                src="/assets/waseem/images/craft/ring-1080w.webp"
                srcSet="/assets/waseem/images/craft/ring-640w.webp 640w, /assets/waseem/images/craft/ring-1080w.webp 1080w, /assets/waseem/images/craft/ring-1600w.webp 1600w"
                sizes="(min-width: 768px) 64vh, 64vw"
                alt="An emerald-cut stone in a closed gold bezel with four claws, on a comfort-fit band — the object the chapter takes apart"
                width={1243}
                height={1243}
                loading="eager"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
          {wantsScene && (
            <div className={cn('absolute inset-0 transition-opacity duration-700', sceneReady ? 'opacity-100' : 'opacity-0')}>
              <CraftScene key={lostOnce} onReady={onSceneReady} onLost={onSceneLost} />
            </div>
          )}
          <div className="craft-halo pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,70svh)] w-[min(70vw,70svh)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0" style={{ background: 'radial-gradient(circle, rgba(228,207,163,0.22) 0%, rgba(228,207,163,0.06) 38%, transparent 66%)' }} />
        </div>

        {/* editorial labels — the eyebrow sits beneath the nav band, never inside it */}
        <div className="wj-row pointer-events-none absolute inset-0 flex flex-col justify-between px-gutter pb-[9svh] pt-[calc(var(--nav-h)+1.25rem)] md:pb-[10svh]">
          <div className="flex items-start justify-between gap-6">
            <p className="craft-eyebrow micro text-champagne opacity-0">{COPY.craft.eyebrow}</p>
            <h2 id="craft-title" className="sr-only">
              {COPY.craft.title}
            </h2>
            {/* the object is a study; the ring Waseem sells follows in the next chapter */}
            <p className="craft-eyebrow micro hidden max-w-[30em] text-right text-ivory/50 opacity-0 md:block">{COPY.craft.note}</p>
          </div>
          <div className="craft-index grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
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
      </div>

    </section>
  );
}
