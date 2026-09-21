'use client';

import { useRef, type RefObject } from 'react';
import { gsap, SplitText, useGSAP } from '@/lib/motion/gsap';
import { useQualityStore } from '@/state/qualityStore';
import { isSettledArrival } from '@/state/runtime';

/**
 * Reveals that play once when their element enters — a line rising out of its mask, a
 * photograph unclipping, a card lifting into place — are watched by an IntersectionObserver
 * per scope rather than a ScrollTrigger per element. Thirty-six of the homepage's forty-nine
 * ScrollTriggers were these: each one measured on every refresh and walked on every scrolled
 * frame for a thing that happens once. An observer is computed off the main thread and
 * delivers exactly one callback when it matters.
 *
 * What a ScrollTrigger gave for free is kept by hand: an element already above the viewport
 * when it is observed (a deep link, a restored position, a chapter hydrated late) is shown
 * composed rather than left hidden, and an element inside the viewport on a back/forward
 * arrival lands at rest rather than replaying (`landsComposed`).
 *
 * The scrubbed parallax stays on ScrollTrigger: it is a scroll-linked value, not a moment.
 */

function way(type: 'lines' | 'words' | 'chars', self: SplitText) {
  return type === 'words' ? self.words : self.lines;
}

/** True when the element is already within the viewport on a back/forward or deep-link arrival. */
function landsComposed(el: Element) {
  if (!isSettledArrival()) return false;
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
}

/**
 * The observer's margins for a ScrollTrigger-style start such as `top 85%`: the element counts
 * as entered when its top crosses that line. The root is also extended far above the
 * viewport, so an element the visitor jumped over — a deep link, a restored position, a long
 * fling — still "enters" (it is inside the extended root now and was not before) rather than
 * going from below-and-unseen to above-and-unseen without a callback. Anything else reads
 * as the viewport edge.
 */
const ABOVE = 200000;
function marginFor(start: string) {
  const m = /^top\s+(\d+(?:\.\d+)?)%$/.exec(start.trim());
  const pct = m ? Math.max(0, Math.min(100, 100 - Number(m[1]))) : 0;
  return `${ABOVE}px 0px -${pct}% 0px`;
}

/**
 * Watches `els` once each: `enter(batch)` for elements crossing the line together,
 * `past(el)` for one that is already above the viewport when it is first seen inside the
 * line — jumped over, so shown composed rather than played to no one. Returns the disconnect.
 */
function observeOnce(els: Element[], start: string, enter: (batch: Element[]) => void, past: (el: Element) => void) {
  if (els.length === 0) return () => undefined;
  const pending = new Set(els);
  const io = new IntersectionObserver(
    (entries) => {
      const batch: Element[] = [];
      for (const e of entries) {
        if (!pending.has(e.target) || !e.isIntersecting) continue;
        pending.delete(e.target);
        io.unobserve(e.target);
        if (e.boundingClientRect.bottom <= 0) past(e.target);
        else batch.push(e.target);
      }
      if (batch.length) enter(batch);
      if (pending.size === 0) io.disconnect();
    },
    { rootMargin: marginFor(start) },
  );
  for (const el of els) io.observe(el);
  return () => io.disconnect();
}

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
  const { selector = '[data-split]', type = 'lines', stagger = 0.08, duration = 1.1, start = 'top 85%', delay = 0 } = opts;

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const targets = [...root.querySelectorAll<HTMLElement>(selector)];
      if (targets.length === 0) return;
      if (reduced) {
        gsap.set(targets, { autoAlpha: 1 });
        return;
      }
      // the tween each element is waiting to play, and whether it has already played
      const tweens = new Map<Element, gsap.core.Tween>();
      const played = new Set<Element>();
      targets.forEach((el) => {
        gsap.set(el, { autoAlpha: 1 });
        if (landsComposed(el)) played.add(el);
        // the split is recorded by the surrounding gsap context and reverted with it
        SplitText.create(el, {
          type,
          mask: type === 'chars' ? 'chars' : type,
          autoSplit: true,
          aria: 'auto',
          onSplit: (self) => {
            const tween = gsap.from(type === 'chars' ? self.chars : way(type, self), {
              yPercent: 110,
              duration,
              stagger,
              delay,
              ease: 'wj.out',
              paused: true,
            });
            // a re-split after the reveal (a resize) shows the finished state, not a replay
            if (played.has(el)) tween.progress(1);
            else tweens.set(el, tween);
            return tween;
          },
        });
      });
      const show = (el: Element, compose: boolean) => {
        played.add(el);
        const tween = tweens.get(el);
        tweens.delete(el);
        if (!tween) return;
        if (compose) tween.progress(1);
        else tween.play();
      };
      return observeOnce(
        targets.filter((el) => !played.has(el)),
        start,
        (batch) => batch.forEach((el) => show(el, false)),
        (el) => show(el, true),
      );
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
      const wrappers = [...root.querySelectorAll<HTMLElement>(selector)];
      const timelines = new Map<Element, gsap.core.Timeline>();
      wrappers.forEach((wrapper) => {
        const inner = wrapper.querySelector<HTMLElement>('[data-reveal-inner]') ?? wrapper.querySelector<HTMLElement>('img, video');
        if (reduced) {
          gsap.set(wrapper, { clipPath: 'inset(0 0 0 0)', autoAlpha: 1 });
          return;
        }
        const dir = (wrapper.dataset.reveal as MaskRevealOptions['from']) || from;
        gsap.set(wrapper, { clipPath: INSETS[dir ?? 'bottom'], autoAlpha: 1 });
        if (inner) gsap.set(inner, { scale });
        const tl = gsap.timeline({ paused: true });
        tl.to(wrapper, { clipPath: 'inset(0 0 0 0)', duration, ease: 'wj.out' }, 0);
        if (inner) tl.to(inner, { scale: 1, duration: duration + 0.4, ease: 'wj.out' }, 0);
        if (landsComposed(wrapper)) tl.progress(1);
        else timelines.set(wrapper, tl);
      });
      if (reduced) return;
      const show = (el: Element, compose: boolean) => {
        const tl = timelines.get(el);
        timelines.delete(el);
        if (!tl) return;
        if (compose) tl.progress(1);
        else tl.play();
      };
      return observeOnce(
        [...timelines.keys()],
        start,
        (batch) => batch.forEach((el) => show(el, false)),
        (el) => show(el, true),
      );
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

/** Generic fade-up reveal for [data-rise] elements (staggered when siblings enter together). */
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
      const composed = [...els].filter(landsComposed);
      const pending = [...els].filter((el) => !composed.includes(el));
      if (composed.length) gsap.set(composed, { autoAlpha: 1, y: 0 });
      if (pending.length === 0) return;
      /**
       * Opacity, not autoAlpha. autoAlpha sets visibility:hidden, and a hidden element leaves
       * the sequential focus order — so a keyboard user on a department page went from piece
       * three straight to "Show 24 more", with twenty-one pieces below the fold unreachable
       * until they had been scrolled into view by some other means. Opacity keeps every piece
       * focusable; the focusin listener below makes sure a piece that receives focus is also
       * visible, whether or not the scroll has reached it.
       */
      const reveal = (batch: Element[]) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'wj.out', overwrite: 'auto' });
      gsap.set(pending, { opacity: 0, y });
      const stop = observeOnce(pending, start, reveal, (el) => gsap.set(el, { opacity: 1, y: 0 }));
      const onFocusIn = (e: FocusEvent) => {
        const cell = (e.target as Element | null)?.closest<HTMLElement>('[data-rise]');
        if (cell && pending.includes(cell) && gsap.getProperty(cell, 'opacity') !== 1) reveal([cell]);
      };
      root.addEventListener('focusin', onFocusIn);
      return () => {
        stop();
        root.removeEventListener('focusin', onFocusIn);
      };
    },
    { scope, dependencies: [reduced] },
  );
}

/** A stable ref for hooks that need a scope but are declared in a parent. */
export function useScopeRef<T extends HTMLElement = HTMLElement>() {
  return useRef<T>(null);
}
