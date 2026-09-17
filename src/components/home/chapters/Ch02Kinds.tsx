'use client';

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Img } from '@/components/media/Img';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { pieceRefOf } from '@/data/clientIndex';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useProductVisibility } from '@/motion/hooks/useProductVisibility';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { COPY } from '@/data/copy';
import type { ShowcaseCategory } from '@/lib/facets';
import { tagOf } from './showcase';
import { cn } from '@/lib/cn';

/** The order a jeweller lays a window: rings first, then what is worn at the neck, the ear, the wrist, and the rest. */
const ORDER = ['ring', 'necklace', 'earrings', 'bangle', 'bracelet', 'pendant', 'chain', 'bridal-set', 'cufflink'];

/** the one plate spans seven of twelve columns */
const PLATE_SIZES = '(min-width: 768px) 54vw, 92vw';

/**
 * The plate: every kind's packshot stacked on one pearl ground, the active one shown. Only
 * opacity changes between them (src/styles/cards.css), so a change of kind is a crossfade on
 * one plate rather than a new plate. The plate is the door into the kind; the piece it shows
 * is named beneath and has a door of its own. The bridal kind fronts on a jewellery-only crop
 * of a suite, never a bride's face.
 */
function KindPlate({ kinds, active, lit }: { kinds: ShowcaseCategory[]; active: ShowcaseCategory; lit: boolean }) {
  // the piece on the plate is a piece in view for the concierge, though the plate itself opens the kind
  const ref = useProductVisibility<HTMLDivElement>(active.hero.s);
  return (
    <>
      <div ref={ref} className="md:col-span-7 md:row-start-1" data-kind={active.category} data-lit={lit ? '1' : '0'} data-rise>
        <TransitionLink href={active.href} className="group/kind relative block" data-card="hero" data-cursor="explore" aria-label={`${active.label} — ${COPY.window.explore}`}>
          {/* a square hero: the shop photographs every piece square, and the window is the one place a piece is shown at its own frame */}
          <div className="wj-plate relative w-full" data-packshot="" style={{ aspectRatio: '1 / 1' }}>
            <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/kind:scale-[1.03] group-focus-visible/kind:scale-[1.03]">
              {kinds.map((kind, i) => {
                const on = kind.category === active.category;
                return (
                  <div key={kind.category} className="wj-kind-layer" data-active={on ? '1' : '0'} aria-hidden={!on}>
                    {kind.image ? (
                      <Img id={kind.image} sizes={PLATE_SIZES} plain alt="" eager={i === 0} className="h-full w-full object-cover" data={{ 'flip-source': kind.hero.s }} />
                    ) : (
                      <Img image={pieceRefOf(kind.hero).media.hero} sizes={PLATE_SIZES} plain alt="" eager={i === 0} data={{ 'flip-source': kind.hero.s }} />
                    )}
                  </div>
                );
              })}
            </div>
            <span aria-hidden className="hairline absolute inset-x-0 top-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/kind:scale-x-100 group-focus-visible/kind:scale-x-100" />
            {/* a kind the concierge was asked about is lit for a moment */}
            <span aria-hidden className={cn('pointer-events-none absolute inset-0 border border-gold-hi transition-opacity duration-700', lit ? 'opacity-100' : 'opacity-0')} />
          </div>
        </TransitionLink>
      </div>

      {/* beneath the plate, at the caption's offset: the kind, named large, and the piece shown, named as a piece — each a door */}
      <div className="wj-caption gap-3 md:col-span-7 md:col-start-1 md:row-start-2 md:flex-row md:items-end md:justify-between md:gap-6" data-rise>
        <TransitionLink key={`kind-${active.category}`} href={active.href} className="stage-word group/door flex items-baseline gap-4" data-cursor="explore">
          <span className="display text-[clamp(1.75rem,2.6vw,2.75rem)] leading-none text-ink transition-colors group-hover/door:text-gold-deep">{active.label}</span>
          <span className="micro text-ink/45 transition-colors group-hover/door:text-ink">{COPY.window.explore}</span>
        </TransitionLink>
        <TransitionLink key={`piece-${active.hero.s}`} href={`/jewellery/${active.hero.s}`} className="stage-word group/piece flex flex-col gap-1 md:items-end md:text-right" data-cursor="view">
          <span className="wj-caption-name" style={{ '--card-name': '1.0625rem', '--card-opsz': 16 } as CSSProperties}>
            {active.hero.t}
          </span>
          {tagOf(active.hero) && <span className="wj-caption-tag">{tagOf(active.hero)}</span>}
        </TransitionLink>
      </div>
    </>
  );
}

/**
 * CH02 — the collection, by kind.
 *
 * The first thing after the film is what a jeweller keeps in the glass, arranged the way a
 * visitor thinks: one plate, and beside it the kinds. The plate shows the active kind on one
 * of its pieces photographed as a piece; a hand or a focus on a kind in the rail changes what
 * the plate shows, and choosing one opens it. On a phone the rail is a row beneath the plate
 * and a tap chooses the kind before a second tap opens it. No counts: a window says what is
 * made, not how many are in the back.
 */
export function Ch02Kinds({ kinds }: { kinds: ShowcaseCategory[] }) {
  const { ref } = useChapter({ id: 'vitrine', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const highlighted = useSiteStore((s) => (s as unknown as { highlightedCategory?: string | null }).highlightedCategory ?? null);
  const coarse = useQualityStore((s) => s.coarse);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  useSplitReveal(scope, {
    selector: '[data-split]',
    type: 'lines',
    stagger: 0.07,
  });
  useRise(scope);
  const byKind = new Map(kinds.map((k) => [k.category, k]));
  const rail = ORDER.map((c) => byKind.get(c)).filter((k): k is ShowcaseCategory => Boolean(k));
  const [chosen, setChosen] = useState<string | null>(null);
  // a kind the concierge lights is the kind the plate shows — taken in the render that first sees it, not an effect after it
  const [lastLit, setLastLit] = useState<string | null>(null);
  if (highlighted !== lastLit) {
    setLastLit(highlighted);
    if (highlighted && kinds.some((k) => k.category === highlighted)) setChosen(highlighted);
  }
  const active = rail.find((k) => k.category === chosen) ?? rail[0];
  const railRef = useRef<HTMLUListElement>(null);

  // on a phone the rail is a row: the chosen kind is brought into it, and only the row moves — never the page
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!rail || !item || rail.scrollWidth <= rail.clientWidth) return;
    const left = item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: reduced ? 'auto' : 'smooth' });
  }, [active?.category, reduced]);

  if (!active) return null;

  // on a touch screen the first tap chooses the kind and the second opens it; a pointer has hover for that
  const tap = (kind: ShowcaseCategory) => (e: MouseEvent<HTMLAnchorElement>) => {
    const type = (e.nativeEvent as Partial<PointerEvent>).pointerType;
    const touch = type === 'touch' || (type === undefined && coarse);
    if (touch && kind.category !== active.category) {
      e.preventDefault();
      setChosen(kind.category);
    }
  };

  return (
    <section ref={ref} id="ch02-kinds" data-theme="ivory" className="relative bg-ivory px-gutter py-[var(--chapter-y)] text-ink" aria-labelledby="kinds-title">
      <div ref={scope} className="wj-content">
        <div className="wj-grid md:items-end">
          <div className="flex flex-col gap-4 md:col-span-7">
            <Eyebrow className="text-ink/60">{COPY.window.eyebrow}</Eyebrow>
            <h2 id="kinds-title" data-split className="display max-w-[13em] text-[clamp(2.25rem,4.4vw,4.75rem)] leading-[1.02] text-ink opacity-0 [text-wrap:balance]">
              {COPY.window.title}
            </h2>
          </div>
          <p className="max-w-[30em] text-[0.9375rem] leading-relaxed text-ink/70 md:col-span-4 md:col-start-9 md:pb-2" data-rise>
            {COPY.window.line}
          </p>
        </div>

        {/* the plate in seven columns, its caption beneath at the caption's offset, and the rail in the last four — as tall as the plate, so the two close on one line */}
        <div className="wj-grid mt-[var(--block-y)] gap-y-0 md:items-stretch">
          <KindPlate kinds={rail} active={active} lit={highlighted === active.category} />

          {/* the rail: every kind, in the order a window is laid — a hand or a focus shows it, a choice opens it */}
          <nav className="mt-6 flex flex-col md:col-span-4 md:col-start-9 md:row-start-1 md:mt-0" aria-label={COPY.window.kinds} data-rise>
            <ul ref={railRef} className="wj-rail md:flex-1" data-kinds>
              {rail.map((kind) => {
                const on = kind.category === active.category;
                return (
                  <li key={kind.category} className="md:flex md:flex-1 md:flex-col" data-kind={kind.category} data-lit={highlighted === kind.category ? '1' : '0'}>
                    <TransitionLink
                      href={kind.href}
                      className="wj-rail-item md:flex-1"
                      aria-current={on ? 'true' : undefined}
                      data-cursor="explore"
                      data-lit={highlighted === kind.category ? '1' : '0'}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== 'touch') setChosen(kind.category);
                      }}
                      // a keyboard's focus chooses the kind; a tap's focus must not, or the click that follows it would find its kind already chosen and open it
                      onFocus={(e) => {
                        if (e.currentTarget.matches(':focus-visible')) setChosen(kind.category);
                      }}
                      onClick={tap(kind)}
                    >
                      <span className="wj-rail-name">{kind.label}</span>
                      <span className="wj-rail-go micro text-ink/60" aria-hidden>
                        {COPY.window.explore}
                      </span>
                    </TransitionLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}
