'use client';

import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useChapter } from '@/motion/hooks/useChapter';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { Video } from '@/components/media/Video';
import { Button } from '@/components/ui/Button';
import { COPY } from '@/data/copy';

/** The portrait window and the closing frame share these proportions with the wall's first tile. */
export const BRIDAL_FRAME = { widthVw: 28, ratio: 1.25 };

function portraitInset(vw: number, vh: number, widthVw: number) {
  const w = (vw * widthVw) / 100;
  const h = w * BRIDAL_FRAME.ratio;
  const x = (vw - w) / 2;
  const y = (vh - h) / 2;
  return `inset(${Math.max(0, y)}px ${x}px ${Math.max(0, y)}px ${x}px)`;
}

/**
 * CH05 — bridal cinema. A portrait window on the Naqsh-e-Gul film opens into full cinema,
 * the room darkens around the words, and at the close the frame contracts to the wall's
 * first portrait as ivory rises — the film becoming the first piece.
 */
export function Ch05Bridal() {
  const { ref, ready } = useChapter({ id: 'bridal', theme: 'dark', pinned: true });
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const openConsultation = useSiteStore((s) => s.openConsultation);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia(root);
      mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
        const { mobile } = ctx.conditions as { mobile: boolean };
        const film = root.querySelector<HTMLElement>('.bridal-film');
        const frame = root.querySelector<HTMLElement>('.bridal-frame');
        const ambient = root.querySelector<HTMLElement>('.bridal-ambient');
        const paper = root.querySelector<HTMLElement>('.bridal-paper');
        const words = root.querySelectorAll<HTMLElement>('.bridal-word');
        const tail = root.querySelectorAll<HTMLElement>('.bridal-tail');
        const opening = root.querySelector<HTMLElement>('.bridal-opening');
        if (!film || !frame || !ambient || !paper) return;

        if (reduced) {
          gsap.set(film, { clipPath: 'inset(0px)' });
          gsap.set([words, tail, opening], { autoAlpha: 1 });
          ready();
          return;
        }
        if (mobile) {
          gsap.set(film, { clipPath: 'inset(0px)' });
          gsap.fromTo(words, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12, ease: 'wj.out', scrollTrigger: { trigger: root, start: 'top 40%', once: true } });
          gsap.fromTo(tail, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'wj.out', scrollTrigger: { trigger: root, start: 'top 30%', once: true } });
          gsap.set(opening, { autoAlpha: 1 });
          ready();
          return;
        }

        const openInset = () => portraitInset(window.innerWidth, window.innerHeight, 34);
        const closeInset = () => portraitInset(window.innerWidth, window.innerHeight, BRIDAL_FRAME.widthVw);
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: '+=240%',
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        tl.fromTo(film, { clipPath: openInset }, { clipPath: 'inset(0px 0px 0px 0px)', ease: 'power1.inOut', duration: 0.35 }, 0)
          .fromTo(frame, { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.2 }, 0.35)
          .fromTo(opening, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', duration: 0.15 }, 0.2)
          .fromTo(ambient, { opacity: 0 }, { opacity: 0.6, ease: 'none', duration: 0.25 }, 0.55)
          .fromTo(words, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.16, stagger: 0.04 }, 0.62)
          .fromTo(tail, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, ease: 'none', duration: 0.1, stagger: 0.03 }, 0.74)
          // the close: words fade, the frame contracts to the first portrait, ivory rises, film → still
          .to([words, tail], { autoAlpha: 0, y: -12, ease: 'none', duration: 0.08 }, 0.83)
          .to(ambient, { opacity: 0, ease: 'none', duration: 0.1 }, 0.83)
          .to(film, { clipPath: closeInset, ease: 'power1.inOut', duration: 0.17 }, 0.83)
          .fromTo(paper, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', ease: 'none', duration: 0.15 }, 0.85);
        ready();
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <section ref={ref} id="ch05" className="relative h-[160svh] overflow-hidden bg-ink text-ivory md:h-svh" aria-labelledby="bridal-title">
      <div className="bridal-paper pointer-events-none absolute inset-0 bg-ivory" style={{ clipPath: 'inset(100% 0 0 0)' }} />
      <div className="bridal-film absolute inset-0 overflow-hidden" style={{ clipPath: 'inset(0px)' }}>
        <Video id="bridal-cinema" ariaLabel="Naqsh-e-Gul — the bridal film" />
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="bridal-frame pointer-events-none absolute inset-0 hidden md:block">
          <div className="absolute left-1/2 top-1/2 h-[calc(34vw*1.25-48px)] w-[calc(34vw-48px)] -translate-x-1/2 -translate-y-1/2 border border-gold-hi/70" />
        </div>
      </div>
      <div className="bridal-ambient pointer-events-none absolute inset-0 bg-ink opacity-0" />

      {/* opening caption beneath the portrait window */}
      <div className="bridal-opening pointer-events-none absolute inset-x-0 bottom-[8svh] hidden flex-col items-center gap-3 md:flex">
        <p className="micro text-champagne">{COPY.bridal.eyebrow}</p>
        <p className="font-display italic text-[1.125rem] text-ivory/80" style={{ fontVariationSettings: '"opsz" 18' }}>
          {COPY.bridal.opening}
        </p>
      </div>

      {/* the words */}
      <div className="absolute inset-0 flex flex-col justify-end px-gutter pb-[10svh] md:justify-center md:pb-0">
        <h2 id="bridal-title" className="display text-[clamp(3rem,8.5vw,9.5rem)] leading-[0.95] text-ivory">
          {COPY.bridal.closing.map((line, i) => (
            <span key={line} className={i === 2 ? 'bridal-word block italic text-champagne' : 'bridal-word block'}>
              {line}
            </span>
          ))}
        </h2>
        <p className="bridal-tail micro mt-8 text-champagne">{COPY.bridal.house}</p>
        <div className="bridal-tail mt-6 flex flex-wrap items-center gap-x-10 gap-y-4">
          <Button variant="bracket" href="/collections/bridal" cursor="discover">
            {COPY.bridal.ctaDiscover}
          </Button>
          <Button variant="hairline" onClick={() => openConsultation({ topic: 'bridal', source: 'cta' })}>
            {COPY.bridal.ctaConsult}
          </Button>
        </div>
      </div>
    </section>
  );
}
