'use client';

import { gsap, ScrollTrigger } from './gsap';
import { getFlipFrame } from './flipFrames';
import { runtime, scrollTo, startScroll, stopScroll, currentScroll, type FlipKey, type NavigateOptions, type TransitionHandle, markSettledArrival } from '@/state/runtime';
import { sectionsReady } from '@/state/sections';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';

/**
 * Once-only reveals whose trigger has already been reached (in view or above the viewport)
 * jump to their composed state instead of replaying beneath the lifting veil.
 */
export function settleReveals() {
  const pass = () => {
    for (const st of ScrollTrigger.getAll()) {
      if (!st.vars.once) continue;
      const reached = st.isActive || st.progress >= 1;
      if (!reached) continue;
      if (st.animation) st.animation.progress(1);
      else if (st.trigger instanceof HTMLElement && st.trigger.hasAttribute('data-rise')) gsap.set(st.trigger, { autoAlpha: 1, y: 0 });
    }
  };
  pass();
  requestAnimationFrame(pass);
}

export class SupersededError extends Error {
  constructor() {
    super('Superseded');
    this.name = 'Superseded';
  }
}

interface Elements {
  curtain: HTMLElement;
  veil: HTMLElement;
  flipLayer: HTMLElement;
}

const SCROLL_KEY = 'wj:scroll';

function readScrollMemory(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function rememberScroll(path: string, y: number) {
  try {
    const mem = readScrollMemory();
    mem[path] = y;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}

function hrefTarget(href: string) {
  const url = new URL(href, window.location.origin);
  return url.pathname + url.search;
}

function currentTarget() {
  return window.location.pathname + window.location.search;
}

/**
 * Curtain + FLIP route transitions. One in-flight navigation at a time; a second
 * `navigate()` supersedes the first (its `whenReady()` rejects). `ready()` is a no-op
 * unless the location matches the in-flight target.
 */
export class TransitionController implements TransitionHandle {
  inFlight: { href: string; kind: string; flipKey?: FlipKey; epoch: number; target: string; readied?: boolean } | null = null;
  private epoch = 0;
  private els: Elements | null = null;
  private clone: HTMLImageElement | null = null;
  private hiddenSource: HTMLElement | null = null;
  private tl: gsap.core.Timeline | null = null;
  private forced: number | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private popPending = false;

  attach(els: Elements) {
    this.els = els;
    window.addEventListener('popstate', this.onPop);
  }

  detach() {
    window.removeEventListener('popstate', this.onPop);
    this.els = null;
  }

  private onPop = () => {
    this.popPending = true;
  };

  private reduced() {
    return useQualityStore.getState().tier === 'REDUCED';
  }

  private flipAllowed() {
    const tier = useQualityStore.getState().tier;
    return tier === 'HIGH' || tier === 'MEDIUM';
  }

  whenReady() {
    return this.readyPromise;
  }

  async navigate(href: string, opts: NavigateOptions = {}) {
    if (!this.els) {
      runtime.router?.push(href, { scroll: false });
      return;
    }
    const target = hrefTarget(href);
    if (target === currentTarget() && !this.inFlight) {
      runtime.router?.push(href, { scroll: false });
      return;
    }
    this.supersede();
    this.epoch += 1;
    const epoch = this.epoch;
    const kind = this.reduced() ? 'veil' : opts.kind === 'flip' && opts.sourceEl && this.flipAllowed() ? 'flip' : opts.kind ?? 'curtain';
    this.inFlight = { href, kind, flipKey: opts.flipKey, epoch, target };
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.readyPromise.catch(() => undefined);

    rememberScroll(currentTarget(), currentScroll());
    stopScroll();
    document.documentElement.classList.add('is-transitioning');
    document.getElementById('page-root')?.setAttribute('inert', '');
    useSiteStore.getState().closeMenu();

    const { curtain, veil, flipLayer } = this.els;
    const push = () => {
      if (this.epoch !== epoch) return;
      runtime.router?.push(href, { scroll: false });
    };

    this.tl?.kill();
    const tl = gsap.timeline();
    this.tl = tl;

    if (kind === 'flip' && opts.sourceEl && opts.flipKey) {
      const img = (opts.sourceEl.tagName === 'IMG' ? opts.sourceEl : opts.sourceEl.querySelector('img')) as HTMLImageElement | null;
      if (img && img.currentSrc) {
        const rect = img.getBoundingClientRect();
        const clone = document.createElement('img');
        clone.src = img.currentSrc;
        clone.alt = '';
        clone.setAttribute('aria-hidden', 'true');
        const cs = getComputedStyle(img);
        Object.assign(clone.style, {
          position: 'fixed',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          objectFit: 'cover',
          objectPosition: cs.objectPosition,
          pointerEvents: 'none',
          zIndex: '2',
        } as CSSStyleDeclaration);
        flipLayer.appendChild(clone);
        this.clone = clone;
        this.hiddenSource = img;
        img.style.visibility = 'hidden';
        const frame = getFlipFrame(opts.flipKey);
        gsap.set(veil, { opacity: 0, pointerEvents: 'auto' });
        tl.to(veil, { opacity: 1, duration: 0.6, ease: 'power2.inOut' }, 0)
          .to(clone, { left: frame.left, top: frame.top, width: frame.width, height: frame.height, duration: 0.9, ease: 'wj.inOut' }, 0)
          .call(push, [], 0.3);
      } else {
        this.inFlight.kind = 'curtain';
      }
    }

    if (this.inFlight.kind === 'curtain') {
      gsap.set(curtain, { yPercent: 100, pointerEvents: 'auto' });
      tl.to(curtain, { yPercent: 0, duration: 0.7, ease: 'wj.inOut' }, 0).call(push, [], 0.35);
    } else if (this.inFlight.kind === 'veil') {
      gsap.set(veil, { opacity: 0, pointerEvents: 'auto' });
      tl.to(veil, { opacity: 1, duration: 0.35, ease: 'none' }, 0).call(push, [], 0.2);
    }

    this.forced = window.setTimeout(() => {
      if (this.epoch === epoch && this.inFlight) this.ready(this.inFlight.flipKey, null);
    }, 4000);

    await new Promise<void>((resolve) => tl.eventCallback('onComplete', resolve));
  }

  private supersede() {
    if (!this.inFlight) return;
    this.tl?.kill();
    if (this.forced) window.clearTimeout(this.forced);
    this.readyReject?.(new SupersededError());
    this.cleanupClone(true);
    if (this.els) {
      if (this.inFlight.kind === 'curtain') gsap.set(this.els.curtain, { yPercent: 0 });
      else gsap.set(this.els.veil, { opacity: 1 });
    }
    this.inFlight = null;
  }

  private cleanupClone(restoreSource: boolean) {
    if (this.hiddenSource && restoreSource) this.hiddenSource.style.visibility = '';
    this.hiddenSource = null;
    this.clone?.remove();
    this.clone = null;
  }

  /** Called by the destination once it has mounted (and, for FLIP, decoded its hero image). */
  ready(flipKey?: FlipKey, targetEl?: HTMLElement | null) {
    const flight = this.inFlight;
    if (!flight || !this.els) return;
    if (currentTarget() !== flight.target) return;
    // only the first report counts: a later one (an image decoding after the fallback) must not reset the arrival
    if (flight.readied) return;
    flight.readied = true;
    if (this.forced) window.clearTimeout(this.forced);
    this.forced = null;
    const epoch = flight.epoch;
    const { curtain, veil } = this.els;

    void (async () => {
      await Promise.race([sectionsReady(), new Promise((r) => setTimeout(r, 1200))]);
      if (this.epoch !== epoch) return;
      const saved = this.popPending ? readScrollMemory()[flight.target] : undefined;
      this.popPending = false;
      if ((saved ?? 0) > 0) markSettledArrival();
      scrollTo(saved ?? 0, { immediate: true });
      ScrollTrigger.refresh();
      if ((saved ?? 0) > 0) settleReveals();

      const tl = gsap.timeline({
        onComplete: () => {
          if (this.epoch !== epoch) return;
          document.documentElement.classList.remove('is-transitioning');
          document.getElementById('page-root')?.removeAttribute('inert');
          gsap.set(curtain, { pointerEvents: 'none' });
          gsap.set(veil, { pointerEvents: 'none' });
          this.inFlight = null;
          this.readyResolve?.();
        },
      });
      this.tl = tl;

      if (flight.kind === 'flip' && this.clone) {
        const clone = this.clone;
        if (targetEl) {
          const r = targetEl.getBoundingClientRect();
          tl.to(clone, { left: r.left, top: r.top, width: r.width, height: r.height, duration: 0.45, ease: 'power3.inOut' }, 0);
          const targetImg = targetEl.tagName === 'IMG' ? targetEl : targetEl.querySelector('img');
          tl.call(
            () => {
              if (targetImg) (targetImg as HTMLElement).style.visibility = '';
            },
            [],
            0.4,
          );
        }
        tl.to(clone, { opacity: 0, duration: 0.25, ease: 'none' }, 0.45)
          .to(veil, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 0.3)
          .call(() => this.cleanupClone(false), [], 0.75)
          .call(startScroll, [], 0.5);
      } else if (flight.kind === 'curtain') {
        tl.to(curtain, { yPercent: -100, duration: 0.8, ease: 'wj.inOut' }, 0.05).call(startScroll, [], 0.5);
      } else {
        tl.to(veil, { opacity: 0, duration: 0.45, ease: 'none' }, 0.05).call(startScroll, [], 0.25);
      }
    })();
  }

  /** A route change that did not go through navigate() (back/forward, external). Reveal half only. */
  arrivePlain(pathname: string) {
    if (this.inFlight || !this.els) return;
    const { veil } = this.els;
    const saved = this.popPending ? readScrollMemory()[pathname + window.location.search] : undefined;
    this.popPending = false;
    gsap.set(veil, { opacity: 1, pointerEvents: 'none' });
    void (async () => {
      await Promise.race([sectionsReady(), new Promise((r) => setTimeout(r, 1000))]);
      if ((saved ?? 0) > 0) markSettledArrival();
      scrollTo(saved ?? 0, { immediate: true });
      ScrollTrigger.refresh();
      if ((saved ?? 0) > 0) settleReveals();
      gsap.to(veil, { opacity: 0, duration: 0.45, ease: 'none', delay: 0.05 });
    })();
  }
}
