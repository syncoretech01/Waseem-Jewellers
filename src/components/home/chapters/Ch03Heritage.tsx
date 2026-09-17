'use client';

import { useRef, type CSSProperties } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { WaseemLockup } from '@/components/brand/WaseemLockup';
import { CREST, LOCKUP_VIEWBOX, MONOGRAM } from '@/components/brand/markGeometry';
import { WORD_1, WORD_2 } from '@/components/brand/wordmarkGeometry';
import { cn } from '@/lib/cn';
import { SITE } from '@/data/site';
import { COPY } from '@/data/copy';
import { HERITAGE_COPY, showroomsInOrder } from '@/data/heritage';

/**
 * The lockup's viewBox is the brand master's whole frame, with the artwork centred between
 * wide empty margins — right for the loader, where it is centred anyway, but set at a modest
 * height against an edge it lands a third of its own width short of it. This measures the
 * drawn bounds from the four parts' offsets and crops the frame to them, as percentages of
 * the crop, so the wordmark's right edge is the edge that aligns. Derived, not typed in: if
 * the generated geometry moves, so does the crop.
 */
const LOCKUP_CROP = (() => {
  const box = (vb: string) => vb.split(' ').map(Number) as [number, number, number, number];
  const [, , , frameH] = box(LOCKUP_VIEWBOX);
  const parts = [CREST, MONOGRAM, WORD_1, WORD_2].map((p) => {
    const [, , w, h] = box(p.viewBox);
    return { x0: p.offset.x, y0: p.offset.y, x1: p.offset.x + w, y1: p.offset.y + h };
  });
  const x0 = Math.min(...parts.map((p) => p.x0));
  const y0 = Math.min(...parts.map((p) => p.y0));
  const w = Math.max(...parts.map((p) => p.x1)) - x0;
  const h = Math.max(...parts.map((p) => p.y1)) - y0;
  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
  return {
    aspectRatio: `${w} / ${h}`,
    '--lk-h': pct(frameH / h),
    '--lk-left': pct(-x0 / w),
    '--lk-top': pct(-y0 / h),
  } as CSSProperties;
})();

/** The gold lockup at the height its className sets, with nothing but the artwork inside its box. */
function Lockup({ className }: { className?: string }) {
  return (
    <span className={cn('relative block overflow-hidden', className)} style={LOCKUP_CROP}>
      <WaseemLockup tone="gold" className="absolute left-(--lk-left) top-(--lk-top) h-(--lk-h) w-auto max-w-none" />
    </span>
  );
}

/**
 * CH03 — since 1952, in one screen.
 *
 * What the homepage says about the firm, in the client's order: the name, the year, the
 * city, the generations, the showrooms. Nothing about who founded it or who expanded it —
 * those facts stay in SITE for the pages that need them; the homepage does not lead with
 * ownership succession. One image, the facade, arriving from monochrome into colour; the
 * three showrooms as a grid whose three columns hold across the three rows; the hours and
 * the telephone as one line; then a closing band with the line and the lockup, as a colophon.
 *
 * Twelve columns: the words and the showrooms in the left five, the facade in the right seven,
 * the band across all twelve. On a phone the statement leads, the facade follows, then the
 * showrooms, the door, and the band closes the chapter.
 */
export function Ch03Heritage() {
  const { ref } = useChapter({ id: 'heritage', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const showrooms = showroomsInOrder();
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
      /**
       * Both preferences are named so one of them always matches: matchMedia only calls
       * the function when a condition holds, and with `reduce` alone the scrub was never
       * created for a visitor who had not asked for stillness — the facade simply sat in
       * colour. The media query stays the source of truth; gsap reverts on a flip.
       */
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
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
      <div ref={scope} className="wj-content grid grid-cols-1 gap-x-[var(--gap)] gap-y-[7svh] md:grid-cols-12 md:items-start">
        {/* the words, the showrooms, the door — on a phone the statement leads and the facade follows it */}
        <div className="contents md:col-span-5 md:flex md:flex-col md:gap-12">
          <div className="order-1 flex flex-col gap-5 md:order-none">
            <Eyebrow className="text-ink/60">{HERITAGE_COPY.eyebrow}</Eyebrow>
            <h2 id="heritage-title" data-split className="display text-[clamp(3.25rem,6.6vw,7.5rem)] leading-[0.95] text-ink opacity-0">
              {HERITAGE_COPY.statement}
            </h2>
            <p className="font-display text-[clamp(1.375rem,1.9vw,1.875rem)] leading-[1.15] text-ink" style={{ fontVariationSettings: '"opsz" 28' }} data-rise>
              {HERITAGE_COPY.line}
            </p>
            <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ink/70" data-rise>
              {HERITAGE_COPY.prose}
            </p>
          </div>

          {/* three showrooms, three columns that hold across the three rows; on a phone the address takes its own line */}
          <div className="order-3 flex flex-col gap-4 md:order-none" data-rise>
            <p className="micro text-ink/45">{COPY.heritage.showrooms}</p>
            <ul className="grid grid-cols-[1fr_auto] gap-x-5 border-t border-ink/10 md:grid-cols-[auto_1fr_auto] md:gap-x-6">
              {showrooms.map((s) => (
                <li key={s.id} className="col-span-2 grid grid-cols-subgrid items-baseline gap-y-1.5 border-b border-ink/10 py-4 md:col-span-3">
                  <span className="font-display text-[1.125rem] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 18' }}>
                    {s.name}
                  </span>
                  <span className="micro order-last col-span-2 leading-[1.7] text-ink/55 md:order-none md:col-span-1">{s.address}</span>
                  <a
                    href={s.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="micro justify-self-end py-1 text-ink/70 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
                    data-cursor="open"
                  >
                    {HERITAGE_COPY.map}
                    <span className="sr-only">
                      {' '}
                      — {s.name}, {HERITAGE_COPY.mapNote}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-1">
              <span className="flex items-baseline gap-3">
                <span className="micro text-ink/45">{HERITAGE_COPY.hours}</span>
                <span className="text-[0.9375rem] text-ink">{SITE.hours}</span>
              </span>
              <span className="flex items-baseline gap-3">
                <span className="micro text-ink/45">{HERITAGE_COPY.telephone}</span>
                <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="text-[0.9375rem] text-ink underline-offset-4 transition-colors hover:underline">
                  {SITE.phone}
                </a>
              </span>
            </p>
          </div>

          <div className="order-4 md:order-none" data-rise>
            <Button variant="bracket" onClick={() => openConsultation({ topic: 'general', source: 'cta' })}>
              {COPY.heritage.cta}
            </Button>
          </div>
        </div>

        {/* the facade: in the right seven columns, set to the content's right edge, and never wider than its source can honestly fill */}
        <figure className="heritage-facade order-2 flex w-full flex-col gap-3 md:order-none md:col-span-7 md:max-w-[36rem] md:justify-self-end" data-rise>
          <div className="relative w-full overflow-hidden bg-pearl" style={{ aspectRatio: '4 / 5' }}>
            <Img id="heritage-facade" sizes="(min-width: 1380px) 576px, (min-width: 768px) 52vw, 100vw" className="object-cover" />
          </div>
          <figcaption className="micro text-ink/50">{HERITAGE_COPY.caption}</figcaption>
        </figure>

        {/* the band: the line at the text column's left edge, the lockup at the facade's right edge */}
        <div className="order-5 flex flex-col gap-8 border-t border-ink/10 pt-7 md:order-none md:col-span-12 md:flex-row md:items-end md:justify-between md:gap-8 md:pt-8" data-rise>
          <p className="font-display text-[clamp(1.125rem,1.4vw,1.5rem)] leading-[1.2] tracking-[0.04em] text-ink" style={{ fontVariationSettings: '"opsz" 24' }}>
            {COPY.heritage.closing}
          </p>
          <Lockup className="h-20 shrink-0 self-start md:h-24 md:self-auto" />
        </div>
      </div>
    </section>
  );
}
