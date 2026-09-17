'use client';

import { useRef } from 'react';
import { Img } from '@/components/media/Img';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { pieceRefOf } from '@/data/clientIndex';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useProductVisibility } from '@/motion/hooks/useProductVisibility';
import { useSiteStore } from '@/state/siteStore';
import { COPY } from '@/data/copy';
import type { ShowcaseCategory } from '@/lib/facets';
import { tagOf } from './showcase';
import { cn } from '@/lib/cn';

/**
 * Nine places in a twelve-column composition, read in three rows: the first kind large, the
 * rest set off one another so the eye travels. Bridal sets stand as a portrait; every other
 * kind is a piece on pearl. The asymmetry is the point — this is a shop window, not a grid.
 */
const SLOTS = [
  { col: 'md:col-start-1 md:col-span-5', aspect: '4 / 5', offset: '', size: 'lg', sizes: '(min-width: 768px) 40vw, 92vw' },
  { col: 'md:col-start-7 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[9svh]', size: 'sm', sizes: '(min-width: 768px) 24vw, 46vw' },
  { col: 'md:col-start-10 md:col-span-3', aspect: '4 / 5', offset: 'md:mt-[2svh]', size: 'sm', sizes: '(min-width: 768px) 24vw, 46vw' },
  { col: 'md:col-start-2 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[6svh]', size: 'sm', sizes: '(min-width: 768px) 24vw, 46vw' },
  { col: 'md:col-start-5 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[5svh]', size: 'md', sizes: '(min-width: 768px) 32vw, 46vw' },
  { col: 'md:col-start-10 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[11svh]', size: 'sm', sizes: '(min-width: 768px) 24vw, 46vw' },
  { col: 'md:col-start-1 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[7svh]', size: 'md', sizes: '(min-width: 768px) 32vw, 46vw' },
  { col: 'md:col-start-6 md:col-span-3', aspect: '1 / 1', offset: 'md:mt-[1svh]', size: 'sm', sizes: '(min-width: 768px) 24vw, 46vw' },
  { col: 'md:col-start-9 md:col-span-4', aspect: '4 / 5', offset: 'md:mt-[3svh]', size: 'md', sizes: '(min-width: 768px) 32vw, 46vw' },
];

/** The order a jeweller lays a window: the heavy gold and the rings first, the stones and the small things after. */
const ORDER = ['ring', 'necklace', 'earrings', 'bangle', 'bridal-set', 'pendant', 'bracelet', 'chain', 'cufflink'];

function KindTile({ kind, slot, lit }: { kind: ShowcaseCategory; slot: (typeof SLOTS)[number]; lit: boolean }) {
  // the piece on the tile is a piece in view for the concierge, though the tile itself opens the kind
  const ref = useProductVisibility<HTMLLIElement>(kind.hero.s);
  const hero = pieceRefOf(kind.hero);
  const alt = kind.alt ? pieceRefOf(kind.alt) : null;
  return (
    <li ref={ref} className={cn('col-span-1', slot.col, slot.offset, slot.size === 'lg' && 'col-span-2')} data-rise data-kind={kind.category} data-lit={lit ? '1' : '0'}>
      <TransitionLink href={kind.href} className="group/kind relative block" data-cursor="explore" aria-label={`${kind.label} — explore`}>
        <div className="relative w-full overflow-hidden bg-bg-2" style={{ aspectRatio: slot.aspect }}>
          {/* the piece, drawn a little closer under the hand — and a second piece of the kind surfacing beneath it */}
          <div className="absolute inset-0 transition-transform duration-1000 ease-[var(--ease-out-expo)] group-hover/kind:scale-[1.035] group-focus-visible/kind:scale-[1.035]">
            <div className="absolute inset-0">
              {kind.image ? <Img id={kind.image} sizes={slot.sizes} plain className="h-full w-full object-cover" /> : <Img image={hero.media.hero} sizes={slot.sizes} plain />}
            </div>
            {/* a packshot carries its own pearl plate, so the second piece fades in as a whole layer over the first */}
            {alt && (
              <div className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/kind:opacity-100 group-focus-visible/kind:opacity-100" aria-hidden>
                <Img image={alt.media.hero} sizes={slot.sizes} plain alt="" />
              </div>
            )}
          </div>
          <span aria-hidden className="hairline absolute inset-x-0 top-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/kind:scale-x-100 group-focus-visible/kind:scale-x-100" />
          {/* a kind the concierge was asked about is lit for a moment */}
          <span aria-hidden className={cn('pointer-events-none absolute inset-0 border border-gold-hi transition-opacity duration-700', lit ? 'opacity-100' : 'opacity-0')} />
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className={cn('display leading-none text-ink transition-colors group-hover/kind:text-gold-deep', slot.size === 'lg' ? 'text-[clamp(2rem,3.4vw,3.5rem)]' : 'text-[clamp(1.5rem,2.2vw,2.25rem)]')}>{kind.label}</span>
          <span className={cn('micro shrink-0 text-ink/45 transition-colors group-hover/kind:text-ink', slot.size !== 'lg' && 'max-md:hidden')}>{COPY.window.explore}</span>
        </div>
      </TransitionLink>
      {/* the piece on the tile, named, and a door of its own */}
      <p className="micro mt-2 flex flex-wrap items-baseline gap-x-3 text-ink/55">
        <TransitionLink href={`/jewellery/${kind.hero.s}`} className="transition-colors hover:text-ink" data-cursor="view">
          {kind.hero.t}
        </TransitionLink>
        {tagOf(kind.hero) && <span>{tagOf(kind.hero)}</span>}
      </p>
    </li>
  );
}

/**
 * CH02 — the collection, by kind.
 *
 * The first thing after the film is what a jeweller keeps in the glass, arranged the way a
 * visitor thinks: rings, necklaces, earrings, bangles. Every tile is one kind, shown on one of
 * its pieces photographed as a piece, and is the door into that kind; the piece itself is
 * named beneath and has a door of its own. A second piece of the kind surfaces under the hand.
 * No counts: a window says what is made, not how many are in the back.
 */
export function Ch02Kinds({ kinds }: { kinds: ShowcaseCategory[] }) {
  const { ref } = useChapter({ id: 'vitrine', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  const highlighted = useSiteStore((s) => (s as unknown as { highlightedCategory?: string | null }).highlightedCategory ?? null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  const byKind = new Map(kinds.map((k) => [k.category, k]));
  const tiles = ORDER.map((c) => byKind.get(c)).filter((k): k is ShowcaseCategory => Boolean(k)).slice(0, SLOTS.length);
  if (tiles.length === 0) return null;

  return (
    <section ref={ref} id="ch02-kinds" data-theme="ivory" className="relative bg-ivory px-gutter pb-[9svh] pt-[10svh] text-ink md:pb-[11svh] md:pt-[12svh]" aria-labelledby="kinds-title">
      <div ref={scope}>
        <div className="grid grid-cols-1 gap-x-[4vw] gap-y-6 md:grid-cols-12 md:items-end">
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

        <ul className="mt-[7svh] grid grid-cols-2 gap-x-[4vw] gap-y-10 md:mt-[8svh] md:grid-cols-12 md:gap-x-[2.2vw] md:gap-y-[4svh]" aria-label={COPY.window.kinds} data-kinds>
          {tiles.map((kind, i) => (
            <KindTile key={kind.category} kind={kind} slot={SLOTS[i]!} lit={highlighted === kind.category} />
          ))}
        </ul>
      </div>
    </section>
  );
}
