'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { useSiteStore } from '@/state/siteStore';
import { startScroll, stopScroll } from '@/state/runtime';
import { WaseemLockup } from '@/components/brand/WaseemLockup';
import { fontsReady, heroReady } from './readiness';

const DEV = process.env.NODE_ENV === 'development';

/** Sets a path up to be drawn and returns its length, or 0 if it cannot be measured. */
function prepareDraw(path: SVGPathElement | null) {
  if (!path || typeof path.getTotalLength !== 'function') return 0;
  const len = path.getTotalLength();
  if (!len) return 0;
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
  return len;
}

/**
 * The loading ritual (CH00). Server-rendered so the first paint is already ink; runs once per
 * document load.
 *
 * Home: Waseem's own mark engraves itself — the crest's silhouette draws, then the WJW
 * ligature, then the wordmark rises, then a band of light travels through the gold. Any
 * other route: a 0.6 s lift. Returning visitors get the short path.
 *
 * The mark is drawn, not a stone: see BRAND.md.
 */
export function Loader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const setLoaderDone = useSiteStore((s) => s.setLoaderDone);
  const isHome = pathname === '/';

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
        tl.to(el.querySelector('.ritual-mark'), { scale: 1.06, duration: 0.9, ease: 'power2.in' }, 0)
          .to(el.querySelectorAll('.ritual-fade'), { opacity: 0, duration: 0.35, ease: 'none' }, 0.15)
          .to(el, { opacity: 0, duration: exitDuration, ease: 'power2.inOut' }, exitDuration * 0.55);
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
        // No drawing at all: the finished mark, plainly. Never call getTotalLength here —
        // the dasharray setup is skipped entirely rather than tweened to completion.
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
      const minTime = returning ? 0.45 : 1.4;
      if (DEV) console.info(`[loader] ritual starts at t=${Math.round(performance.now())} (${returning ? 'returning' : 'first visit'})`);

      const q = <T extends Element>(sel: string) => el!.querySelector<T>(sel);
      const crestDraw = q<SVGPathElement>('[data-mark="crest-draw"]');
      const monoDraw = q<SVGPathElement>('[data-mark="monogram-draw"]');
      const crestFill = q<SVGPathElement>('[data-mark="crest-fill"]');
      const monoFill = q<SVGPathElement>('[data-mark="monogram-fill"]');
      const words = el.querySelectorAll<SVGGElement>('[data-mark="word-1"], [data-mark="word-2"]');
      const specular = el.querySelectorAll<SVGElement>('[data-mark="specular"]');
      const speculars = el.querySelectorAll<SVGPathElement>('[data-mark$="-specular"]');
      const hairline = q<HTMLElement>('.ritual-hairline');
      const since = q<HTMLElement>('.ritual-since');

      const crestLen = prepareDraw(crestDraw);
      const monoLen = prepareDraw(monoDraw);
      // only the drawn parts start hidden; the word lines are revealed by their group
      gsap.set([crestFill, monoFill].filter(Boolean), { opacity: 0 });
      gsap.set(speculars, { opacity: 0 });
      gsap.set(words, { opacity: 0, yPercent: 26 });

      const tl = gsap.timeline();
      const drawFor = returning ? 0.55 : 0.9;

      // 1 — the crest engraves itself, the way it would be drawn by hand
      if (crestLen) {
        tl.to(crestDraw, { strokeDashoffset: 0, duration: drawFor, ease: 'power1.inOut' }, 0)
          .to(crestFill, { opacity: 1, duration: 0.4, ease: 'none' }, drawFor * 0.72)
          .to(crestDraw, { opacity: 0, duration: 0.35, ease: 'none' }, drawFor * 0.82);
      } else {
        tl.to(crestFill, { opacity: 1, duration: 0.5 }, 0);
      }

      // 2 — the ligature follows
      if (monoLen) {
        tl.to(monoDraw, { strokeDashoffset: 0, duration: drawFor * 0.9, ease: 'power1.inOut' }, drawFor * 0.55)
          .to(monoFill, { opacity: 1, duration: 0.4, ease: 'none' }, drawFor * 1.2)
          .to(monoDraw, { opacity: 0, duration: 0.35, ease: 'none' }, drawFor * 1.3);
      } else {
        tl.to(monoFill, { opacity: 1, duration: 0.5 }, drawFor * 0.55);
      }

      // 3 — the two lines of the wordmark rise (SplitText cannot split path letters)
      tl.to(words, { opacity: 1, yPercent: 0, duration: 0.7, stagger: 0.09, ease: 'wj.out' }, drawFor * 1.25);

      // 4 — light travels through the metal rather than beside it
      if (specular.length) {
        tl.to(speculars, { opacity: 1, duration: 0.3 }, drawFor * 1.5)
          .fromTo(
            specular,
            { attr: { gradientTransform: 'translate(-1.15 0)' } },
            { attr: { gradientTransform: 'translate(1.15 0)' }, duration: 1.15, ease: 'power2.inOut' },
            drawFor * 1.5,
          )
          .to(speculars, { opacity: 0, duration: 0.3 }, drawFor * 1.5 + 1.0);
      }

      // 5 — the house's own line, beneath
      tl.fromTo(hairline, { scaleX: 0 }, { scaleX: 1, duration: returning ? 0.5 : 0.9, ease: 'wj.out' }, drawFor * 0.6)
        .fromTo(since, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: 'wj.out' }, returning ? 0.6 : 1.2);

      void Promise.all([fontsReady(), heroReady(), new Promise((r) => setTimeout(r, minTime * 1000 + 120))]).then(() => {
        if (cancelled) return;
        finish(returning ? 0.45 : 0.7);
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
          <div className="ritual-mark ritual-fade w-[min(78vw,760px)]">
            <WaseemLockup animatable title={null} className="w-full" />
          </div>
          <div className="ritual-fade mt-[5svh] flex flex-col items-center gap-4">
            <div className="relative h-px w-[min(44vw,340px)]">
              <span className="ritual-hairline hairline absolute inset-0 origin-center" />
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
