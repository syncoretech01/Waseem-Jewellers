'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { COPY } from '@/data/copy';
import { craftProgress, CRAFT_WINDOWS, CRAFT_FRAMES, CRAFT_FRAME_SIZE, craftFrameFades, stageAt } from './craftProgress';
import { cn } from '@/lib/cn';
import { useSiteStore } from '@/state/siteStore';
import '@/styles/craft.css';

const CraftScene = dynamic(() => import('@/components/three/craft/CraftScene'), { ssr: false, loading: () => null });

/**
 * Whether a phone the detector calls premium (quality.ts: a recent Apple, Adreno or Mali GPU,
 * or eight gigabytes reported) carries the live object, at DPR ≤ 1.5 with the MEDIUM stone
 * (CraftScene: the flat LOW stone is never shown on a phone). Measured on the 390×844
 * emulation on this machine's Intel HD 530 (21 Sep 2026): once compiled, touch flings through
 * the chapter ran at 57–58 fps, worst frame 50–117 ms — but the compile itself, when it fell
 * under a scrolling thumb, was a one-frame second that the frame-rate monitor answered by
 * withdrawing WebGL (demoted@1), so the visitor felt the stall and then never saw the object.
 * Off: a phone gets the sequence — the same object at the highest tier, no compile, no stall
 * — and the switch stays for the day the compile has been measured on real phones. With it
 * on, the object mounts only in a still moment (`warm`), never on approach, and the sequence
 * stands beneath it until it has linked and again if the monitor lets it go.
 */
const LIVE_ON_PREMIUM_PHONES = false;

const FRAME_DIR = '/assets/waseem/images/craft';
const frameSrc = (i: number, w: number) => `${FRAME_DIR}/ring-f${i}-${w}w.webp`;
const OBJECT_ALT = 'An emerald-cut stone in a closed gold bezel with four claws, on a comfort-fit band — the object the chapter takes apart';

/**
 * CH02 — the signature craft object, and then the real thing.
 *
 * The stage is pinned while the stone condenses out of the dark, then stone, setting, metal
 * and hand finishing separate beneath fixed editorial labels. The object stands on the stage
 * in one of three forms, and only ever one:
 *
 * - live: the WebGL object in `.craft-scene`, on HIGH and MEDIUM (a desktop with a GPU);
 * - the sequence: the same object rendered once from the same scene at the highest tier
 *   into frames at each beat (scripts/assets/craft-frames.mjs), stacked in `.craft-frames`
 *   and crossfaded by the chapter's own scrub — every phone, a browser without WebGL, a
 *   context lost twice. The labels, the halo and the closing line follow the same beats, so
 *   the visitor on a phone sees the stone lift, the bezel drop, the band fall away, the
 *   polish and the turn, and the return — not a poster wearing the labels;
 * - the still: the assembled object, under reduced motion and beneath the live object while
 *   it compiles (the poster, scripts/assets/craft-poster.mjs).
 *
 * The loading ritual's drawn stone used to stand in here, and a drawing of the shop's own
 * stone surfacing over the ring for a second read as a second brand mark appearing where none
 * was meant to be. It is gone from this chapter for good; `npm run ring:check` keeps it out.
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
  const detected = useQualityStore((s) => s.detected);
  const premium = useQualityStore((s) => s.premium);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const stage = useRef<HTMLDivElement>(null);
  const framesBox = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  /** The chapter is within a viewport and a half: the sequence's frames are fetched and decoded. */
  const [approach, setApproach] = useState(false);
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
  const [sceneStarted, setSceneStarted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [lostOnce, setLostOnce] = useState(0);
  /**
   * The object is live on the tiers that can carry the emerald — HIGH and MEDIUM. LOW (a
   * phone, an integrated GPU under load, a device that demoted) shows the sequence: the same
   * object rendered at the highest tier, frame by frame, which is a premium object moving
   * rather than a lesser live stone. The client saw the flat LOW shader on a phone and
   * rightly refused it; the flat stone is never shown on a phone by any path.
   */
  const detectedTier = useQualityStore((s) => s.detectedTier);
  // the tier the device was detected at, not the one it may have demoted to: a demotion lowers
  // the object's DPR and stone, it does not swap a live object for its sequence mid-chapter
  const capable = detectedTier === 'HIGH' || detectedTier === 'MEDIUM';
  const liveAllowed = capable || (LIVE_ON_PREMIUM_PHONES && premium);
  // a desktop mounts the object on approach at the latest; a phone only in a still moment, since
  // the compile would otherwise freeze the page under a thumb, and its sequence needs no wait
  const mountNow = capable ? near || warm : warm;
  const wantsScene = webgl && !reduced && liveAllowed && loaderDone && mountNow && lostOnce < 2;
  // an object whose programs are still compiling is not unmounted under them: three polls the
  // programs from a timer, and a renderer disposed mid-compile throws from it. The frame-rate
  // monitor can withdraw WebGL from a LOW phone in exactly that second; the object then finishes
  // linking, is never shown, and goes
  const renderScene = wantsScene || (sceneStarted && !sceneReady && !reduced && lostOnce < 2);
  // an object that has gone (reduced motion switched on, WebGL withdrawn after it linked) starts
  // over if it is ever asked for again: its readiness is not carried to the next mount
  const [renderedScene, setRenderedScene] = useState(renderScene);
  if (renderedScene !== renderScene) {
    setRenderedScene(renderScene);
    if (!renderScene) {
      setSceneStarted(false);
      setSceneReady(false);
    }
  }
  const live = wantsScene && sceneReady;
  // the sequence stands wherever the live object cannot — LOW, no WebGL, a context lost twice —
  // decided once detection has run, so the SSR tree and the first paint keep the still
  const sequence = detected && !reduced && !(webgl && capable && lostOnce < 2);
  // the still stands whenever neither the object nor its sequence is on stage: before detection,
  // before the object compiles, under reduced motion — never a third thing
  const stillShown = !sequence && !live;
  const framesShown = sequence && !live;

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

  // the sequence's frames are asked for a viewport and a half out — no global preload, one
  // small fetch on approach — and decoded before the pin starts, so no frame is ever blank
  useEffect(() => {
    const el = ref.current;
    if (!el || !sequence) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setApproach(true)), { rootMargin: '150% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, sequence]);
  useEffect(() => {
    if (!approach) return;
    framesBox.current?.querySelectorAll('img').forEach((img) => {
      if (img.currentSrc || img.src) img.decode().catch(() => {});
    });
  }, [approach]);

  const onSceneStarted = useCallback(() => setSceneStarted(true), []);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneLost = useCallback(() => {
    setSceneStarted(false);
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
        const frames = root.querySelectorAll<HTMLElement>('.craft-frame');
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

        /**
         * The sequence, on the same scrub: frame i fades in and frame i−1 out across the span
         * the live object would spend moving between those two poses (craftFrameFades), so
         * the stone lifts while "Stone" is lit and the band falls while "Metal" is. Only ever
         * two frames are visible (autoAlpha hides the rest), and the pull back of the close
         * is in the frames themselves — the still's pull-back tween above is not theirs.
         */
        if (frames.length) {
          gsap.set(frames, { autoAlpha: 0 });
          gsap.set(frames[0] ?? [], { autoAlpha: 1 });
          craftFrameFades().forEach((f, i) => {
            const frame = frames[i];
            const before = frames[i - 1];
            if (i === 0 || !frame || !before) return;
            const d = f.to - f.from;
            tl.fromTo(frame, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: d, immediateRender: false }, f.from).fromTo(before, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', duration: d, immediateRender: false }, f.from);
          });
        }
        ready();
      });
    },
    // revertOnUpdate: without it useGSAP re-runs the callback on a change without reverting, and
    // a second pin lands on the same stage (measured: the spacer padded twice, the stage a pin
    // below the visitor). The frames are in the DOM from the first render, so the sequence
    // needs no rebuild: only a change of the reduced tier does.
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  );


  return (
    <section ref={ref} id="ch02-craft" className="relative bg-ink text-ivory" aria-labelledby="craft-title">
      <div className="craft-stage-wrap relative h-svh overflow-hidden">
        {/* the stage */}
        <div ref={stage} className="craft-scene absolute inset-0" data-craft-scene data-webgl={live ? '1' : '0'} data-still={stillShown ? '1' : '0'} data-frames={framesShown ? '1' : '0'} data-tier={tier}>
          {/* the still is always in the DOM; it fades under the object rather than being swapped for it */}
          <div className={cn('craft-poster pointer-events-none absolute left-1/2 top-1/2 h-[min(64vw,64svh)] w-[min(64vw,64svh)] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700', stillShown ? 'opacity-100' : 'opacity-0')} aria-hidden={!stillShown}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a still of the scene, cut by scripts/assets/craft-poster.mjs; it is not in the asset map because it is not a photograph */}
              <img
                src="/assets/waseem/images/craft/ring-1080w.webp"
                srcSet="/assets/waseem/images/craft/ring-640w.webp 640w, /assets/waseem/images/craft/ring-1080w.webp 1080w, /assets/waseem/images/craft/ring-1600w.webp 1600w"
                sizes="(min-width: 768px) 64vh, 64vw"
                alt={OBJECT_ALT}
                width={1243}
                height={1243}
                loading="eager"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
          {/* the sequence's frames are in the DOM from the first render — the timeline binds them once — and
              are only asked for where the sequence stands: the assembled frame at once, the rest on approach */}
          <div ref={framesBox} className={cn('craft-frames transition-opacity duration-700', framesShown ? 'opacity-100' : 'opacity-0')} role="img" aria-label={OBJECT_ALT} aria-hidden={!framesShown} data-craft-frames>
              {CRAFT_FRAMES.map((f, i) => {
                const wanted = sequence && (i === 0 || approach);
                return (
                  // eslint-disable-next-line @next/next/no-img-element -- a frame of the scene, cut by scripts/assets/craft-frames.mjs; not a photograph, not in the asset map
                  <img
                    key={i}
                    className="craft-frame"
                    data-frame={i}
                    data-beat={f.key}
                    src={wanted ? frameSrc(i, 1080) : undefined}
                    srcSet={wanted ? `${frameSrc(i, 640)} 640w, ${frameSrc(i, 1080)} 1080w, ${frameSrc(i, 1600)} 1600w` : undefined}
                    // the box is 75vw on a phone; a 390 px screen at DPR 2 is asked to take the 1080w set, not the 640w
                    sizes="(max-width: 767px) 90vw, 62vh"
                    alt=""
                    width={CRAFT_FRAME_SIZE.width}
                    height={CRAFT_FRAME_SIZE.height}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                );
              })}
          </div>
          {renderScene && (
            <div className={cn('absolute inset-0 transition-opacity duration-700', live ? 'opacity-100' : 'opacity-0')}>
              <CraftScene key={lostOnce} onStarted={onSceneStarted} onReady={onSceneReady} onLost={onSceneLost} />
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
