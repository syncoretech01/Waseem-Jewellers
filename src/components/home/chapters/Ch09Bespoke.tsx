'use client';

import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { LoaderStone } from '@/components/loader/LoaderStone';
import { facetPath, GEM_OUTLINE } from '@/lib/three/gemGeometry';
import { COPY } from '@/data/copy';
import { cn } from '@/lib/cn';

const GEM_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${facetPath(GEM_OUTLINE)}' fill='black'/></svg>`)}")`;

/**
 * CH09 — bespoke. Five cards laid on the tray, one per step: an idea drawn as a stone
 * outline on paper, the stone itself, form (the outline becoming a photograph), craft, and
 * the piece worn. The consultation is the only door.
 */
export function Ch09Bespoke() {
  const { ref, ready } = useChapter({ id: 'bespoke', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
        const { mobile, reduce } = ctx.conditions as { mobile: boolean; reduce: boolean };
        // the media query is the source of truth: gsap reverts the other branch when it flips
        const still = reduce || reduced;
        const stage = root.querySelector<HTMLElement>('.bespoke-stage');
        const cards = (mobile ? root : stage ?? root).querySelectorAll<HTMLElement>('.bespoke-card');
        const words = root.querySelectorAll<HTMLElement>('.bespoke-word');
        const outline = root.querySelector<SVGPathElement>('.bespoke-outline .stone-outline');
        const facets = root.querySelectorAll<SVGPathElement>('.bespoke-outline .stone-facet');
        const photo = root.querySelector<HTMLElement>('.bespoke-photo');
        const cta = root.querySelector<HTMLElement>('.bespoke-cta');

        if (mobile || still) {
          gsap.set([cards, words, cta], { autoAlpha: 1, clearProps: 'transform' });
          if (photo) gsap.set(photo, { opacity: 1 });
          if (!still) {
            cards.forEach((c) => gsap.fromTo(c, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'wj.out', scrollTrigger: { trigger: c, start: 'top 85%', once: true } }));
          }
          ready();
          return;
        }

        // stroke lengths for the drawing card
        const strokes = [outline, ...facets].filter(Boolean) as SVGPathElement[];
        strokes.forEach((p) => {
          const len = p.getTotalLength();
          p.style.strokeDasharray = `${len}`;
          p.style.strokeDashoffset = `${len}`;
        });

        const tl = gsap.timeline({
          scrollTrigger: { trigger: root, start: 'top top', end: '+=175%', pin: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true },
        });
        const step = 0.19;
        cards.forEach((card, k) => {
          const at = k * step;
          tl.fromTo(card, { y: '-16svh', rotationX: 10, z: -180, autoAlpha: 0 }, { y: 0, rotationX: 0, z: 0, autoAlpha: 1, ease: 'power2.out', duration: step * 0.7 }, at);
          if (k > 0) {
            const prev = cards[k - 1]!;
            tl.to(prev, { y: '6svh', autoAlpha: 0.3, ease: 'power1.inOut', duration: step * 0.6 }, at + step * 0.1);
            const label = prev.querySelectorAll('.card-label');
            if (label.length) tl.to(label, { opacity: 0, ease: 'none', duration: step * 0.3 }, at);
          }
          const word = words[k];
          if (word) {
            tl.fromTo(word, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, ease: 'none', duration: step * 0.35 }, at + step * 0.1);
            if (k < cards.length - 1) tl.to(word, { autoAlpha: 0, y: -10, ease: 'none', duration: step * 0.25 }, at + step * 0.95);
          }
        });
        // the idea draws itself during step one
        strokes.forEach((p, i) => tl.to(p, { strokeDashoffset: 0, ease: 'none', duration: step * 0.9 }, 0.02 + i * 0.002));
        // form: the outline fills with the photograph
        if (photo) tl.fromTo(photo, { opacity: 0 }, { opacity: 1, ease: 'none', duration: step * 0.5 }, 2 * step + step * 0.3);
        if (cta) tl.fromTo(cta, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.06 }, 0.9);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <section ref={ref} id="ch09" className="relative bg-ink text-ivory md:h-svh md:overflow-hidden" aria-labelledby="bespoke-title">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[46svh] md:block" style={{ background: 'linear-gradient(180deg, transparent 0%, #100d0b 60%, #0B0A09 100%)' }} />
      <div className="pointer-events-none absolute left-1/2 top-[62%] hidden h-[26svh] w-[54vw] -translate-x-1/2 rounded-[100%] md:block" style={{ background: 'radial-gradient(ellipse, rgba(216,195,165,0.14) 0%, rgba(216,195,165,0.03) 50%, transparent 72%)' }} />

      <div className="relative z-10 flex items-start justify-between px-gutter pt-[7svh] md:absolute md:inset-x-0 md:top-0">
        <p className="micro text-champagne">{COPY.bespoke.eyebrow}</p>
        <h2 id="bespoke-title" className="sr-only">
          Bespoke
        </h2>
      </div>

      {/* desktop: the tray */}
      <div className="bespoke-stage relative hidden h-full md:block" style={{ perspective: '1400px' }}>
        <div className="pointer-events-none absolute left-[8vw] top-1/2 flex -translate-y-1/2 flex-col gap-2">
          {COPY.bespoke.words.map((w, i) => (
            <p key={w} className="bespoke-word absolute left-0 top-0 flex items-baseline gap-5 whitespace-nowrap opacity-0">
              <span className="font-display text-[0.8125rem] text-champagne" style={{ fontVariationSettings: '"opsz" 12' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="display text-[clamp(2.5rem,5.5vw,6rem)] leading-none text-ivory">{w}</span>
            </p>
          ))}
        </div>

        <Card className="bg-pearl">
          <div className="bespoke-outline absolute inset-[14%]">
            <LoaderStone id="bespoke-idea" outlineOnly className="[&_.stone-lines]:stroke-ink/70" />
          </div>
          <span className="card-label micro absolute bottom-6 left-6 text-ink/55">The idea</span>
        </Card>
        <Card>
          <Img id="bespoke-stone" sizes="34vw" className="object-cover" />
        </Card>
        <Card className="bg-pearl">
          <div className="absolute inset-[14%]">
            <LoaderStone id="bespoke-form" outlineOnly className="[&_.stone-lines]:stroke-ink/60" />
            <div className="bespoke-photo absolute inset-0 opacity-0" style={{ WebkitMaskImage: GEM_MASK, maskImage: GEM_MASK, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}>
              <Img id="p09-hero" sizes="34vw" alt="" className="object-cover" />
            </div>
          </div>
          <span className="card-label micro absolute bottom-6 left-6 text-ink/55">Form</span>
        </Card>
        <Card>
          <Img id="bespoke-form" sizes="34vw" className="object-cover" />
        </Card>
        <Card>
          <Img id="bespoke-bride" sizes="34vw" className="object-cover" />
        </Card>

        <div className="bespoke-cta absolute bottom-[9svh] left-1/2 -translate-x-1/2 opacity-0">
          <Button variant="bracket" onClick={() => openConsultation({ topic: 'bespoke', source: 'cta' })} cursor="discover">
            {COPY.bespoke.cta}
          </Button>
        </div>
      </div>

      {/* mobile: stacked */}
      <div className="bespoke-stack flex flex-col gap-12 px-gutter pb-20 pt-10 md:hidden">
        {COPY.bespoke.words.map((w, i) => (
          <div key={w} className="bespoke-card flex flex-col gap-4">
            <p className="flex items-baseline gap-4">
              <span className="font-display text-[0.8125rem] text-champagne">{String(i + 1).padStart(2, '0')}</span>
              <span className="display text-[2.4rem] leading-none text-ivory">{w}</span>
            </p>
            <div className={cn('relative w-full overflow-hidden', i === 0 || i === 2 ? 'bg-pearl' : 'bg-charcoal')} style={{ aspectRatio: '4 / 5' }}>
              {i === 0 && (
                <div className="absolute inset-[14%]">
                  <LoaderStone id="bespoke-idea-m" outlineOnly className="[&_.stone-lines]:stroke-ink/70" />
                </div>
              )}
              {i === 1 && <Img id="bespoke-stone" sizes="92vw" className="object-cover" />}
              {i === 2 && (
                <div className="absolute inset-[14%]" style={{ WebkitMaskImage: GEM_MASK, maskImage: GEM_MASK, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}>
                  <Img id="p09-hero" sizes="92vw" alt="" className="object-cover" />
                </div>
              )}
              {i === 3 && <Img id="bespoke-form" sizes="92vw" className="object-cover" />}
              {i === 4 && <Img id="bespoke-bride" sizes="92vw" className="object-cover" />}
            </div>
          </div>
        ))}
        <div className="pt-2">
          <Button variant="bracket" onClick={() => openConsultation({ topic: 'bespoke', source: 'cta' })}>
            {COPY.bespoke.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bespoke-card absolute left-1/2 top-1/2 w-[34vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-charcoal opacity-0 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]', className)} style={{ aspectRatio: '4 / 5', transformStyle: 'preserve-3d' }}>
      {children}
    </div>
  );
}
