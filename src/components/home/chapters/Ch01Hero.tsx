'use client';

import { useCallback, useEffect, useRef } from 'react';
import { gsap, SplitText, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useSiteStore } from '@/state/siteStore';
import { useQualityStore } from '@/state/qualityStore';
import { Video, type VideoHandle } from '@/components/media/Video';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { TransitionLink } from '@/components/motion/TransitionLink';
import type { PieceRow } from '@/lib/facets';
import { ConciergeInvitation } from '@/concierge/ui/ConciergeInvitation';
import { markHeroReady } from '@/components/loader/readiness';
import { bindPointer, pointer } from '@/lib/motion/pointer';
import { COPY } from '@/data/copy';

/**
 * CH01 — the cinematic hero. Royal Wedding, candlelit. Pinned for one viewport with no
 * spacing so the craft chapter rises over its end state. The type stack ends with the
 * typographic concierge invitation; as it fades on scroll, the jewel takes over.
 */
export function Ch01Hero({ credit }: { credit?: PieceRow }) {
  const { ref, ready } = useChapter({ id: 'hero', theme: 'dark', pinned: true });
  const video = useRef<VideoHandle>(null);
  const loaderDone = useSiteStore((s) => s.loaderDone);
  const setInvitation = useSiteStore((s) => s.setHeroInvitationVisible);
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
        let invitationShown = true;
        const setShown = (v: boolean) => {
          if (invitationShown === v) return;
          invitationShown = v;
          setInvitation(v && introPlayed.current);
        };

        if (still) {
          setShown(true);
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
              onUpdate: (st) => setShown(st.progress < 0.3),
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
              setShown(st.progress < 0.22);
              document.documentElement.style.setProperty('--header-veil', String(0.1 + st.progress * 0.2));
            },
            onLeave: () => video.current?.pause(),
            onEnterBack: () => video.current?.play(),
          },
        });
        tl.to(media, { scale: 0.84, y: '-4svh', ease: 'none' }, 0)
          .to(bars, { scaleY: 0.7, ease: 'none' }, 0)
          .to(vignette, { opacity: 1, ease: 'none' }, 0)
          .to(title, { y: '-22svh', letterSpacing: '0.08em', ease: 'none' }, 0)
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
        setInvitation(true);
        return;
      }
      const tl = gsap.timeline({ delay: 0.2, onComplete: () => setInvitation(true) });
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
          onSplit: (self) => gsap.from(self.chars, { yPercent: 110, duration: 1.2, stagger: 0.03, ease: 'wj.out', delay: 0.35 }),
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
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      // a quickTo is a paused tween on the global timeline; unkilled, it holds the hero — and
      // the hero holds the video with 31 seconds of film buffered — on every visit after this
      for (const q of [tx, ty, px, py]) q.tween.kill();
    };
  }, [ref, coarse, reduced]);

  useEffect(
    () => () => {
      setInvitation(false);
      document.documentElement.style.removeProperty('--header-veil');
    },
    [setInvitation],
  );

  return (
    <section ref={ref} id="ch01" className="relative h-svh overflow-hidden bg-ink text-ivory" aria-labelledby="hero-title">
      <div className="media-scale absolute inset-0 origin-center overflow-hidden will-change-transform">
        <div className="media-parallax absolute -inset-[2%]">
          <Img id="still-royal-13" sizes="100vw" priority alt="" className="object-cover" onLoad={heroPainted} />
          <Video id="hero-royal" ref={video} onFirstFrame={heroPainted} preload="auto" revealAfter={0.55} showStill={false} ariaLabel="Royal Wedding — the Waseem film" />
        </div>
        <div className="hero-vignette pointer-events-none absolute inset-0 opacity-45" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(11,10,9,0.55) 78%, rgba(11,10,9,0.9) 100%)' }} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/30" />
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="letterbox absolute inset-x-0 top-0 h-[12svh] origin-top scale-y-[0.15] bg-ink" />
        <div className="letterbox absolute inset-x-0 bottom-0 h-[12svh] origin-bottom scale-y-[0.15] bg-ink" />
      </div>

      <div className="hero-type absolute inset-0 flex flex-col justify-end px-gutter pb-[8svh] md:pb-[9svh]">
        <div className="hero-sub flex flex-col gap-3">
          <p className="intro-eyebrow micro text-champagne opacity-0">{COPY.hero.eyebrow}</p>
          <span className="intro-hairline hairline block w-16 origin-left" />
        </div>
        <div className="hero-title-wrap mt-4 tracking-[0.02em]">
          <h1 id="hero-title" className="intro-title display text-[clamp(3.5rem,11vw,12.5rem)] leading-[0.92] tracking-[inherit] text-ivory opacity-0">
            {COPY.hero.collection}
          </h1>
        </div>
        <div className="hero-sub mt-5 max-w-[34rem]">
          <p className="intro-line font-display italic text-[clamp(1.125rem,1.6vw,1.5rem)] leading-snug text-ivory/85 opacity-0" style={{ fontVariationSettings: '"opsz" 24' }}>
            {COPY.hero.line}
          </p>
        </div>
        <div className="hero-tail mt-8">
          <div className="intro-tail flex flex-wrap items-baseline gap-x-8 gap-y-3 opacity-0">
            {/* the film's credit: the listed piece worn in it, and the door to it */}
            {credit && (
              <TransitionLink href={`/jewellery/${credit.s}`} className="group/credit flex flex-wrap items-baseline gap-x-4 gap-y-1" data-cursor="view">
                <span className="micro text-champagne">{COPY.hero.credit}</span>
                <span className="font-display italic text-[1.0625rem] text-ivory/90 transition-colors group-hover/credit:text-ivory" style={{ fontVariationSettings: '"opsz" 16' }}>
                  {credit.t}
                </span>
                <span className="micro text-ivory/55 transition-colors group-hover/credit:text-ivory">{COPY.hero.view}</span>
              </TransitionLink>
            )}
            <Button variant="hairline" href="/collections/bridal" cursor="explore" size="sm">
              {COPY.hero.cta}
            </Button>
          </div>
        </div>
        <div className="hero-tail mt-10 md:mt-12">
          <div className="intro-tail opacity-0">
            <ConciergeInvitation />
          </div>
        </div>
      </div>
    </section>
  );
}
