'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { sectionElement, sectionsReady } from '@/state/sections';
import { runtime, scrollTo } from '@/state/runtime';
import { requestConcierge } from '@/concierge/bridge';
import { productsBySlugs, WORLD_BY_SLUG } from '@/data';
import { COPY } from '@/data/copy';
import type { Collection, Product } from '@/data/types';
import { cn } from '@/lib/cn';
import { capitalise } from '@/lib/format';
import { ScrollTrigger } from '@/lib/motion/gsap';

type MaterialFilter = 'all' | 'gold' | 'diamond' | 'polki';
type EditKey = 'gold' | 'diamond';

/**
 * One explicit view state, never two booleans: the story, the index (with the material it is
 * filtered by) and a curated edit are three different things, and each control names exactly one.
 */
type View = { kind: 'story' } | { kind: 'index'; material: MaterialFilter } | { kind: 'edit'; edit: EditKey };

const MATERIALS: MaterialFilter[] = ['all', 'gold', 'diamond', 'polki'];
const MATERIAL_LABEL: Record<MaterialFilter, string> = { all: 'All', gold: 'Gold', diamond: 'Diamond', polki: 'Polki' };

/** The URL is the only source of the view. `?edit` wins over `?material`; neither means the story. */
function viewFromParams(params: URLSearchParams): View {
  const e = params.get('edit');
  if (e === 'gold' || e === 'diamond') return { kind: 'edit', edit: e };
  const m = params.get('material');
  if (m === 'all' || m === 'gold' || m === 'diamond' || m === 'polki') return { kind: 'index', material: m };
  return { kind: 'story' };
}

/** The view's query string, keeping every other param (`?world=`) the arrival carried. */
function searchForView(view: View, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.delete('edit');
  next.delete('material');
  if (view.kind === 'edit') next.set('edit', view.edit);
  else if (view.kind === 'index') next.set('material', view.material);
  return next.toString();
}

function keyOf(view: View) {
  return view.kind === 'index' ? `index:${view.material}` : view.kind === 'edit' ? `edit:${view.edit}` : 'story';
}

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
  const world = params.get('world');
  const view = useMemo(() => viewFromParams(params), [params]);
  const viewKey = keyOf(view);
  const edit = view.kind === 'edit' ? view.edit : null;

  // Every control writes the URL and the view is read back from it, so a reload, a pasted link and
  // back/forward all land on the same state. A change of view kind is a move worth a history entry;
  // sweeping the materials inside the index replaces the entry rather than stacking four of them.
  const setView = useCallback(
    (next: View) => {
      if (keyOf(next) === viewKey) return;
      const qs = searchForView(next, params);
      const href = `/collections/${collection.slug}${qs ? `?${qs}` : ''}`;
      if (next.kind === 'index' && view.kind === 'index') runtime.router?.replace(href, { scroll: false });
      else runtime.router?.push(href, { scroll: false });
    },
    [collection.slug, params, view.kind, viewKey],
  );

  useEffect(() => {
    setSelectedCollection(collection.slug);
    setSelectedWorld(world && WORLD_BY_SLUG[world] ? world : null);
    return () => setSelectedWorld(null);
  }, [collection.slug, world, setSelectedCollection, setSelectedWorld]);

  // ?world= → glide to that world's first piece and pulse its edge light once per arrival
  const glidedWorld = useRef<string | null>(null);
  useEffect(() => {
    if (!world || view.kind !== 'story' || glidedWorld.current === world) return;
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
  }, [world, view.kind]);

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
  const material = view.kind === 'index' ? view.material : 'all';
  const indexProducts = view.kind === 'edit' ? productsBySlugs(collection.edits[view.edit]) : all.filter((p) => matchesMaterial(p, material));
  const worldStill = world && WORLD_BY_SLUG[world] ? WORLD_BY_SLUG[world]!.imagery.hero : collection.opening.still;
  const indexTitle =
    view.kind === 'edit'
      ? `${COPY.duality[view.edit].title} · ${indexProducts.length} pieces`
      : material === 'all'
        ? `The index · ${indexProducts.length} pieces`
        : `${capitalise(material)} · ${indexProducts.length} pieces`;

  // The swap changes the page height: re-measure every trigger below it, and if the visitor is
  // already past the control line, bring the new view up under it rather than leaving them below it.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const id = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      const el = sectionElement('pieces');
      if (el && el.getBoundingClientRect().top < 0) scrollTo(el, { offset: -64, duration: 0.9 });
    });
    return () => cancelAnimationFrame(id);
  }, [viewKey]);

  return (
    <main className="bg-bg text-fg">
      <CollectionOpening collection={collection} edit={edit} still={worldStill} />
      <Intro collection={collection} />
      <ModeLine view={view} setView={setView} />
      {view.kind === 'story' ? (
        collection.chapters.map((c, i) => <StoryChapterView key={c.id} chapter={c} index={i} />)
      ) : (
        <IndexView products={indexProducts} title={indexTitle} />
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

/**
 * The control line names one state at a time: Story, Index, or — while it is on — the curated edit,
 * which is marked but is not a button (it is entered from the menu, the duality chapter or the
 * concierge). Every material word stays live inside an edit, so a single press leaves it.
 */
function ModeLine({ view, setView }: { view: View; setView: (v: View) => void }) {
  const material = view.kind === 'index' ? view.material : null;
  return (
    <div className="sticky top-0 z-[5] border-b border-line bg-bg/95 text-fg" data-theme="ivory">
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 px-gutter py-4">
        <div className="flex items-center gap-8" role="group" aria-label="View">
          <Word active={view.kind === 'story'} onClick={() => setView({ kind: 'story' })} layoutId="mode-underline">
            Story
          </Word>
          <Word active={view.kind === 'index'} onClick={() => setView({ kind: 'index', material: view.kind === 'edit' ? view.edit : (material ?? 'all') })} layoutId="mode-underline">
            Index
          </Word>
          {view.kind === 'edit' && (
            <span className="eyebrow relative pb-1 text-fg">
              {COPY.duality[view.edit].title}
              <span aria-hidden className="hairline absolute inset-x-0 bottom-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-8" role="group" aria-label="Material">
          {MATERIALS.map((m) => (
            <Word key={m} active={material === m} onClick={() => setView({ kind: 'index', material: m })} layoutId="material-underline">
              {MATERIAL_LABEL[m]}
            </Word>
          ))}
        </div>
      </div>
    </div>
  );
}

function Word({ children, active, onClick, layoutId }: { children: React.ReactNode; active: boolean; onClick: () => void; layoutId: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn('eyebrow relative pb-1 transition-colors duration-300', active ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
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
