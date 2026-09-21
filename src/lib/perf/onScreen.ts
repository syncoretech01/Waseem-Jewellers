'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from '@/lib/motion/gsap';

/**
 * One question every per-frame worker on the page has to answer before it does anything:
 * is the thing I move anywhere near the screen?
 *
 * A pointer ticker on the hero, a column drift in the worlds, the craft object's demand
 * invalidator — each is cheap on its own and each was running on every frame of a 25,000 px
 * page, whatever the visitor was looking at. This module is the shared answer: one
 * IntersectionObserver per margin, and a ticker that is added to `gsap.ticker` only while
 * its element is within that margin of the viewport and removed the moment it is not.
 *
 * The margin is generous by default (one viewport above and below), so a worker is already
 * running by the time its element scrolls in and nothing pops.
 */

type Listener = (onScreen: boolean) => void;

const observers = new Map<string, IntersectionObserver>();
const listeners = new WeakMap<Element, Map<string, Set<Listener>>>();

function observerFor(margin: string) {
  let io = observers.get(margin);
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const set = listeners.get(e.target)?.get(margin);
          if (!set) continue;
          for (const fn of set) fn(e.isIntersecting);
        }
      },
      { rootMargin: `${margin} 0px` },
    );
    observers.set(margin, io);
  }
  return io;
}

/** Calls `fn` with true when `el` comes within `margin` of the viewport and false when it leaves. */
export function watchOnScreen(el: Element, fn: Listener, margin = '100%'): () => void {
  let byMargin = listeners.get(el);
  if (!byMargin) {
    byMargin = new Map();
    listeners.set(el, byMargin);
  }
  let set = byMargin.get(margin);
  const io = observerFor(margin);
  if (!set) {
    set = new Set();
    byMargin.set(margin, set);
    io.observe(el);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) {
      byMargin.delete(margin);
      io.unobserve(el);
    }
  };
}

/**
 * A `gsap.ticker` callback that exists only while `el` is within `margin` of the viewport.
 * Returns the remover. `onLeave` runs when the ticker is taken off, for a worker that must
 * settle what it moved (a pointer drift eased back to rest) before it stops.
 */
export function gatedTicker(el: Element, fn: gsap.TickerCallback, { margin = '100%', onLeave }: { margin?: string; onLeave?: () => void } = {}): () => void {
  let added = false;
  const stop = watchOnScreen(
    el,
    (on) => {
      if (on && !added) {
        added = true;
        gsap.ticker.add(fn);
      } else if (!on && added) {
        added = false;
        gsap.ticker.remove(fn);
        onLeave?.();
      }
    },
    margin,
  );
  return () => {
    stop();
    if (added) gsap.ticker.remove(fn);
    added = false;
  };
}

/**
 * A ref that reads true while the element is within `margin` of the viewport — for a hook
 * that already owns a ticker and only needs to know whether to do its work this frame.
 * Not state: reading it never re-renders anything.
 */
export function useOnScreenRef(target: RefObject<Element | null>, margin = '100%'): RefObject<boolean> {
  const on = useRef(false);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    return watchOnScreen(
      el,
      (v) => {
        on.current = v;
      },
      margin,
    );
  }, [target, margin]);
  return on;
}
