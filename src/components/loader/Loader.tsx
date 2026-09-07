'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { gsap, ScrollTrigger, SplitText } from '@/lib/motion/gsap';
import { useSiteStore } from '@/state/siteStore';
import { startScroll, stopScroll } from '@/state/runtime';
import { LoaderStone } from './LoaderStone';
import { fontsReady, heroReady } from './readiness';
import { useQualityStore } from '@/state/qualityStore';

type GemComponent = ComponentType<{ progress: () => number; exiting: () => boolean; onFirstFrame?: () => void }>;
const DEV = process.env.NODE_ENV === 'development';

/**
 * The loading ritual (CH00). Server-rendered so the first paint is already ink; runs once per
 * document load. Home: hairline, wordmark, SINCE 1952 and the stone filling with light, then the
 * hand-off to the hero. Any other route: a 0.6 s lift. Returning visitors get the short path.
 */
export function Loader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const setLoaderDone = useSiteStore((s) => s.setLoaderDone);
  const isHome = pathname === '/';
  const progressRef = useRef(0);
  const exitingRef = useRef(false);
  const [Gem, setGem] = useState<GemComponent | null>(null);
  const [gemShown, setGemShown] = useState(false);
  const tier = useQualityStore((s) => s.tier);
  const webgl = useQualityStore((s) => s.webgl);
  const detected = useQualityStore((s) => s.detected);

  // Progressive enhancement: the stone's chunk is requested the moment the ritual mounts
  // (400 ms in production; development compiles on demand and gets longer). It joins only on
  // the high tier with WebGL, and only while the facets are still filling.
  const chunk = useRef<Promise<GemComponent | null> | null>(null);
  useEffect(() => {
    if (!isHome || chunk.current || document.documentElement.hasAttribute('data-rm')) return;
    const started = performance.now();
    chunk.current = Promise.race([import('./LoaderGem').then((m) => m.LoaderGem), new Promise<null>((r) => setTimeout(() => r(null), DEV ? 2500 : 400))]).then((mod) => {
      if (DEV) console.info(`[loader] stone chunk ${mod ? 'arrived' : 'late'} after ${Math.round(performance.now() - started)} ms (t=${Math.round(performance.now())})`);
      return mod;
    });
  }, [isHome]);
  useEffect(() => {
    if (!isHome || !detected || !webgl || tier !== 'HIGH' || !chunk.current) return;
    let cancelled = false;
    void chunk.current.then((mod) => {
      const joins = !cancelled && !!mod && progressRef.current < (DEV ? 0.97 : 0.75);
      if (DEV) console.info(`[loader] stone ${joins ? 'joins' : 'skipped'} at t=${Math.round(performance.now())} (progress ${progressRef.current.toFixed(2)}, tier ${tier})`);
      if (joins && mod) setGem(() => mod);
    });
    return () => {
      cancelled = true;
    };
  }, [isHome, detected, webgl, tier]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const html = document.documentElement;
    const reduced = html.hasAttribute('data-rm');
    try {
      localStorage.setItem('wj:visited', String(Date.now()));
    } catch {
      /* private mode */
    }
    stopScroll();
    let cancelled = false;
    const ctx = gsap.context(() => undefined, el);

    const finish = (exitDuration: number) => {
      if (cancelled) return;
      exitingRef.current = true;
      setLoaderDone(true);
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.lagSmoothing(0);
          startScroll();
          ScrollTrigger.refresh();
          setMounted(false);
        },
      });
      if (isHome && !reduced) {
        tl.to(el.querySelector('.ritual-stone'), { scale: 1.16, filter: 'brightness(1.5)', duration: 0.9, ease: 'power2.in' }, 0)
          .to(el.querySelectorAll('.ritual-fade'), { opacity: 0, duration: 0.35, ease: 'none' }, 0.15)
          .to(el, { opacity: 0, duration: exitDuration, ease: 'power2.inOut' }, 0.45);
      } else {
        tl.to(el, { opacity: 0, duration: exitDuration, ease: 'power1.inOut' });
      }
    };

    ctx.add(() => {
      if (!isHome) {
        void fontsReady(600).then(() => finish(0.45));
        return;
      }
      if (reduced) {
        void Promise.all([fontsReady(), heroReady(), new Promise((r) => setTimeout(r, 400))]).then(() => finish(0.3));
        return;
      }
      // Lag smoothing is off for Lenis, so a tween created during the hydration stall would inherit a stale
      // clock and jump ahead on the first tick. The ritual is built on the tick after mount (after GSAP's own
      // root update) with smoothing on until the hand-off; scrolling is frozen meanwhile.
      gsap.ticker.add(
        () => {
          gsap.ticker.lagSmoothing(500, 33);
          build();
        },
        true,
      );
      return;
    });

    function build() {
      if (cancelled || !el) return;
      const returning = html.hasAttribute('data-visited');
      el.dataset.built = '1';
      const minTime = returning ? 0.7 : 1.9;
      if (DEV) console.info(`[loader] ritual starts at t=${Math.round(performance.now())} (${returning ? 'returning' : 'first visit'})`);
      const stone = el.querySelector<HTMLElement>('.ritual-stone');
      const hairline = el.querySelector<HTMLElement>('.ritual-hairline');
      const light = el.querySelector<HTMLElement>('.ritual-light');
      const since = el.querySelector<HTMLElement>('.ritual-since');
      const word = el.querySelector<HTMLElement>('.ritual-word');
      const progress = { v: 0 };
      const setReveal = gsap.quickSetter(stone!, '--reveal');
      const write = () => {
        if (cancelled) return;
        setReveal(progress.v);
        progressRef.current = progress.v;
      };

      const tl = gsap.timeline();
      tl.fromTo(hairline, { scaleX: 0 }, { scaleX: 1, duration: returning ? 0.5 : 0.9, ease: 'wj.out' }, 0)
        .fromTo(light, { xPercent: -100, opacity: 0 }, { xPercent: 100, opacity: 1, duration: returning ? 0.6 : 1.1, ease: 'power2.inOut' }, 0.05)
        .fromTo(since, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: 'wj.out' }, returning ? 0.3 : 0.7)
        .to(progress, { v: 1, duration: minTime, ease: 'power1.inOut', onUpdate: write }, 0);

      if (word) {
        SplitText.create(word, {
          type: 'chars',
          mask: 'chars',
          onSplit: (self) => gsap.from(self.chars, { yPercent: 110, duration: 0.9, stagger: 0.035, ease: 'wj.out', delay: 0.15 }),
        });
      }

      void Promise.all([fontsReady(), heroReady(), new Promise((r) => setTimeout(r, minTime * 1000 + 150))]).then(() => {
        if (cancelled) return;
        gsap.to(progress, { v: 1, duration: 0.3, ease: 'none', onUpdate: write, onComplete: () => finish(0.7) });
      });
    }

    return () => {
      cancelled = true;
      ctx.revert();
    };
  }, [isHome, setLoaderDone]);

  if (!mounted) return null;

  return (
    <div
      ref={root}
      id="loader"
      className="fixed inset-0 flex flex-col items-center justify-center bg-ink text-ivory"
      style={{ zIndex: 'var(--z-loader)' }}
      aria-live="polite"
      aria-label="Waseem Jewellers is opening"
    >
      {isHome ? (
        <>
          <div className="ritual-stone ritual-fade relative h-[min(34vw,30svh)] w-[min(34vw,30svh)]" style={{ ['--reveal' as string]: 0 }} data-gem={gemShown ? '1' : '0'}>
            <LoaderStone id="ritual" />
            {Gem && (
              <div className="absolute -inset-[6%]">
                <Gem progress={() => progressRef.current} exiting={() => exitingRef.current} onFirstFrame={() => setGemShown(true)} />
              </div>
            )}
          </div>
          <div className="ritual-fade mt-[6svh] flex flex-col items-center gap-4">
            <p className="ritual-word display text-[clamp(2.5rem,11vw,10rem)] leading-none tracking-[0.12em]">WASEEM</p>
            <div className="relative h-px w-[min(56vw,420px)] overflow-visible">
              <span className="ritual-hairline hairline absolute inset-0 origin-center" />
              <span className="ritual-light absolute -top-px h-[3px] w-24 bg-gradient-to-r from-transparent via-gold-hi to-transparent opacity-0" />
            </div>
            <p className="ritual-since micro text-champagne opacity-0">Since 1952</p>
          </div>
        </>
      ) : (
        <div className="relative h-px w-[min(40vw,320px)]">
          <span className="hairline absolute inset-0 opacity-70" />
        </div>
      )}
    </div>
  );
}
