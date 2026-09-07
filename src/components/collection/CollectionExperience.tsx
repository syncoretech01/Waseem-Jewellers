'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CollectionOpening } from './CollectionOpening';
import { StoryChapterView } from './StoryBlocks';
import { IndexView } from './IndexView';
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
import { productsBySlugs, WORLD_BY_SLUG } from '@/data';
import { COPY } from '@/data/copy';
import type { Collection, Product } from '@/data/types';
import { cn } from '@/lib/cn';

type Mode = 'story' | 'index';
type MaterialFilter = 'all' | 'gold' | 'diamond' | 'polki';

function matchesMaterial(p: Product, m: MaterialFilter) {
  if (m === 'all') return true;
  if (m === 'gold') return p.material === 'gold' || p.material === 'gold-diamond' || p.material === 'polki';
  if (m === 'diamond') return p.material === 'diamond' || p.material === 'gold-diamond';
  return p.material === 'polki' || p.tags.includes('polki') || p.tags.includes('kundan');
}

export function CollectionExperience({ collection }: { collection: Collection }) {
  const search = useSiteStore((s) => s.search);
  const navEpoch = useSiteStore((s) => s.navEpoch);
  const setSelectedCollection = useSiteStore((s) => s.setSelectedCollection);
  const setSelectedWorld = useSiteStore((s) => s.setSelectedWorld);
  const openConsultation = useSiteStore((s) => s.openConsultation);

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const edit = (params.get('edit') === 'gold' || params.get('edit') === 'diamond' ? params.get('edit') : null) as 'gold' | 'diamond' | null;
  const world = params.get('world');
  const initialMaterial = (['gold', 'diamond', 'polki'].includes(params.get('material') ?? '') ? params.get('material') : 'all') as MaterialFilter;

  // Mode/material derive from the URL; the visitor's in-page choices override until the next navigation.
  const derivedMode: Mode = edit || initialMaterial !== 'all' ? 'index' : 'story';
  const [override, setOverride] = useState<{ epoch: number; mode: Mode | null; material: MaterialFilter | null }>({ epoch: navEpoch, mode: null, material: null });
  if (override.epoch !== navEpoch) setOverride({ epoch: navEpoch, mode: null, material: null });
  const mode = override.mode ?? derivedMode;
  const material = override.material ?? initialMaterial;
  const setMode = useCallback((m: Mode) => setOverride((o) => ({ ...o, mode: m })), []);
  const setMaterial = useCallback((m: MaterialFilter) => setOverride((o) => ({ ...o, material: m })), []);

  useEffect(() => {
    setSelectedCollection(collection.slug);
    setSelectedWorld(world && WORLD_BY_SLUG[world] ? world : null);
    return () => setSelectedWorld(null);
  }, [collection.slug, world, setSelectedCollection, setSelectedWorld]);

  // ?world= → glide to that world's first piece and pulse its edge light once
  useEffect(() => {
    if (!world || mode !== 'story') return;
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
  }, [world, mode, navEpoch]);

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

  const all = productsBySlugs(collection.pieces);
  const indexProducts = edit ? productsBySlugs(collection.edits[edit]) : all.filter((p) => matchesMaterial(p, material));
  const worldStill = world && WORLD_BY_SLUG[world] ? WORLD_BY_SLUG[world]!.imagery.hero : collection.opening.still;
  const editTitle = edit ? `The ${edit} edit · ${indexProducts.length} pieces` : undefined;

  const clearEdit = useCallback(() => {
    runtime.router?.replace(`/collections/${collection.slug}`, { scroll: false });
    setMode('story');
  }, [collection.slug, setMode]);

  return (
    <main className="bg-bg text-fg">
      <CollectionOpening collection={collection} edit={edit} still={worldStill} />
      <Intro collection={collection} />
      <ModeLine mode={mode} setMode={setMode} material={material} setMaterial={setMaterial} edit={edit} clearEdit={clearEdit} />
      {mode === 'story' ? (
        collection.chapters.map((c, i) => <StoryChapterView key={c.id} chapter={c} index={i} />)
      ) : (
        <IndexView products={indexProducts} title={editTitle} />
      )}
      <Closing onConsult={() => openConsultation({ topic: 'bridal', source: 'cta' })} />
      <WornTogetherRail products={productsBySlugs(collection.wornTogether)} eyebrow="Worn together" title="The House suggests." theme="dark" />
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

export function MicGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </svg>
  );
}

function ModeLine({ mode, setMode, material, setMaterial, edit, clearEdit }: { mode: Mode; setMode: (m: Mode) => void; material: MaterialFilter; setMaterial: (m: MaterialFilter) => void; edit: 'gold' | 'diamond' | null; clearEdit: () => void }) {
  const modes: { id: Mode; label: string }[] = [
    { id: 'story', label: 'Story' },
    { id: 'index', label: 'Index' },
  ];
  const materials: { id: MaterialFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'gold', label: 'Gold' },
    { id: 'diamond', label: 'Diamond' },
    { id: 'polki', label: 'Polki' },
  ];
  return (
    <div className="sticky top-0 z-[5] border-b border-line bg-bg/95 text-fg" data-theme="ivory">
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 px-gutter py-4">
        <div className="flex items-center gap-8" role="tablist" aria-label="View">
          {modes.map((m) => (
            <Word key={m.id} active={mode === m.id && !edit} onClick={() => (edit ? clearEdit() : setMode(m.id))} layoutId="mode-underline">
              {m.label}
            </Word>
          ))}
        </div>
        <div className="flex items-center gap-8" role="group" aria-label="Material">
          {edit ? (
            <>
              <span className="eyebrow text-fg">The {edit} edit</span>
              <Word active={false} onClick={clearEdit} layoutId="material-underline">
                All
              </Word>
            </>
          ) : (
            materials.map((m) => (
              <Word
                key={m.id}
                active={mode === 'index' && material === m.id}
                onClick={() => {
                  setMaterial(m.id);
                  setMode('index');
                }}
                layoutId="material-underline"
              >
                {m.label}
              </Word>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Word({ children, active, onClick, layoutId }: { children: React.ReactNode; active: boolean; onClick: () => void; layoutId: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn('eyebrow relative pb-1 transition-colors duration-300', active ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
      {children}
      {active && <motion.span layoutId={layoutId} aria-hidden className="hairline absolute inset-x-0 bottom-0" transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />}
    </button>
  );
}

function Closing({ onConsult }: { onConsult: () => void }) {
  const { ref } = useChapter({ id: 'details', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg py-section text-fg">
      <div ref={scope} className="flex flex-col items-start gap-8 px-gutter" data-rise>
        <Eyebrow>{COPY.consultation.eyebrow}</Eyebrow>
        <h2 className="display max-w-[12em] text-display-m">The House receives by appointment.</h2>
        <Button variant="bracket" onClick={onConsult}>
          Private consultation
        </Button>
      </div>
    </section>
  );
}
