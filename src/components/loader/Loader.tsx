'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { gsap, ScrollTrigger, SplitText } from '@/lib/motion/gsap';
import { useSiteStore } from '@/state/siteStore';
import { startScroll, stopScroll } from '@/state/runtime';
import { LoaderStone } from './LoaderStone';
import { fontsReady, heroReady } from './readiness';

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

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const html = document.documentElement;
    const returning = html.hasAttribute('data-visited');
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
      const minTime = returning ? 0.7 : 1.9;
      const stone = el.querySelector<HTMLElement>('.ritual-stone');
      const hairline = el.querySelector<HTMLElement>('.ritual-hairline');
      const light = el.querySelector<HTMLElement>('.ritual-light');
      const since = el.querySelector<HTMLElement>('.ritual-since');
      const word = el.querySelector<HTMLElement>('.ritual-word');
      const progress = { v: 0 };
      const setReveal = gsap.quickSetter(stone!, '--reveal');

      const tl = gsap.timeline();
      tl.fromTo(hairline, { scaleX: 0 }, { scaleX: 1, duration: returning ? 0.5 : 0.9, ease: 'wj.out' }, 0)
        .fromTo(light, { xPercent: -100, opacity: 0 }, { xPercent: 100, opacity: 1, duration: returning ? 0.6 : 1.1, ease: 'power2.inOut' }, 0.05)
        .fromTo(since, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: 'wj.out' }, returning ? 0.3 : 0.7)
        .to(progress, { v: 1, duration: minTime, ease: 'power1.inOut', onUpdate: () => setReveal(progress.v) }, 0);

      if (word) {
        SplitText.create(word, {
          type: 'chars',
          mask: 'chars',
          onSplit: (self) => gsap.from(self.chars, { yPercent: 110, duration: 0.9, stagger: 0.035, ease: 'wj.out', delay: 0.15 }),
        });
      }

      void Promise.all([fontsReady(), heroReady(), new Promise((r) => setTimeout(r, minTime * 1000 + 150))]).then(() => {
        gsap.to(progress, { v: 1, duration: 0.3, ease: 'none', onUpdate: () => setReveal(progress.v), onComplete: () => finish(0.7) });
      });
    });

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
          <div className="ritual-stone ritual-fade relative h-[min(34vw,30svh)] w-[min(34vw,30svh)]" style={{ ['--reveal' as string]: 0 }}>
            <LoaderStone id="ritual" />
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
