'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { Img } from '@/components/media/Img';
import { LoaderStone } from '@/components/loader/LoaderStone';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { pieceRefOf, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { semanticFor } from '@/data/semantic';
import { COPY } from '@/data/copy';
import { craftProgress, CRAFT_WINDOWS, stageAt } from './craftProgress';
import { cn } from '@/lib/cn';
import { useSiteStore } from '@/state/siteStore';
import type { PieceRow } from '@/lib/facets';

const CraftScene = dynamic(() => import('@/components/three/craft/CraftScene'), { ssr: false, loading: () => null });

/**
 * CH02 — the signature craft object, and then the real thing.
 *
 * The stage is pinned while the stone condenses out of the dark, then stone, setting, metal
 * and hand finishing separate beneath fixed editorial labels. The WebGL object mounts in
 * `.craft-scene` on every tier that has WebGL at all; only a browser without it keeps the
 * drawn stone in SVG, filling with light as the visitor scrolls.
 *
 * Then the pin releases and the coda answers the drawing with a photograph: a ring Waseem
 * actually sells, its stone, halo and shank named where they sit in the one frame. The
 * object teaches the vocabulary; the coda proves it on a piece that can be opened.
 */
export function Ch02Craft({ coda }: { coda?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'craft', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const tier = useQualityStore((s) => s.tier);
  const webgl = useQualityStore((s) => s.webgl);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const stage = useRef<HTMLDivElement>(null);
  const codaScope = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [lostOnce, setLostOnce] = useState(0);
  const [lit, setLit] = useState<string | null>(null);
  /**
   * The ring is for everyone. It used to mount only on HIGH and MEDIUM, which left every
   * phone, every 4 GB laptop, every touch-first device and every reduced-motion visitor with
   * the drawn stone — a diagram where the client had been promised the object. LOW gets the
   * same geometry at DPR 1 with the non-refractive stone; REDUCED gets it settled and still.
   * Only a browser with no WebGL at all keeps the drawing.
   */
  const wantsScene = webgl && !reduced && loaderDone && near && lostOnce < 2;
  // no WebGL, or a request for stillness: the same object, rendered once from the same scene
  const poster = !webgl || reduced;
  const descriptor = coda ? semanticFor(coda.s) : undefined;
  useRise(codaScope);

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
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const wrap = root.querySelector<HTMLElement>('.craft-stage-wrap');
        const stone = root.querySelector<HTMLElement>('.craft-stone');
        const halo = root.querySelector<HTMLElement>('.craft-halo');
        const ring = root.querySelector<HTMLElement>('.craft-ring');
        const band = root.querySelector<HTMLElement>('.craft-band');
        const labels = root.querySelectorAll<HTMLElement>('.craft-label');
        const notes = root.querySelectorAll<HTMLElement>('.craft-note');
        const index = root.querySelector<HTMLElement>('.craft-index');
        const closing = root.querySelector<HTMLElement>('.craft-closing');
        const eyebrow = root.querySelector<HTMLElement>('.craft-eyebrow');
        if (!stone || !wrap) return;
        const setReveal = gsap.quickSetter(stone, '--reveal');

        if (still) {
          // composed still: the object lit, every label named, and one closing note
          // (the notes share one absolute box, so only the last may show)
          setReveal(1);
          gsap.set([labels, closing, eyebrow], { autoAlpha: 1 });
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

        const proxy = { p: 0 };
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

        // 0 – .16: the stone condenses out of the dark
        tl.fromTo(stone, { scale: 0.72, opacity: 0.35 }, { scale: 1, opacity: 1, ease: 'none', duration: 0.16 }, 0)
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
          // the closing line takes the index's place rather than printing over it — the index
          // fades as one box, so the labels and notes keep their own lit states beneath it
          .to(index, { autoAlpha: 0, ease: 'none', duration: 0.06 }, 0.84)
          .fromTo(closing, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.12 }, 0.86);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  const codaSizes = '(min-width: 768px) 46vw, 92vw';

  return (
    <section ref={ref} id="ch02-craft" className="relative bg-ink text-ivory" aria-labelledby="craft-title">
      <div className="craft-stage-wrap relative h-svh overflow-hidden">
        {/* the stage */}
        <div ref={stage} className="craft-scene absolute inset-0" data-craft-scene data-webgl={sceneReady || poster ? '1' : '0'} data-tier={tier}>
          {poster && (
            <div className="craft-poster pointer-events-none absolute left-1/2 top-1/2 h-[min(64vw,64svh)] w-[min(64vw,64svh)] -translate-x-1/2 -translate-y-1/2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a still of the scene, cut by scripts/assets/craft-poster.mjs; it is not in the asset map because it is not a photograph */}
              <img
                src="/assets/waseem/images/craft/ring-1080w.webp"
                srcSet="/assets/waseem/images/craft/ring-640w.webp 640w, /assets/waseem/images/craft/ring-1080w.webp 1080w, /assets/waseem/images/craft/ring-1600w.webp 1600w"
                sizes="(min-width: 768px) 64vh, 64vw"
                alt="An emerald-cut stone in a closed gold bezel with four claws, on a comfort-fit band — the object the chapter takes apart"
                width={1243}
                height={1243}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
          )}
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

        {/* editorial labels — the eyebrow sits beneath the nav band, never inside it */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-gutter pb-[9svh] pt-[calc(var(--nav-h)+1.25rem)] md:pb-[10svh]">
          <div className="flex items-start justify-between">
            <p className="craft-eyebrow micro text-champagne opacity-0">{COPY.craft.eyebrow}</p>
            <h2 id="craft-title" className="sr-only">
              {COPY.craft.title}
            </h2>
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

      {/* the coda: the same anatomy, photographed once, on a piece that can be opened */}
      {coda && descriptor && (
        <div ref={codaScope} className="craft-coda relative px-gutter pb-[12svh] pt-[9svh] md:pb-[13svh] md:pt-[10svh]">
          <div className="grid grid-cols-1 gap-x-[4vw] gap-y-[6svh] md:grid-cols-12 md:items-center">
            <div className="md:col-span-6" data-rise>
              <PieceLink
                product={pieceRefOf(coda)}
                sizes={codaSizes}
                aspect="1 / 1"
                cursor="view"
                className="mx-auto w-full md:w-[min(46vw,74svh)]"
                figure={
                  <SemanticFigure
                    descriptor={descriptor}
                    sizes={codaSizes}
                    flipSource={coda.s}
                    onLit={setLit}
                    fallback={
                      <div className="absolute inset-0 bg-pearl">
                        <Img image={pieceRefOf(coda).media.hero} sizes={codaSizes} plain data={{ 'flip-source': coda.s }} />
                      </div>
                    }
                  />
                }
              >
                <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <div className="flex flex-col gap-1">
                    <p className="font-display text-[1.25rem] leading-tight text-ivory" style={{ fontVariationSettings: '"opsz" 20' }}>
                      {coda.t}
                    </p>
                    <p className="micro text-ivory/55">{specLineOf(coda) || priceLabelOf(coda)}</p>
                  </div>
                  <span className="micro shrink-0 text-ivory/70 underline-offset-4 transition-colors group-hover/piece:text-ivory group-hover/piece:underline">{COPY.craft.coda.view}</span>
                </div>
              </PieceLink>
            </div>

            <div className="flex flex-col gap-6 md:col-span-5 md:col-start-8 md:gap-8">
              <div className="flex flex-col gap-4" data-rise>
                <p className="micro text-champagne">{COPY.craft.coda.eyebrow}</p>
                <p className="display text-[clamp(1.75rem,3vw,3.25rem)] leading-tight text-ivory">{COPY.craft.coda.title}</p>
                <p className="max-w-[30em] text-[0.875rem] leading-relaxed text-ivory/70">{COPY.craft.coda.line}</p>
              </div>
              {/* the index of the figure's holds, lit in step with the camera */}
              <ol className="hidden flex-col gap-3 border-t border-ivory/10 pt-6 md:flex" data-rise>
                {descriptor.regions.map((r, i) => (
                  <li key={r.key} data-lit={lit === r.key ? '1' : '0'} className="flex items-baseline gap-4 opacity-40 transition-opacity duration-500 data-[lit=1]:opacity-100">
                    <span className="font-display text-[0.75rem] text-champagne" style={{ fontVariationSettings: '"opsz" 12' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="micro text-ivory">{r.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
