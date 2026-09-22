'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { COPY } from '@/data/copy';
import { craftProgress, CRAFT_WINDOWS, CRAFT_LAYERS, CRAFT_FRAME_SIZE, stageAt, layersFor, type CraftStage, type CraftLayer } from './craftProgress';
import { cn } from '@/lib/cn';
import { useSiteStore } from '@/state/siteStore';
import { useMediaQuery } from '@/lib/useMediaQuery';
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
 * Off: a phone gets the states — the same object at the highest tier, no compile, no stall
 * — and the switch stays for the day the compile has been measured on real phones. With it
 * on, the object mounts only in a still moment (`warm`), never on approach, and the states
 * stand beneath it until it has linked and again if the monitor lets it go.
 */
const LIVE_ON_PREMIUM_PHONES = false;

const LAYER_DIR = '/assets/waseem/images/craft';
const layerSrc = (key: CraftLayer, w: number) => `${LAYER_DIR}/ring-${key}-${w}w.webp`;
const OBJECT_ALT = 'An emerald-cut stone in a closed gold bezel with four claws, on a comfort-fit band — the object the chapter takes apart';
/** The beats in order, the labels being the five after the assembled hold. */
const BEATS = CRAFT_WINDOWS.map((w) => w.stage);

/** One layer of the object: a still of the scene, cut by scripts/assets/craft-frames.mjs — not a photograph, not in the asset map. */
function LayerImage({ layer, wanted }: { layer: CraftLayer; wanted: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a layer of the scene, not a photograph
    <img
      className="craft-state"
      data-layer={layer}
      src={wanted ? layerSrc(layer, 1080) : undefined}
      srcSet={wanted ? `${layerSrc(layer, 640)} 640w, ${layerSrc(layer, 1080)} 1080w, ${layerSrc(layer, 1600)} 1600w` : undefined}
      // the box is 64vw on a phone: a 390 px screen at DPR 3 takes the 1080w set, and a 430 px one too
      sizes="(max-width: 767px) 64vw, 52vh"
      alt=""
      width={CRAFT_FRAME_SIZE.width}
      height={CRAFT_FRAME_SIZE.height}
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * CH02 — the signature craft object, and then the real thing.
 *
 * The object stands on the stage in one of three forms, and only ever one:
 *
 * - live: the WebGL object in `.craft-scene`, on HIGH and MEDIUM (a desktop with a GPU),
 *   under the chapter's pinned, scrubbed timeline — the stone condenses out of the dark, then
 *   stone, setting, metal and hand finishing separate beneath fixed editorial labels;
 * - the layers: the same object rendered once from the same scene at the highest tier as
 *   four stills from one camera at one angle — the stone, the setting and the band each alone
 *   at rest, and the whole ring polished (scripts/assets/craft-frames.mjs) — stacked in
 *   `.craft-states`. A beat moves a layer by a CSS transform (the stone lifts, the setting
 *   drops, the band falls away), the finish dissolves the three into the polished whole, and
 *   the close pulls the box back — every phone, a browser without WebGL, a context lost twice.
 *   The labels, the halo and the closing line change with the same beat, from the same write,
 *   so the word and the object always agree;
 * - the still: the assembled object, under reduced motion and beneath the live object while
 *   it compiles (the poster, scripts/assets/craft-poster.mjs).
 *
 * On a phone the chapter is mobile-native (22 Sep 2026): the section is a runway of a few
 * viewports, the stage sticks to its top by CSS, and the beat is the band of the runway that
 * the viewport's centre line is in, read by an IntersectionObserver — no pin, no scrub,
 * nothing fixed and unfixed under the thumb, no layout read in any frame, no touch listener.
 * The pinned, scrubbed sequence that stood here before was measured on the live build at
 * 390×844 and 430×932 (.cache/s22/craft2/repro): the pin's flips jumped the stage by 15–25 px
 * at each end of a fling, the labels lit from the raw scroll while the frames followed a
 * scrub 0.6 s behind it, so "Stone" was lit over the assembled ring, and every crossfade of
 * the twenty-three frames dissolved two whole rings at different angles — two bands, two
 * stones, two bezels, at full brightness — which is what the visitor saw after every thumb.
 *
 * The loading ritual's drawn stone used to stand in here, and a drawing of the shop's own
 * stone surfacing over the ring for a second read as a second brand mark appearing where none
 * was meant to be. It is gone from this chapter for good; `npm run ring:check` keeps it out.
 */
export function Ch02Craft() {
  // on a phone nothing pins: the section registry can keep the chapter's box from its observer
  // rather than reading it in every scroll, as it does for a chapter that moves with the viewport
  const phone = useMediaQuery('(max-width: 767px)');
  const { ref, ready } = useChapter({ id: 'craft', theme: 'dark', pinned: !phone });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const tier = useQualityStore((s) => s.tier);
  const webgl = useQualityStore((s) => s.webgl);
  const detected = useQualityStore((s) => s.detected);
  const premium = useQualityStore((s) => s.premium);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const wrap = useRef<HTMLDivElement>(null);
  const statesBox = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  /** The chapter is within a viewport: the layers are fetched and decoded before the stage sticks. */
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
   * phone, an integrated GPU under load, a device that demoted) shows the states: the same
   * object rendered at the highest tier, which is a premium object rather than a lesser live
   * stone. The client saw the flat LOW shader on a phone and rightly refused it; the flat
   * stone is never shown on a phone by any path.
   */
  const detectedTier = useQualityStore((s) => s.detectedTier);
  // the tier the device was detected at, not the one it may have demoted to: a demotion lowers
  // the object's DPR and stone, it does not swap a live object for its states mid-chapter
  const capable = detectedTier === 'HIGH' || detectedTier === 'MEDIUM';
  const liveAllowed = capable || (LIVE_ON_PREMIUM_PHONES && premium);
  // a desktop mounts the object on approach at the latest; a phone only in a still moment, since
  // the compile would otherwise freeze the page under a thumb, and its states need no wait
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
  // the states stand wherever the live object cannot — LOW, no WebGL, a context lost twice —
  // decided once detection has run, so the SSR tree and the first paint keep the still
  const sequence = detected && !reduced && !(webgl && capable && lostOnce < 2);
  /**
   * The three parts at rest have arrived and are decoded: the layers can take the stage from
   * the still. They are asked for as soon as the layers are the object's form (at detection,
   * on a phone: three small fetches during the hero) — and the still, which is in the first
   * HTML, stands until they have, so the stage is never empty and the hand-over is a dissolve
   * between the same ring at the same angle.
   */
  const [restReady, setRestReady] = useState(false);
  // the still stands whenever neither the object nor its layers are on stage: before detection,
  // before the layers have arrived, before the object compiles, under reduced motion — never a third thing
  const statesShown = sequence && restReady && !live;
  const stillShown = !statesShown && !live;

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

  // the polished whole is asked for a viewport out — no global preload, one small fetch on
  // approach — and decoded before the stage sticks, so the finish is never an empty stage. A
  // margin of a viewport and a half would already reach the chapter from the top of the page
  // on a phone and put the fetch under the hero's own
  useEffect(() => {
    const el = ref.current;
    if (!el || !sequence) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setApproach(true)), { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, sequence]);
  useEffect(() => {
    if (!sequence) return;
    let cancelled = false;
    const rest = [...(statesBox.current?.querySelectorAll<HTMLImageElement>('.craft-layers img') ?? [])];
    void Promise.all(rest.map((img) => img.decode().catch(() => {}))).then(() => {
      if (!cancelled) setRestReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sequence]);
  useEffect(() => {
    if (!approach) return;
    statesBox.current?.querySelectorAll('img').forEach((img) => {
      if (img.currentSrc || img.src) img.decode().catch(() => {});
    });
  }, [approach]);

  /**
   * The one writer of the beat. It writes the stage onto the sticky wrap (`data-stage`, which
   * the sheet turns into the dissolve, the box's move, the halo, the eyebrow and the closing
   * line on a phone), lights the label and the note of the beat, and tells the live object's
   * progress record. A beat whose image has not arrived — a slow connection, a reload inside the
   * chapter — waits for it: the word and the object change together or not at all.
   */
  const stageNow = useRef<CraftStage>('assembled');
  const stageWanted = useRef<CraftStage>('assembled');
  const applyStage = useCallback((s: CraftStage) => {
    stageWanted.current = s;
    const commit = () => {
      if (stageWanted.current !== s || stageNow.current === s) return;
      stageNow.current = s;
      craftProgress.stage = s;
      const root = wrap.current;
      if (!root) return;
      root.dataset.stage = s;
      const labels = root.querySelectorAll<HTMLElement>('.craft-label');
      const notes = root.querySelectorAll<HTMLElement>('.craft-note');
      BEATS.forEach((beat, i) => {
        if (i === 0) return;
        const on = beat === s ? '1' : '0';
        const l = labels[i - 1];
        const n = notes[i - 1];
        if (l) l.dataset.lit = on;
        if (n) n.dataset.lit = on;
      });
    };
    const waiting = layersFor(s)
      .map((k) => statesBox.current?.querySelector<HTMLImageElement>(`.craft-state[data-layer="${k}"]`))
      .filter((img): img is HTMLImageElement => !!img && !!img.getAttribute('src') && !img.complete);
    if (waiting.length) {
      void Promise.all(waiting.map((img) => img.decode().catch(() => {}))).then(commit);
      return;
    }
    commit();
  }, []);
  // a beat asked for before its image had a source (a reload inside the chapter) is applied
  // once the sources are in place
  useEffect(() => {
    if (approach && stageWanted.current !== stageNow.current) applyStage(stageWanted.current);
  }, [approach, applyStage]);

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
        const stage = root.querySelector<HTMLElement>('.craft-stage-wrap');
        const halo = root.querySelector<HTMLElement>('.craft-halo');
        const labels = root.querySelectorAll<HTMLElement>('.craft-label');
        const notes = root.querySelectorAll<HTMLElement>('.craft-note');
        const index = root.querySelector<HTMLElement>('.craft-index');
        const posterImg = root.querySelector<HTMLElement>('.craft-poster img');
        const closing = root.querySelector<HTMLElement>('.craft-closing');
        const eyebrow = root.querySelectorAll<HTMLElement>('.craft-eyebrow');
        if (!stage || !halo) return;

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

        if (mobile) {
          /**
           * The phone: the beat is the band of the runway under the viewport's centre line. The
           * observer watches a slab one per cent of the viewport tall at the centre; the bands
           * are contiguous, so the slab is always in exactly one of them except for the frame in
           * which it crosses a boundary, where the deeper cut wins. Nothing here runs per frame:
           * the observer speaks only when a band's edge crosses the slab.
           */
          const bands = [...root.querySelectorAll<HTMLElement>('.craft-beat')];
          // the beat is the band holding the deeper cut of the slab, measured when a band's edge
          // crosses it — six boxes read in the observer's own callback, after layout, a few
          // times per beat and never in a frame of the scroll. An even cut (an edge on the
          // slab's centre) goes to the later band: a beat begins at its band's top edge
          const io = new IntersectionObserver(
            (entries) => {
              const slab = entries[0]?.rootBounds;
              if (!slab) return;
              let best = -1;
              let depth = 0;
              bands.forEach((b, i) => {
                const r = b.getBoundingClientRect();
                const cut = Math.min(r.bottom, slab.bottom) - Math.max(r.top, slab.top);
                if (cut > 0 && cut >= depth) {
                  best = i;
                  depth = cut;
                }
              });
              const beat = bands[best]?.dataset.beat as CraftStage | undefined;
              if (beat) applyStage(beat);
            },
            { rootMargin: '-49.5% 0px -49.5% 0px', threshold: 0 },
          );
          bands.forEach((b) => io.observe(b));
          ready();
          return () => io.disconnect();
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            // the stage pins, not the section: the chapter beneath it scrolls in when the pin releases
            trigger: stage,
            start: 'top top',
            end: '+=155%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (st) => {
              craftProgress.value = st.progress;
              applyStage(stageAt(st.progress));
            },
          },
        });

        // the light rises as the object condenses out of the dark; the object itself is the
        // scene's (or the still's, or the states') — nothing drawn stands beside it
        tl.fromTo(halo, { opacity: 0, scale: 0.8 }, { opacity: 0.55, scale: 1.1, ease: 'none', duration: 0.3 }, 0.1)
          .fromTo(eyebrow, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.06 }, 0.1)
          // .64 – .82 hand finishing: the light brightens
          .to(halo, { opacity: 0.85, ease: 'none', duration: 0.18 }, 0.64)
          // .82 – 1 hold + pull back + closing line (the states' own pull back is the box's transform)
          .to([halo, posterImg].filter(Boolean), { scale: 0.86, y: '-6svh', ease: 'none', duration: 0.18 }, 0.82)
          .to(halo, { opacity: 0.35, ease: 'none', duration: 0.12 }, 0.86)
          // the closing line takes the index's place rather than printing over it — the index
          // fades as one box, so the labels and notes keep their own lit states beneath it
          .to(index, { autoAlpha: 0, ease: 'none', duration: 0.06 }, 0.84)
          .fromTo(closing, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.12 }, 0.86);
        ready();
      });
    },
    // revertOnUpdate: without it useGSAP re-runs the callback on a change without reverting, and
    // a second pin lands on the same stage (measured: the spacer padded twice, the stage a pin
    // below the visitor). The states are in the DOM from the first render, so they need no
    // rebuild: only a change of the reduced tier does.
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <section ref={ref} id="ch02-craft" className="relative bg-ink text-ivory" aria-labelledby="craft-title">
      {/* the runway's bands, on a phone: the beat is the band under the viewport's centre line */}
      <div className="craft-runway" aria-hidden>
        {BEATS.map((beat) => (
          <div key={beat} className="craft-beat" data-beat={beat} />
        ))}
      </div>
      <div ref={wrap} className="craft-stage-wrap relative h-svh overflow-hidden" data-stage="assembled">
        {/* the stage */}
        <div className="craft-scene absolute inset-0" data-craft-scene data-webgl={live ? '1' : '0'} data-still={stillShown ? '1' : '0'} data-states={statesShown ? '1' : '0'} data-tier={tier}>
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
          {/* the layers are in the DOM from the first render and are only asked for where they stand:
              the three parts at rest once the layers are the object's form, the polished whole on
              approach, a viewport out. The three parts stack in their own group (the band beneath
              the setting beneath the stone) and the polished whole lies over the group; a beat moves a
              part, the finish dissolves the group into the whole (src/styles/craft.css) */}
          <div ref={statesBox} className={cn('craft-states transition-opacity duration-700', statesShown ? 'opacity-100' : 'opacity-0')} role="img" aria-label={OBJECT_ALT} aria-hidden={!statesShown} data-craft-states>
            <div className="craft-layers">
              {CRAFT_LAYERS.filter((l) => l.key !== 'polished').map((l) => (
                <LayerImage key={l.key} layer={l.key} wanted={sequence} />
              ))}
            </div>
            <LayerImage layer="polished" wanted={sequence && approach} />
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
