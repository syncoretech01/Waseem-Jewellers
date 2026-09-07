'use client';

import { useRef, type RefObject } from 'react';
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/motion/gsap';
import { useQualityStore } from '@/state/qualityStore';

interface SplitRevealOptions {
  /** CSS selector inside the scope; defaults to every [data-split]. */
  selector?: string;
  type?: 'lines' | 'words' | 'chars';
  stagger?: number;
  duration?: number;
  start?: string;
  delay?: number;
  once?: boolean;
}

/**
 * Masked line / word / char reveals (SplitText) that play once when the element enters.
 * Under reduced motion the text simply appears.
 */
export function useSplitReveal(scope: RefObject<HTMLElement | null>, opts: SplitRevealOptions = {}) {
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const { selector = '[data-split]', type = 'lines', stagger = 0.08, duration = 1.1, start = 'top 85%', delay = 0, once = true } = opts;

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const targets = root.querySelectorAll<HTMLElement>(selector);
      if (targets.length === 0) return;
      if (reduced) {
        gsap.set(targets, { autoAlpha: 1 });
        return;
      }
      targets.forEach((el) => {
        gsap.set(el, { autoAlpha: 1 });
        SplitText.create(el, {
          type,
          mask: type === 'chars' ? 'chars' : type,
          autoSplit: true,
          aria: 'auto',
          onSplit: (self) =>
            gsap.from(type === 'chars' ? self.chars : type === 'words' ? self.words : self.lines, {
              yPercent: 110,
              duration,
              stagger,
              delay,
              ease: 'wj.out',
              scrollTrigger: { trigger: el, start, once, toggleActions: 'play none none none' },
            }),
        });
      });
    },
    { scope, dependencies: [reduced] },
  );
}

interface MaskRevealOptions {
  selector?: string;
  from?: 'bottom' | 'left' | 'top' | 'right';
  start?: string;
  duration?: number;
  scale?: number;
}

const INSETS = {
  bottom: 'inset(100% 0 0 0)',
  top: 'inset(0 0 100% 0)',
  left: 'inset(0 100% 0 0)',
  right: 'inset(0 0 0 100%)',
};

/**
 * Image mask reveals: the wrapper unclips, the inner image settles from 1.06 → 1.
 * Wrapper = [data-reveal], inner = [data-reveal-inner] (or the first img/video).
 */
export function useMaskReveal(scope: RefObject<HTMLElement | null>, opts: MaskRevealOptions = {}) {
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const { selector = '[data-reveal]', from = 'bottom', start = 'top 82%', duration = 1.3, scale = 1.06 } = opts;

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const wrappers = root.querySelectorAll<HTMLElement>(selector);
      wrappers.forEach((wrapper) => {
        const inner = wrapper.querySelector<HTMLElement>('[data-reveal-inner]') ?? wrapper.querySelector<HTMLElement>('img, video');
        if (reduced) {
          gsap.set(wrapper, { clipPath: 'inset(0 0 0 0)', autoAlpha: 1 });
          return;
        }
        const dir = (wrapper.dataset.reveal as MaskRevealOptions['from']) || from;
        gsap.set(wrapper, { clipPath: INSETS[dir ?? 'bottom'], autoAlpha: 1 });
        if (inner) gsap.set(inner, { scale });
        const tl = gsap.timeline({ scrollTrigger: { trigger: wrapper, start, once: true } });
        tl.to(wrapper, { clipPath: 'inset(0 0 0 0)', duration, ease: 'wj.out' }, 0);
        if (inner) tl.to(inner, { scale: 1, duration: duration + 0.4, ease: 'wj.out' }, 0);
      });
    },
    { scope, dependencies: [reduced] },
  );
}

/** Scrubbed vertical parallax for [data-parallax="0.2"] children (fraction of viewport travel). */
export function useParallax(scope: RefObject<HTMLElement | null>) {
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  useGSAP(
    () => {
      const root = scope.current;
      if (!root || reduced) return;
      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
        const factor = Number(el.dataset.parallax ?? 0.15);
        gsap.fromTo(
          el,
          { yPercent: -factor * 40 },
          {
            yPercent: factor * 40,
            ease: 'none',
            scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });
    },
    { scope, dependencies: [reduced] },
  );
}

/** Generic fade-up reveal for [data-rise] elements (staggered when siblings share a parent). */
export function useRise(scope: RefObject<HTMLElement | null>, opts: { start?: string; y?: number } = {}) {
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const { start = 'top 88%', y = 24 } = opts;
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const els = root.querySelectorAll<HTMLElement>('[data-rise]');
      if (els.length === 0) return;
      if (reduced) {
        gsap.set(els, { autoAlpha: 1 });
        return;
      }
      ScrollTrigger.batch(els, {
        start,
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'wj.out', overwrite: 'auto' }),
      });
      gsap.set(els, { autoAlpha: 0, y });
    },
    { scope, dependencies: [reduced] },
  );
}

/** A stable ref for hooks that need a scope but are declared in a parent. */
export function useScopeRef<T extends HTMLElement = HTMLElement>() {
  return useRef<T>(null);
}
