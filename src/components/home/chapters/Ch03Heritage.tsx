'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { WaseemLockup } from '@/components/brand/WaseemLockup';
import { SITE } from '@/data/site';
import { COPY } from '@/data/copy';

/**
 * CH03 — since 1952, in one screen.
 *
 * The heritage chapter used to be five screens on a horizontal track with a viewport of
 * empty paper around a numeral. What a visitor needs from a jeweller's history is short:
 * how long, who, and where the doors are. So: the facade turning from monochrome to colour
 * as it arrives, the vitrine and the kundan detail as two prints, the two names, and the
 * three showrooms with their addresses and hours — which are what make a retailer a retailer.
 */
export function Ch03Heritage() {
  const { ref } = useChapter({ id: 'heritage', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);

  // the one treatment that says something: the showroom arrives in colour
  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const facade = root.querySelector<HTMLElement>('.heritage-facade img');
      if (!facade) return;
      const mm = gsap.matchMedia(root);
      mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { reduce } = ctx.conditions as { reduce: boolean };
        if (reduce || reduced) {
          gsap.set(facade, { filter: 'grayscale(0)' });
          return;
        }
        gsap.fromTo(facade, { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', ease: 'none', scrollTrigger: { trigger: facade, start: 'top 85%', end: 'top 35%', scrub: true } });
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <section ref={ref} id="ch03-heritage" data-theme="ivory" className="relative border-t border-ink/10 bg-bg-2 px-gutter py-[9svh] text-ink md:py-[12svh]" aria-labelledby="heritage-title">
      <div ref={scope} className="grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:grid-cols-12 md:items-start">
        {/* the words, and the showrooms */}
        <div className="flex flex-col gap-8 md:col-span-5 md:gap-10">
          <div className="flex flex-col gap-4">
            <Eyebrow className="text-ink/60">{COPY.heritage.eyebrow}</Eyebrow>
            <h2 id="heritage-title" data-split className="display max-w-[9em] text-[clamp(2.25rem,4.2vw,4.5rem)] leading-[1.02] text-ink opacity-0 [text-wrap:balance]">
              {COPY.heritage.title}
            </h2>
            <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ink/70" data-rise>
              {COPY.heritage.line}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink/10 pt-6" data-rise>
            <div className="flex flex-col gap-1">
              <dt className="micro text-ink/45">Founded by</dt>
              <dd className="font-display text-[1.0625rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 16' }}>
                {SITE.founder}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="micro text-ink/45">Expanded by</dt>
              <dd className="font-display text-[1.0625rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 16' }}>
                {SITE.successor}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-4" data-rise>
            <p className="micro text-ink/45">{COPY.heritage.showrooms}</p>
            <ul className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
              {SITE.showrooms.map((s) => (
                <li key={s.id}>
                  <a href={s.mapsUrl} target="_blank" rel="noreferrer" className="group/room flex items-baseline justify-between gap-6 py-3.5 text-ink" data-cursor="open">
                    <span className="shrink-0 whitespace-nowrap font-display text-[1.125rem] leading-tight" style={{ fontVariationSettings: '"opsz" 18' }}>
                      {s.name}
                    </span>
                    <span className="micro max-w-[22em] text-right text-ink/50 transition-colors group-hover/room:text-ink">{s.address}</span>
                    <span className="sr-only"> — opens in Google Maps in a new tab</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="micro text-ink/50">
              {SITE.hours} ·{' '}
              <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
                {SITE.phone}
              </a>
            </p>
          </div>

          <div data-rise>
            <Button variant="bracket" onClick={() => openConsultation({ topic: 'general', source: 'cta' })}>
              {COPY.heritage.cta}
            </Button>
          </div>
        </div>

        {/* the prints */}
        <div className="grid grid-cols-12 gap-x-[3vw] gap-y-[5svh] md:col-span-7 md:col-start-6">
          <figure className="heritage-facade col-span-7 md:col-span-6" data-rise>
            <div className="relative w-full overflow-hidden bg-pearl" style={{ aspectRatio: '4 / 5' }}>
              <Img id="heritage-facade" sizes="(min-width: 768px) 28vw, 56vw" className="object-cover" />
            </div>
            <figcaption className="micro mt-3 text-ink/50">The showroom · Lahore</figcaption>
          </figure>
          <figure className="col-span-5 self-end md:col-span-6 md:mt-[14svh]" data-rise>
            <div className="relative w-full overflow-hidden bg-pearl" style={{ aspectRatio: '1 / 1' }}>
              <Img id="heritage-kundan" sizes="(min-width: 768px) 28vw, 40vw" className="object-cover" />
            </div>
            <figcaption className="micro mt-3 text-ink/50">Kundan · detail</figcaption>
          </figure>
          <figure className="col-span-12 md:col-span-9 md:col-start-2" data-rise>
            <div className="relative w-full overflow-hidden bg-pearl" style={{ aspectRatio: '3 / 2' }}>
              <Img id="heritage-vitrine" sizes="(min-width: 768px) 42vw, 92vw" className="object-cover" />
            </div>
            <figcaption className="micro mt-3 text-ink/50">Gold · the vitrine</figcaption>
          </figure>
          <div className="col-span-12 flex justify-end pt-2 md:col-span-9 md:col-start-2" data-rise>
            <WaseemLockup tone="gold" className="h-[4.5rem] w-auto md:h-[5.5rem]" />
          </div>
        </div>
      </div>
    </section>
  );
}
