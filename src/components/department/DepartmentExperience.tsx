'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { PieceGrid } from './PieceGrid';
import { RefineBar } from './RefineBar';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo } from '@/state/runtime';
import { sectionElement } from '@/state/sections';
import { requestConcierge } from '@/concierge/bridge';
import { CATEGORY_PLURAL } from '@/data/labels';
import type { DepartmentInfo } from '@/data/departments';
import type { Category } from '@/data/types';
import {
  PAGE,
  facetCounts,
  fromRow,
  matchesFacets,
  parseFacets,
  serialiseFacets,
  sortRows,
  stripRetired,
  type FacetKey,
  type FacetState,
  type Facetable,
  type PieceRow,
} from '@/lib/facets';
import { EASE } from '@/lib/motion/easings';
import { ScrollTrigger } from '@/lib/motion/gsap';
import { cn } from '@/lib/cn';

/**
 * A department, index-first.
 *
 * There is no cinematic opening here, and that is the point: a campaign is a story and earns
 * one, a department is a room full of jewellery and the jewellery should be the first thing
 * in it. The masthead is type, and two screens later a visitor has already met twenty-four
 * pieces.
 *
 * Filtering runs in the browser over this department's own rows — about a hundred bytes
 * each, so Gold costs some 30 kB and nothing else is sent — which keeps the page static, the
 * route transition intact, and a facet instant. The URL is the state, exactly as the
 * campaign pages do it, so a pasted link, the back button and a link the concierge emits all
 * land on the same view.
 */

interface DepartmentExperienceProps {
  info: DepartmentInfo;
  rows: PieceRow[];
  /** Categories with a page of their own — the same predicate the routes are built from. */
  categories: { category: Category; count: number }[];
  /** Set on a category page: the facet the page itself is. */
  fixedCategory?: Category;
}

type Indexed = Facetable & { row: PieceRow };

export function DepartmentExperience({ info, rows, categories, fixedCategory }: DepartmentExperienceProps) {
  const search = useSiteStore((s) => s.search);
  const openConsultation = useSiteStore((s) => s.openConsultation);

  const base = fixedCategory ? `/${info.slug}/${fixedCategory}` : `/${info.slug}`;
  const facets = useMemo(() => {
    const parsed = parseFacets(search);
    return fixedCategory ? { ...parsed, category: fixedCategory } : parsed;
  }, [search, fixedCategory]);

  const items: Indexed[] = useMemo(() => rows.map((row) => ({ ...fromRow(row), row })), [rows]);
  const matched = useMemo(() => items.filter((i) => matchesFacets(i, facets)), [items, facets]);
  const ordered = useMemo(() => sortRows(matched.map((i) => i.row), facets.sort), [matched, facets.sort]);
  const visible = useMemo(() => ordered.slice(0, facets.shown), [ordered, facets.shown]);
  const counts = useMemo(() => facetCounts(items, facets), [items, facets]);
  const caratAvailable = useMemo(() => matched.some((i) => i.row.ct !== undefined), [matched]);

  /**
   * Sweeping inside a facet replaces the history entry; changing the kind of thing being
   * looked at is a move worth going back from. Any change to what is shown returns the
   * ledger to its first page — revealing eighty pieces and then filtering to nine should
   * not leave a visitor looking at a ledger that says 80.
   */
  const setFacets = useCallback(
    (next: FacetState, key?: FacetKey) => {
      const shown = key === undefined ? next.shown : PAGE;
      const qs = serialiseFacets({ ...next, shown }, search);
      const href = qs ? `${base}?${qs}` : base;
      const push = key === 'category' || key === 'campaign';
      (push ? runtime.router?.push : runtime.router?.replace)?.call(runtime.router, href, { scroll: false });
    },
    [base, search],
  );

  const onRefine = useCallback(
    (next: FacetState) => {
      const changed = (Object.keys(next) as (keyof FacetState)[]).find((k) => next[k] !== facets[k]);
      setFacets(next, changed === 'sort' || changed === 'shown' ? undefined : (changed as FacetKey));
    },
    [facets, setFacets],
  );

  const revealHref = useMemo(() => {
    const qs = serialiseFacets({ ...facets, shown: Math.min(facets.shown + PAGE, ordered.length) }, search);
    return qs ? `${base}?${qs}` : base;
  }, [facets, ordered.length, search, base]);

  // arriving from a Stage 1 link: drop the retired parameter the redirect carried in
  useEffect(() => {
    const cleaned = stripRetired(search);
    if (cleaned === null) return;
    runtime.router?.replace(cleaned ? `${base}?${cleaned}` : base, { scroll: false });
  }, [search, base]);

  // the ledger and the facets both change the page height; every trigger below must re-measure
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [visible.length]);

  // a change of facet is a change of subject: bring the index back under the control line
  const lastFilter = useRef('');
  useEffect(() => {
    const key = `${facets.category}|${facets.material}|${facets.purity}|${facets.weight}|${facets.occasion}|${facets.campaign}|${facets.sort}`;
    if (!lastFilter.current) {
      lastFilter.current = key;
      return;
    }
    if (lastFilter.current === key) return;
    lastFilter.current = key;
    const el = sectionElement('pieces');
    if (el && el.getBoundingClientRect().top < 0) scrollTo(el, { offset: -72, duration: 0.9 });
  }, [facets]);

  const remaining = ordered.length - visible.length;

  return (
    <main className="bg-bg text-fg">
      {/* the masthead states the size of the room, not of the current filter */}
      <Masthead info={info} fixedCategory={fixedCategory} total={fixedCategory ? rows.filter((r) => r.c === fixedCategory).length : rows.length} />
      <Intro info={info} categories={categories} current={fixedCategory} />
      <RefineBar
        facets={facets}
        counts={counts}
        total={ordered.length}
        leading={fixedCategory ? `${info.name} · ${CATEGORY_PLURAL[fixedCategory]}` : info.name}
        locked={fixedCategory ? 'category' : undefined}
        caratAvailable={caratAvailable}
        onChange={onRefine}
      />
      <Index rows={visible} remaining={remaining} total={ordered.length} revealHref={revealHref} onReveal={() => setFacets({ ...facets, shown: facets.shown + PAGE })} />
      <Closing info={info} onConsult={() => openConsultation({ topic: 'viewing', source: 'cta' })} />
    </main>
  );
}

function Masthead({ info, fixedCategory, total }: { info: DepartmentInfo; fixedCategory?: Category; total: number }) {
  const { ref } = useChapter({ id: 'department', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.08 });
  useRise(scope);
  const name = fixedCategory ? CATEGORY_PLURAL[fixedCategory] : info.name;
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg pt-[calc(var(--spacing-section)*0.9)] pb-16 text-fg">
      <div ref={scope} className="flex flex-col gap-8 px-gutter">
        <Eyebrow data-rise>{fixedCategory ? `${info.name.toUpperCase()} · WASEEM JEWELLERS` : info.eyebrow}</Eyebrow>
        <h1 className="display max-w-[8em] text-display-l leading-[0.9]">{name}</h1>
        <p data-split className="max-w-[24em] font-display text-lead italic opacity-0" style={{ fontVariationSettings: '"opsz" 24' }}>
          {info.tagline}
        </p>
        <p className="micro text-fg-2" data-rise>
          {total} {total === 1 ? 'piece' : 'pieces'}
        </p>
      </div>
    </section>
  );
}

function Intro({ info, categories, current }: { info: DepartmentInfo; categories: { category: Category; count: number }[]; current?: Category }) {
  const { ref } = useChapter({ id: 'collection-intro', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.06 });
  useRise(scope);
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg pb-section text-fg">
      <div ref={scope} className="grid grid-cols-1 gap-12 px-gutter md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6">
          {info.intro.map((p, i) => (
            <p key={i} data-split className="max-w-[34em] font-display text-lead opacity-0" style={{ fontVariationSettings: '"opsz" 20' }}>
              {p}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-10 md:pl-[6vw]">
          {categories.length > 0 && (
            <nav aria-label="Kinds" className="flex flex-col gap-3" data-rise>
              <a href={`/${info.slug}`} className={cn('group/cat flex items-baseline justify-between gap-6', !current ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
                <span className="eyebrow relative pb-1">
                  Everything
                  <span aria-hidden className={cn('hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-700 ease-[var(--ease-out-expo)]', current ? 'scale-x-0 group-hover/cat:scale-x-100' : 'scale-x-100')} />
                </span>
              </a>
              {categories.map(({ category, count }) => (
                <a
                  key={category}
                  href={`/${info.slug}/${category}`}
                  className={cn('group/cat flex items-baseline justify-between gap-6 transition-colors', current === category ? 'text-fg' : 'text-fg-muted hover:text-fg')}
                >
                  <span className="eyebrow relative pb-1">
                    {CATEGORY_PLURAL[category]}
                    <span
                      aria-hidden
                      className={cn(
                        'hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-700 ease-[var(--ease-out-expo)]',
                        current === category ? 'scale-x-100' : 'scale-x-0 group-hover/cat:scale-x-100',
                      )}
                    />
                  </span>
                  <span className="micro tabular-nums text-fg-muted">{count}</span>
                </a>
              ))}
            </nav>
          )}
          <button
            type="button"
            data-rise
            onClick={() => requestConcierge({ mode: 'chat' })}
            className="group/ask flex items-start gap-5 text-left"
          >
            <span aria-hidden className="mt-1 inline-block h-px w-8 bg-line-strong transition-all duration-500 group-hover/ask:w-12" />
            <span className="max-w-[22em] font-display italic text-[1.0625rem] text-fg-muted transition-colors group-hover/ask:text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
              Tell the concierge a weight, a budget or an occasion, and it will narrow this for you.
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Index({
  rows,
  remaining,
  total,
  revealHref,
  onReveal,
}: {
  rows: PieceRow[];
  remaining: number;
  total: number;
  revealHref: string;
  onReveal: () => void;
}) {
  const { ref } = useChapter({ id: 'pieces', theme: 'ivory' });
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg py-section text-fg" aria-label="Pieces">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.44, ease: EASE.out }} className="px-gutter">
        {rows.length === 0 ? (
          <p className="max-w-[26em] font-display text-lead" style={{ fontVariationSettings: '"opsz" 20' }}>
            Nothing here answers all of that at once. Take one thing away, or ask the concierge — a piece like it may be in the showroom without being on this page.
          </p>
        ) : (
          <PieceGrid rows={rows} />
        )}

        {remaining > 0 && (
          <div className="mt-24 flex flex-col items-center gap-4">
            <p className="micro text-fg-muted">
              Showing {rows.length} of {total}
            </p>
            {/* a real link, so it can be opened in a new tab and followed without JavaScript */}
            <a
              href={revealHref}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onReveal();
              }}
              className="group/more eyebrow relative pb-1 text-fg"
            >
              Show {Math.min(remaining, 24)} more
              <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/more:scale-x-0" />
            </a>
          </div>
        )}
        {remaining === 0 && rows.length > 0 && (
          <p className="mt-24 text-center micro text-fg-muted">
            All {total} {total === 1 ? 'piece' : 'pieces'}
          </p>
        )}
      </motion.div>
    </section>
  );
}

function Closing({ info, onConsult }: { info: DepartmentInfo; onConsult: () => void }) {
  const { ref } = useChapter({ id: 'details', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <section ref={ref} data-theme="ivory" className="bg-bg py-section text-fg">
      <div ref={scope} className="flex flex-col items-start gap-8 px-gutter" data-rise>
        <Eyebrow>PRIVATE CONSULTATION</Eyebrow>
        <h2 className="display max-w-[12em] text-display-m">{info.closing}</h2>
        <Button variant="bracket" onClick={onConsult}>
          Private consultation
        </Button>
      </div>
    </section>
  );
}
