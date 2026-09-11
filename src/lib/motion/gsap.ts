'use client';

/**
 * The single GSAP module. Every consumer imports from '@/lib/motion/gsap';
 * importing 'gsap' or 'gsap/*' anywhere else is an ESLint error.
 *
 * Only registration and the house eases live at module scope (both are SSR-safe).
 * ScrollTrigger.config / clearScrollMemory / scrollRestoration run in Providers' effect.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase);

// wj.out — the settle of a heavy object coming to rest. Used for every reveal.
if (typeof window !== 'undefined' && !CustomEase.get('wj.out')) {
  CustomEase.create('wj.out', 'M0,0 C0.16,1 0.3,1 1,1');
  CustomEase.create('wj.inOut', 'M0,0 C0.76,0 0.24,1 1,1');
}

gsap.defaults({ ease: 'wj.out', duration: 0.8, overwrite: false });

/**
 * `gsap.matchMedia()` that lets go of its MediaQueryLists.
 *
 * In gsap 3.15 `MatchMedia.add()` calls `window.matchMedia()` once per condition and attaches
 * its change handler to each — and neither `kill()` nor `revert()` ever removes it. A
 * MediaQueryList with a live listener is kept alive by the document's matcher, so every mount
 * of a chapter that declares `{ desktop, mobile, reduce }` leaves three behind for the life of
 * the page. Measured by heap census on 11 September 2026: +47 MediaQueryLists and +47
 * listeners per loop of five route changes, after every other retainer had been closed.
 *
 * The handler is module-private to GSAP, so it cannot be named here; instead, while `add()`
 * runs, every listener registered on a MediaQueryList is recorded against this instance, and
 * `revert()`/`kill()` — which `useGSAP`'s context calls on unmount — removes them. This is the
 * only place in the project that reaches into GSAP's behaviour, and it reaches in only to
 * undo what the library forgot.
 */
type MQListener = (this: MediaQueryList, ev: MediaQueryListEvent) => void;

const originalMatchMedia = gsap.matchMedia;

function leakFreeMatchMedia(scope?: Element | string | object): gsap.MatchMedia {
  const mm = originalMatchMedia.call(gsap, scope as never) as gsap.MatchMedia;
  const registered: { mq: MediaQueryList; fn: MQListener }[] = [];
  const originalAdd = mm.add.bind(mm);
  const originalKill = mm.kill.bind(mm);
  const originalRevert = mm.revert.bind(mm);

  mm.add = ((conditions: unknown, func: unknown, scope?: unknown) => {
    if (typeof window === 'undefined') return originalAdd(conditions as never, func as never, scope as never);
    const proto = MediaQueryList.prototype as MediaQueryList & { addListener?: (fn: MQListener) => void };
    const addEvent = proto.addEventListener;
    const addLegacy = proto.addListener;
    // GSAP prefers the legacy `addListener` where it exists; record through either door
    proto.addEventListener = function (this: MediaQueryList, type: string, fn: unknown, opts?: unknown) {
      if (type === 'change' && typeof fn === 'function') registered.push({ mq: this, fn: fn as MQListener });
      return addEvent.call(this, type, fn as EventListener, opts as boolean | AddEventListenerOptions | undefined);
    } as typeof proto.addEventListener;
    if (addLegacy) {
      proto.addListener = function (this: MediaQueryList, fn: MQListener) {
        registered.push({ mq: this, fn });
        return addLegacy.call(this, fn);
      };
    }
    try {
      return originalAdd(conditions as never, func as never, scope as never);
    } finally {
      proto.addEventListener = addEvent;
      if (addLegacy) proto.addListener = addLegacy;
    }
  }) as typeof mm.add;

  const release = () => {
    for (const { mq, fn } of registered.splice(0)) {
      const legacy = mq as MediaQueryList & { removeListener?: (fn: MQListener) => void };
      if (legacy.removeListener) legacy.removeListener(fn);
      else mq.removeEventListener('change', fn);
    }
  };
  mm.kill = ((revert?: boolean) => {
    originalKill(revert);
    release();
  }) as typeof mm.kill;
  mm.revert = ((config?: object) => {
    originalRevert(config as never);
    release();
  }) as typeof mm.revert;
  return mm;
}

gsap.matchMedia = leakFreeMatchMedia as typeof gsap.matchMedia;

export { gsap, ScrollTrigger, SplitText, CustomEase, useGSAP };
