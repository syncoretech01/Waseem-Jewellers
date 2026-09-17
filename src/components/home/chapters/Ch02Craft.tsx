'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { Img } from '@/components/media/Img';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { RingStudy } from '@/semantic/moments/RingStudy';
import { studyFor } from '@/data/moments';
import { pieceRefOf } from '@/data/clientIndex';
import { tagOf } from './showcase';
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
   * a diagram where the client had been promised the object. LOW gets the same geometry at
   * DPR 1 with the non-refractive stone; REDUCED, and a browser with no WebGL, get the still.
   */
  const wantsScene = webgl && !reduced && loaderDone && near && lostOnce < 2;
  // the still stands whenever the object is not on stage: before it compiles, after a lost
  // context, under reduced motion, without WebGL — never a third thing
  const stillShown = !(wantsScene && sceneReady);
  const descriptor = coda ? semanticFor(coda.s) : undefined;
  const study = coda ? studyFor(coda.s) : undefined;
  // the index beside the figure: the study's three beats, or the figure's holds
  const index = study ? COPY.craft.coda.beats.map((label, i) => ({ key: (['drawn', 'made', 'turned'] as const)[i]!, label })) : (descriptor?.regions ?? []).map((r) => ({ key: r.key, label: r.label }));
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
        const halo = root.querySelector<HTMLElement>('.craft-halo');
        const labels = root.querySelectorAll<HTMLElement>('.craft-label');
        const notes = root.querySelectorAll<HTMLElement>('.craft-note');
        const index = root.querySelector<HTMLElement>('.craft-index');
        const posterImg = root.querySelector<HTMLElement>('.craft-poster img');
        const closing = root.querySelector<HTMLElement>('.craft-closing');
        const eyebrow = root.querySelector<HTMLElement>('.craft-eyebrow');
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

  const codaSizes = '(min-width: 768px) 46vw, 92vw';

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
      {coda && (study || descriptor) && (
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
                  study ? (
                    <RingStudy study={study} slug={coda.s} sizes={codaSizes} onBeat={setLit} />
                  ) : descriptor ? (
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
                  ) : null
                }
              >
                <div className="mt-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <div className="flex flex-col gap-1">
                    <p className="font-display text-[1.25rem] leading-tight text-ivory" style={{ fontVariationSettings: '"opsz" 20' }}>
                      {coda.t}
                    </p>
                    <p className="micro text-ivory/55">{tagOf(coda)}</p>
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
                {index.map((r, i) => (
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
