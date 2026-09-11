'use client';

import { useEffect, useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useFlipNavigate } from '@/motion/hooks/useFlipNavigate';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Img } from '@/components/media/Img';
import { Video } from '@/components/media/Video';
import { bindPointer, pointer } from '@/lib/motion/pointer';
import { COPY } from '@/data/copy';

/**
 * CH08 — the department gate. Two materials share one frame: gold beneath, diamond above
 * behind a mask whose edge follows the pointer and breathes at rest. The words weigh with
 * their side; choosing one lets that material fill the frame and flies into its department.
 *
 * The bias the concierge writes is read here rather than ignored: asked for gold from
 * another page, it sets the bias, brings the visitor to this chapter, and the chapter opens
 * with the gold side already forward.
 */
export function Ch08Duality() {
  const { ref } = useChapter({ id: 'duality', theme: 'dark' });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const coarse = useQualityStore((s) => s.coarse);
  const go = useFlipNavigate();
  const setBias = useSiteStore((s) => s.setDualityBias);
  const bias = useSiteStore((s) => s.dualityBias);
  const split = useRef({ pointer: 0.5, breath: 0, committed: false });
  const breathTween = useRef<gsap.core.Tween | null>(null);

  // the ticker is the only writer of the mask, divider and word weights
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const diamond = root.querySelector<HTMLElement>('.duality-diamond');
    const divider = root.querySelector<HTMLElement>('.duality-divider');
    const gold = root.querySelector<HTMLElement>('.duality-word-gold');
    const dia = root.querySelector<HTMLElement>('.duality-word-diamond');
    const goldLine = root.querySelector<HTMLElement>('.duality-line-gold');
    const diaLine = root.querySelector<HTMLElement>('.duality-line-diamond');
    if (!diamond || !divider || !gold || !dia) return;
    const s = split.current;
    if (reduced) {
      diamond.style.clipPath = 'inset(0 0 0 50%)';
      divider.style.left = '50%';
      return;
    }
    const vertical = coarse || window.innerWidth < 768;
    const apply = () => {
      const v = Math.max(0.06, Math.min(0.94, s.pointer + s.breath));
      const pct = (v * 100).toFixed(2);
      if (vertical) {
        diamond.style.clipPath = `inset(${pct}% 0 0 0)`;
        divider.style.top = `${pct}%`;
      } else {
        diamond.style.clipPath = `inset(0 0 0 ${pct}%)`;
        divider.style.left = `${pct}%`;
      }
      const g = 1 - v;
      gold.style.fontVariationSettings = `"opsz" 96, "wght" ${Math.round(400 + 160 * g)}`;
      dia.style.fontVariationSettings = `"opsz" 96, "wght" ${Math.round(400 + 160 * v)}`;
      gold.style.transform = `scale(${(1 + 0.05 * g).toFixed(3)})`;
      dia.style.transform = `scale(${(1 + 0.05 * v).toFixed(3)})`;
      if (goldLine) goldLine.style.opacity = String(0.35 + 0.65 * g);
      if (diaLine) diaLine.style.opacity = String(0.35 + 0.65 * v);
    };
    breathTween.current = gsap.to(s, { breath: 0.03, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, onStart: () => (s.breath = -0.03) });
    const pointerTo = gsap.quickTo(s, 'pointer', { duration: 0.9, ease: 'power3' });
    // arriving with a material already in mind: open with that side forward
    if (bias) pointerTo(bias === 'gold' ? 0.78 : 0.22);
    bindPointer();
    const tick = () => {
      if (!s.committed && !vertical && pointer.active && pointer.fine) {
        const r = root.getBoundingClientRect();
        if (pointer.y >= r.top && pointer.y <= r.bottom) pointerTo(Math.max(0.15, Math.min(0.85, pointer.x / window.innerWidth)));
      }
      apply();
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      breathTween.current?.kill();
      pointerTo.tween.kill();
    };
  }, [ref, reduced, coarse, bias]);

  // mobile: the split follows the scroll through the section
  useGSAP(
    () => {
      const root = ref.current;
      if (!root || reduced) return;
      const mm = gsap.matchMedia(root);
      mm.add('(max-width: 767px)', () => {
        gsap.to(split.current, { pointer: 0.7, ease: 'none', scrollTrigger: { trigger: root, start: 'top 60%', end: 'bottom 40%', scrub: true }, onStart: () => (split.current.pointer = 0.3) });
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  const choose = (side: 'gold' | 'diamond') => {
    const root = ref.current;
    if (!root) return;
    const s = split.current;
    s.committed = true;
    breathTween.current?.kill();
    gsap.to(s, { breath: 0, duration: 0.3 });
    setBias(side);
    const word = root.querySelector<HTMLElement>(side === 'gold' ? '.duality-word-gold' : '.duality-word-diamond');
    const other = root.querySelector<HTMLElement>(side === 'gold' ? '.duality-word-diamond' : '.duality-word-gold');
    const source = root.querySelector<HTMLElement>(side === 'gold' ? '.duality-gold img' : '.duality-diamond img');
    gsap.to(s, { pointer: side === 'gold' ? 1 : 0, duration: 0.9, ease: 'power3.inOut' });
    if (word) gsap.to(word.parentElement, { scale: 1.4, opacity: 0, duration: 0.8, ease: 'power3.in' });
    if (other) gsap.to(other.parentElement, { opacity: 0, duration: 0.4 });
    window.setTimeout(() => go(`/${side}`, source, 'collection-hero'), 350);
  };

  return (
    <section ref={ref} id="ch08" className="relative h-[110svh] overflow-hidden bg-ink text-ivory" aria-labelledby="duality-title">
      <h2 id="duality-title" className="sr-only">
        {COPY.duality.heading}
      </h2>
      <div className="duality-gold absolute inset-0">
        <Img id="p05-hero" sizes="100vw" plain className="h-full w-full object-cover" data={{ 'flip-source': 'gold' }} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/40" />
      </div>
      <div className="duality-diamond absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
        <Img id="p07-hero" sizes="100vw" plain className="h-full w-full object-cover" data={{ 'flip-source': 'diamond' }} />
        <Video id="diamond-studio" className="opacity-90" ariaLabel="Diamonds in the studio" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/40" />
      </div>
      <div className="duality-divider pointer-events-none absolute top-0 h-full w-px bg-gold-hi/70 md:block" style={{ left: '50%' }} />
      <div className="grain pointer-events-none absolute inset-0" />

      <div className="absolute inset-0 grid grid-rows-2 md:grid-cols-2 md:grid-rows-1">
        <button
          type="button"
          onClick={() => choose('gold')}
          onFocus={() => !split.current.committed && gsap.to(split.current, { pointer: 0.7, duration: 0.8 })}
          className="group/side flex flex-col items-start justify-end p-gutter text-left outline-none md:justify-center md:pl-[8vw]"
          data-cursor="discover"
          aria-label="Gold — pendants, chains, bangles and rings, mostly in 21 karat gold."
        >
          <span className="block origin-left">
            <span className="duality-word-gold display block text-[clamp(3.5rem,12vw,13rem)] leading-none text-ivory" style={{ fontVariationSettings: '"opsz" 96, "wght" 480' }}>
              {COPY.duality.gold.word}
            </span>
          </span>
          <span className="duality-line-gold micro mt-4 text-champagne">{COPY.duality.gold.line}</span>
        </button>
        <button
          type="button"
          onClick={() => choose('diamond')}
          onFocus={() => !split.current.committed && gsap.to(split.current, { pointer: 0.3, duration: 0.8 })}
          className="group/side flex flex-col items-end justify-start p-gutter text-right outline-none md:justify-center md:pr-[8vw]"
          data-cursor="discover"
          aria-label="Diamond — pieces set with diamonds, graded as Waseem publishes them."
        >
          <span className="block origin-right">
            <span className="duality-word-diamond display block text-[clamp(3.5rem,12vw,13rem)] leading-none text-ivory" style={{ fontVariationSettings: '"opsz" 96, "wght" 480' }}>
              {COPY.duality.diamond.word}
            </span>
          </span>
          <span className="duality-line-diamond micro mt-4 text-champagne">{COPY.duality.diamond.line}</span>
        </button>
      </div>
    </section>
  );
}
