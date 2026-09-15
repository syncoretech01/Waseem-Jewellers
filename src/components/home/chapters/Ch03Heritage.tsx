'use client';

import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { Img } from '@/components/media/Img';
import { WaseemMark } from '@/components/brand/WaseemMark';
import { WaseemLockup } from '@/components/brand/WaseemLockup';
import { HERITAGE } from '@/data/heritage';
import { COPY } from '@/data/copy';
import { cn } from '@/lib/cn';

const RATIO: Record<string, string> = { '4:5': '4 / 5', '3:2': '3 / 2', '1:1': '1 / 1', '21:9': '21 / 9' };
const HEIGHT: Record<string, string> = { '4:5': 'md:h-[54svh]', '3:2': 'md:h-[43svh]', '1:1': 'md:h-[46svh]', '21:9': 'md:h-[34svh]' };

/**
 * CH03 — 1952. Ivory paper rises out of the dark around the numeral; then the house's
 * moments pass horizontally, each mounted like a museum print. Copy stays within the
 * facts published by the house; only the facade is treated (monochrome scrubbing to colour).
 */
export function Ch03Heritage() {
  const { ref, ready } = useChapter({ id: 'heritage', theme: 'ivory', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const lead = root.querySelector<HTMLElement>('.heritage-lead');
        const paper = root.querySelector<HTMLElement>('.heritage-paper');
        const numeral = root.querySelector<HTMLElement>('.heritage-numeral');
        const wrap = root.querySelector<HTMLElement>('.heritage-wrap');
        const track = root.querySelector<HTMLElement>('.heritage-track');
        const panels = root.querySelectorAll<HTMLElement>('.heritage-panel');
        const facade = root.querySelector<HTMLElement>('.heritage-facade img');
        if (!lead || !paper || !numeral || !wrap || !track) return;

        // lead-in: paper fades up around the numeral, which turns from champagne to ink
        if (still) {
          gsap.set(paper, { opacity: 1 });
          gsap.set(numeral, { color: '#0B0A09' });
          panels.forEach((p) => {
            const masks = p.querySelectorAll('.h-mask');
            if (masks.length) gsap.set(masks, { clipPath: 'inset(0 0 0 0)' });
          });
          if (facade) gsap.set(facade, { filter: 'grayscale(0)' });
          ready();
          return;
        }
        gsap.fromTo(paper, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 70%', end: 'bottom 60%', scrub: true } });
        gsap.fromTo(numeral, { color: '#e4cfa3' }, { color: '#0B0A09', ease: 'none', scrollTrigger: { trigger: lead, start: 'top 40%', end: 'bottom 55%', scrub: true } });

        if (mobile) {
          panels.forEach((p) => {
            const masks = p.querySelectorAll('.h-mask');
            if (masks.length) gsap.fromTo(masks, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'wj.out', scrollTrigger: { trigger: p, start: 'top 80%', once: true } });
            gsap.fromTo(p.querySelectorAll('.h-line'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'wj.out', scrollTrigger: { trigger: p, start: 'top 75%', once: true } });
          });
          if (facade) gsap.fromTo(facade, { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', ease: 'none', scrollTrigger: { trigger: facade, start: 'top 80%', end: 'top 30%', scrub: true } });
          ready();
          return;
        }

        const distance = () => track.scrollWidth - window.innerWidth;
        const scrub = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: wrap,
            start: 'top top',
            end: () => '+=' + distance(),
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        ready();

        panels.forEach((p) => {
          const masks = p.querySelectorAll<HTMLElement>('.h-mask');
          const inner = p.querySelector<HTMLElement>('.h-inner');
          const lines = p.querySelectorAll<HTMLElement>('.h-line');
          // panels standing inside the first viewport reveal as the track arrives; the rest as they travel in
          const inFirstView = p.offsetLeft < window.innerWidth * 0.88;
          const revealTrigger = inFirstView ? { trigger: wrap, start: 'top 70%', once: true } : { trigger: p, containerAnimation: scrub, start: 'left 88%', once: true };
          const lineTrigger = inFirstView ? { trigger: wrap, start: 'top 60%', once: true } : { trigger: p, containerAnimation: scrub, start: 'left 75%', once: true };
          if (masks.length) gsap.fromTo(masks, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'wj.out', scrollTrigger: revealTrigger });
          gsap.fromTo(lines, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1, ease: 'wj.out', scrollTrigger: lineTrigger });
          if (inner) {
            gsap.fromTo(inner, { xPercent: -6, scale: 1.16 }, { xPercent: 6, scale: 1, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: scrub, start: 'left right', end: 'right left', scrub: true } });
          }
        });
        if (facade) gsap.fromTo(facade, { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', ease: 'none', scrollTrigger: { trigger: facade.closest('.heritage-panel'), containerAnimation: scrub, start: 'left 70%', end: 'center 40%', scrub: true } });

        // the numeral travels against the track through the first two panels
        const travel = root.querySelector<HTMLElement>('.heritage-travel');
        if (travel) gsap.fromTo(travel, { xPercent: 0 }, { xPercent: 60, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top top', end: () => '+=' + distance() * 0.45, scrub: true } });
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <section ref={ref} id="ch03" className="relative bg-ink text-ink" aria-labelledby="heritage-title">
      {/* lead-in: 1952 on ink, paper rising */}
      <div className="heritage-lead relative h-[48svh] overflow-hidden">
        <div className="heritage-paper absolute inset-0 bg-ivory opacity-0" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          <p className="micro text-champagne">{COPY.heritage.eyebrow}</p>
          <p className="heritage-numeral display text-[clamp(5rem,16vw,15rem)] leading-none text-champagne" aria-hidden>
            1952
          </p>
          <h2 id="heritage-title" className="sr-only">
            Waseem Jewellers, since 1952
          </h2>
        </div>
      </div>

      {/* the horizontal track */}
      <div className="heritage-wrap relative bg-ivory md:h-svh md:overflow-hidden">
        <div className="pointer-events-none absolute right-[5vw] top-1/2 hidden w-[24vw] -translate-y-1/2 opacity-[0.035] md:block">
          <WaseemMark variant="crest" tone="ink" className="w-full" />
        </div>
        <div className="heritage-track flex w-full flex-col items-start gap-[14svh] px-gutter py-[12svh] md:h-full md:w-max md:flex-row md:items-center md:gap-[5vw] md:px-[6vw] md:py-0">
          <div className="heritage-travel pointer-events-none absolute left-[8vw] top-[calc(var(--nav-h)+2svh)] hidden md:block">
            <p className="display text-[clamp(3rem,6.5vw,6.5rem)] leading-none text-ink/8" aria-hidden>
              1952
            </p>
          </div>
          {HERITAGE.map((m) => (
            <article key={m.id} className={cn('heritage-panel relative flex w-full shrink-0 flex-col gap-8 md:w-auto md:flex-row md:items-end md:gap-[3vw]', m.ratio === '21:9' && 'md:items-center')}>
              <div className={cn('flex flex-col gap-4', m.ratio === '21:9' ? 'md:order-2 md:w-[20vw]' : 'md:w-[14vw] md:min-w-[11.5rem] md:pb-[7svh]')}>
                <p className="h-line micro text-ink/60">{m.numeral}</p>
                <p className="h-line display text-[clamp(1.6rem,2.6vw,2.9rem)] leading-[1.04] text-ink">{m.line}</p>
                {m.fact && (
                  <p className="h-line font-display italic text-[1.0625rem] leading-snug text-ink/75" style={{ fontVariationSettings: '"opsz" 16' }}>
                    {m.fact}
                  </p>
                )}
              </div>
              <figure className={cn('relative w-full shrink-0 md:w-auto', m.ratio === '21:9' ? 'md:w-[52vw]' : HEIGHT[m.ratio], m.treatment === 'monochrome-to-colour' && 'heritage-facade')}>
                <div className="pointer-events-none absolute -inset-4 border border-ink/35 md:-inset-8" aria-hidden />
                <div className={cn('h-mask relative w-full overflow-hidden md:h-full', m.ratio !== '21:9' && 'md:w-auto')} style={{ aspectRatio: RATIO[m.ratio] }}>
                  <div className="h-inner absolute inset-0">
                    <Img id={m.image} sizes="(min-width: 768px) 60vw, 90vw" className="object-cover" />
                  </div>
                </div>
                {m.caption && (
                  <figcaption className="h-line micro absolute -bottom-8 left-0 text-ink/60 md:-bottom-12">
                    {m.numeral} · {m.caption}
                  </figcaption>
                )}
              </figure>
            </article>
          ))}
          {/* seal */}
          <div className="heritage-panel relative flex w-full shrink-0 flex-col items-center justify-center gap-6 py-[6svh] text-center md:h-full md:w-[26vw] md:py-0">
            {/* the lockup is 3.4:1; at h-28 it is 384px wide, which is wider than a 360px phone */}
            <WaseemLockup tone="ink" className="h-auto w-[min(24rem,80vw)] md:h-28 md:w-auto" />
            <p className="h-line display text-[clamp(1.5rem,2.2vw,2.4rem)] text-ink">{COPY.heritage.closing}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
