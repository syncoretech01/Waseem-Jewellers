'use client';

import { useCallback, useEffect, useRef } from 'react';
import { gsap, SplitText, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useSiteStore } from '@/state/siteStore';
import { useQualityStore } from '@/state/qualityStore';
import { Video, type VideoHandle } from '@/components/media/Video';
import { Img } from '@/components/media/Img';
import { scrollTo } from '@/state/runtime';
import { sectionElement } from '@/state/sections';
import { markHeroReady } from '@/components/loader/readiness';
import { bindPointer, pointer } from '@/lib/motion/pointer';
import { gatedTicker } from '@/lib/perf/onScreen';
import { COPY } from '@/data/copy';

/**
 * CH01 — the cinematic hero. Royal Wedding, candlelit, and the shop's own name across it:
 * a jeweller says whose window this is before it says anything else. Beneath the name, one
 * proposition and one quiet door to the window by kind — the departments are in the header
 * and the menu, and were a second navigation row here. Pinned for one viewport with no
 * spacing so the window rises over its end state.
 */
export function Ch01Hero() {
  const { ref, ready } = useChapter({ id: 'hero', theme: 'dark', pinned: true });
  const video = useRef<VideoHandle>(null);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const introPlayed = useRef(false);

  // the ritual is released by whichever of the still or the film paints first — never by the film alone
  const heroPainted = useCallback(() => markHeroReady(), []);

  // structure: pin + scrub (eager)
  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const media = root.querySelector<HTMLElement>('.media-scale');
        const bars = root.querySelectorAll<HTMLElement>('.letterbox');
        const vignette = root.querySelector<HTMLElement>('.hero-vignette');
        const title = root.querySelector<HTMLElement>('.hero-title-wrap');
        const sub = root.querySelector<HTMLElement>('.hero-sub');
        const tail = root.querySelectorAll<HTMLElement>('.hero-tail');
        if (!media || !title || !sub) return;

        if (still) {
          ready();
          return;
        }
        if (mobile) {
          // no pin: a gentle recede as the page scrolls past
          gsap.to(media, {
            y: '10svh',
            scale: 1.04,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
          ready();
          return;
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: '+=100%',
            pin: true,
            pinSpacing: false,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (st) => {
              // written on the header, not the root: a custom property on <html> recalculates
              // the style of the whole document every scrolled frame of the hero
              (document.querySelector<HTMLElement>('header[aria-label="Primary"]') ?? document.documentElement).style.setProperty('--header-veil', String(0.1 + st.progress * 0.2));
            },
            onLeave: () => video.current?.pause(),
            onEnterBack: () => video.current?.play(),
          },
        });
        tl.to(media, { scale: 0.84, y: '-4svh', ease: 'none' }, 0)
          .to(bars, { scaleY: 0.7, ease: 'none' }, 0)
          .to(vignette, { opacity: 1, ease: 'none' }, 0)
          // transform only: letter-spacing would re-lay the title out on every scrolled frame
          .to(title, { y: '-22svh', ease: 'none' }, 0)
          .fromTo(title, { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.5, immediateRender: false }, 0)
          .to(sub, { y: '6svh', ease: 'none' }, 0)
          .fromTo(tail, { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.25, immediateRender: false }, 0);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  // intro after the loading ritual (content)
  useGSAP(
    () => {
      const root = ref.current;
      if (!root || !loaderDone || introPlayed.current) return;
      introPlayed.current = true;
      const eyebrow = root.querySelector('.intro-eyebrow');
      const title = root.querySelector<HTMLElement>('.intro-title');
      const line = root.querySelector('.intro-line');
      const tail = root.querySelectorAll('.intro-tail');
      const hairline = root.querySelector('.intro-hairline');
      if (reduced) {
        gsap.set([eyebrow, title, line, tail, hairline], { autoAlpha: 1 });
        return;
      }
      const tl = gsap.timeline({ delay: 0.2 });
      tl.fromTo(eyebrow, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0)
        .fromTo(hairline, { scaleX: 0 }, { scaleX: 1, duration: 1.1 }, 0.1)
        .fromTo(line, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.55)
        .fromTo(tail, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0.8);
      if (title) {
        gsap.set(title, { autoAlpha: 1 });
        SplitText.create(title, {
          type: 'chars',
          mask: 'chars',
          aria: 'auto',
          // the split is undone once the intro has played, so its inline styles do not outlive it
          onSplit: (self) => gsap.from(self.chars, { yPercent: 110, duration: 1.2, stagger: 0.03, ease: 'wj.out', delay: 0.35, onComplete: () => self.revert() }),
        });
      }
    },
    { scope: ref, dependencies: [loaderDone, reduced] },
  );

  // pointer: the type drifts ±10px, the media counter-drifts ±1.2%
  useEffect(() => {
    const root = ref.current;
    if (!root || coarse || reduced) return;
    bindPointer();
    const type = root.querySelector<HTMLElement>('.hero-type');
    const par = root.querySelector<HTMLElement>('.media-parallax');
    if (!type || !par) return;
    const tx = gsap.quickTo(type, 'x', { duration: 0.9, ease: 'power3' });
    const ty = gsap.quickTo(type, 'y', { duration: 0.9, ease: 'power3' });
    const px = gsap.quickTo(par, 'xPercent', { duration: 1.2, ease: 'power3' });
    const py = gsap.quickTo(par, 'yPercent', { duration: 1.2, ease: 'power3' });
    const tick = () => {
      if (!pointer.active) return;
      tx(pointer.nx * 10);
      ty(pointer.ny * 10);
      px(-pointer.nx * 1.2);
      py(-pointer.ny * 1.2);
    };
    // the drift ticks only while the hero is near the screen, not on every frame of the page
    const stop = gatedTicker(root, tick, { margin: '50%' });
    return () => {
      stop();
      // a quickTo is a paused tween on the global timeline; unkilled, it holds the hero — and
      // the hero holds the video with 31 seconds of film buffered — on every visit after this
      for (const q of [tx, ty, px, py]) q.tween.kill();
    };
  }, [ref, coarse, reduced]);

  useEffect(
    () => () => {
      (document.querySelector<HTMLElement>('header[aria-label="Primary"]') ?? document.documentElement).style.removeProperty('--header-veil');
    },
    [],
  );

  return (
    <section ref={ref} id="ch01" className="relative h-svh overflow-hidden bg-ink text-ivory" aria-labelledby="hero-title">
      <div className="media-scale absolute inset-0 origin-center overflow-hidden will-change-transform">
        <div className="media-parallax absolute -inset-[2%]">
          <Img id="still-royal-13" sizes="100vw" priority alt="" className="object-cover" onLoad={heroPainted} />
          <Video id="hero-royal" ref={video} onFirstFrame={heroPainted} preload="auto" revealAfter={0.55} showStill={false} ariaLabel="Royal Wedding — the Waseem film" />
        </div>
        <div className="hero-vignette pointer-events-none absolute inset-0 opacity-45" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(11,10,9,0.55) 78%, rgba(11,10,9,0.9) 100%)' }} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 via-40% to-ink/30 md:via-transparent md:via-50%" />
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="letterbox absolute inset-x-0 top-0 h-[12svh] origin-top scale-y-[0.15] bg-ink" />
        <div className="letterbox absolute inset-x-0 bottom-0 h-[12svh] origin-bottom scale-y-[0.15] bg-ink" />
      </div>

      <div className="hero-type absolute inset-0 flex flex-col justify-end px-gutter pb-[8svh] md:pb-[9svh]">
        {/* the name, the line and the doors start on the content box's left edge — the column every chapter's title starts on */}
        <div className="wj-content">
          <div className="hero-sub flex flex-col gap-3">
            <p className="intro-eyebrow micro text-champagne opacity-0">{COPY.hero.eyebrow}</p>
            <span className="intro-hairline hairline block w-16 origin-left" />
          </div>
          <div className="hero-title-wrap mt-4 tracking-[0.02em]">
            <h1 id="hero-title" className="intro-title display text-[clamp(2.5rem,11.5vw,8.75rem)] leading-[0.92] tracking-[inherit] text-ivory opacity-0 md:whitespace-nowrap md:text-[clamp(3rem,7.4vw,8.75rem)]">
              {/* two words on a phone, one line on a desk — never a word broken across lines */}
              {COPY.hero.name.map((word, i) => (
                <span key={word}>
                  {i > 0 && ' '}
                  <span className="block md:inline">{word}</span>
                </span>
              ))}
            </h1>
          </div>
          <div className="hero-sub mt-5 max-w-[34rem]">
            <p className="intro-line font-display italic text-[clamp(1.0625rem,1.45vw,1.375rem)] leading-snug text-ivory/85 opacity-0" style={{ fontVariationSettings: '"opsz" 24' }}>
              {COPY.hero.line}
            </p>
          </div>
          {/* one quiet door: the window by kind is the next chapter, and the departments live in the header and the menu */}
          <div className="hero-tail mt-7 md:mt-8">
            <button
              type="button"
              onClick={() => {
                const el = sectionElement('vitrine');
                if (el) scrollTo(el, { duration: 1.4 });
              }}
              className="intro-tail group/door micro flex min-h-11 items-center gap-3 text-ivory/80 opacity-0 transition-colors hover:text-ivory"
              data-cursor="explore"
            >
              {COPY.hero.cta}
              <span aria-hidden className="hairline block h-px w-8 origin-left transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/door:scale-x-150" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
