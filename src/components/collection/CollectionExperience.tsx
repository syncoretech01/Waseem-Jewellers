'use client';

import { MicGlyph } from '@/components/ui/MicGlyph';
import { useEffect, useMemo, useRef } from 'react';
import { CollectionOpening } from './CollectionOpening';
import { StoryChapterView } from './StoryBlocks';
import { WornTogetherRail } from '@/components/product/WornTogetherRail';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useSiteStore } from '@/state/siteStore';
import { productElement } from '@/state/visibility';
import { sectionsReady } from '@/state/sections';
import { runtime, scrollTo } from '@/state/runtime';
import { requestConcierge } from '@/concierge/bridge';
import { WORLD_BY_SLUG } from '@/data';
import type { PieceRow } from '@/lib/facets';
import { COPY } from '@/data/copy';
import type { Collection } from '@/data/types';

/**
 * A campaign, told as a story.
 *
 * Stage 1 gave this page a second view — an index of its own pieces, filtered by material —
 * because there was nowhere else to see the jewellery. There is now: the departments carry
 * the whole collection, with real facets and honest counts. So the story is the whole of
 * this page again, and the door to the index is a door, at the end, where a reader who has
 * finished the story will look for it.
 */
export function CollectionExperience({ collection, rows }: { collection: Collection; rows: PieceRow[] }) {
  // resolved on the server and handed down: the story needs pieces, the browser needs no catalogue
  const pieces = useMemo(() => new Map(rows.map((r) => [r.s, r])), [rows]);
  const search = useSiteStore((s) => s.search);
  const navEpoch = useSiteStore((s) => s.navEpoch);
  const setSelectedCollection = useSiteStore((s) => s.setSelectedCollection);
  const setSelectedWorld = useSiteStore((s) => s.setSelectedWorld);
  const openConsultation = useSiteStore((s) => s.openConsultation);

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const world = params.get('world');

  useEffect(() => {
    setSelectedCollection(collection.slug);
    setSelectedWorld(world && WORLD_BY_SLUG[world] ? world : null);
    return () => setSelectedWorld(null);
  }, [collection.slug, world, setSelectedCollection, setSelectedWorld]);

  // ?world= → glide to that world's first piece and pulse its edge light once per arrival
  const glidedWorld = useRef<string | null>(null);
  useEffect(() => {
    if (!world || glidedWorld.current === world) return;
    glidedWorld.current = world;
    let cancelled = false;
    (async () => {
      await Promise.race([sectionsReady(), new Promise((r) => setTimeout(r, 1500))]);
      await (runtime.transition?.whenReady().catch(() => undefined) ?? Promise.resolve());
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-world="${world}"]`);
      if (!el) return;
      scrollTo(el, { offset: -window.innerHeight * 0.12, duration: 1.6 });
      el.classList.add('is-spotlit');
      window.setTimeout(() => el.classList.remove('is-spotlit'), 2400);
    })();
    return () => {
      cancelled = true;
    };
  }, [world]);

  // the concierge arrives with a piece in mind: glide to it, light it, and hold it in focus
  useEffect(() => {
    const slug = useSiteStore.getState().pendingSpotlight;
    if (!slug) return;
    let cancelled = false;
    (async () => {
      await Promise.race([sectionsReady(), new Promise((r) => setTimeout(r, 1500))]);
      await (runtime.transition?.whenReady().catch(() => undefined) ?? Promise.resolve());
      if (cancelled) return;
      const site = useSiteStore.getState();
      site.setPendingSpotlight(null);
      const el = productElement(slug);
      if (!el) return;
      scrollTo(el, { offset: -(window.innerHeight - el.getBoundingClientRect().height) / 2, duration: 1.6 });
      const host = el.closest<HTMLElement>('article, li, [data-world]') ?? el;
      host.classList.add('is-spotlit');
      window.setTimeout(() => host.classList.remove('is-spotlit'), 2600);
      site.setFocusedProduct(slug);
    })();
    return () => {
      cancelled = true;
    };
  }, [navEpoch]);

  const worldStill = world && WORLD_BY_SLUG[world] ? WORLD_BY_SLUG[world]!.imagery.hero : collection.opening.still;

  return (
    <main className="bg-bg text-fg">
      <CollectionOpening collection={collection} still={worldStill} />
      <Intro collection={collection} />
      {collection.chapters.map((c, i) => (
        <StoryChapterView key={c.id} chapter={c} index={i} pieces={pieces} />
      ))}
      <Closing collection={collection} onConsult={() => openConsultation({ topic: 'bridal', source: 'cta' })} />
      <WornTogetherRail products={collection.wornTogether.map((s) => pieces.get(s)).filter((r): r is PieceRow => Boolean(r))} eyebrow="Worn together" title="Pieces that answer this one." theme="dark" />
    </main>
  );
}

function Intro({ collection }: { collection: Collection }) {
  const { ref } = useChapter({ id: 'collection-intro', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.06 });
  useRise(scope);
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg py-section text-fg">
      <div ref={scope} className="grid grid-cols-1 gap-12 px-gutter md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6">
          {collection.intro.map((p, i) => (
            <p key={i} data-split className="max-w-[34em] font-display text-lead opacity-0" style={{ fontVariationSettings: '"opsz" 20' }}>
              {p}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-10 md:pl-[6vw]">
          <ol className="flex flex-col gap-3" data-rise>
            {collection.chapters.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(`#chapter-${c.id}`, { offset: -24, duration: 1.4 })}
                  className="group/idx flex items-baseline gap-5 text-left"
                >
                  <span className="font-display text-[1.2rem] text-fg-2 opacity-70">{c.numeral}</span>
                  <span className="eyebrow relative pb-1 text-fg">
                    {c.title}
                    <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/idx:scale-x-100" />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            data-rise
            onClick={() => requestConcierge({ mode: 'voice', collection: collection.slug })}
            className="group/ask flex items-center gap-5 text-left"
          >
            <span aria-hidden className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong">
              <MicGlyph />
            </span>
            <span className="font-display italic text-[1.0625rem] text-fg-muted transition-colors group-hover/ask:text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
              Ask the concierge which of these suits a mehndi, a baraat or a walima.
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Closing({ collection, onConsult }: { collection: Collection; onConsult: () => void }) {
  const { ref } = useChapter({ id: 'details', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg py-section text-fg">
      <div ref={scope} className="flex flex-col items-start gap-8 px-gutter" data-rise>
        <Eyebrow>{COPY.consultation.eyebrow}</Eyebrow>
        <h2 className="display max-w-[12em] text-display-m">{COPY.footer.invitation}</h2>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <Button variant="bracket" onClick={onConsult}>
            Private consultation
          </Button>
          {/* the story ends; the index begins */}
          <a href={`/${collection.slug}`} className="group/index eyebrow relative pb-1 text-fg-muted transition-colors hover:text-fg" data-cursor="discover">
            See every {collection.name.toLowerCase()} piece
            <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/index:scale-x-100" />
          </a>
        </div>
      </div>
    </section>
  );
}
