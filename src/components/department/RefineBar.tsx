'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FACET_KEYS,
  FACET_LABEL,
  SORT_LABEL,
  WEIGHT_BAND_ORDER,
  activeCount,
  facetPhrases,
  facetValueLabel,
  type FacetKey,
  type FacetState,
  type SortKey,
} from '@/lib/facets';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion/easings';

/**
 * The one control the index needs.
 *
 * The applied facets are a line of prose in the display face — "Gold · rings · 21K · 42
 * pieces" — and that same line is the removable control, so there is no chip row, no
 * permanent sidebar and nothing that looks like a shop. The drawer opens from a single
 * hairline word and closes again; most visitors will never need it.
 *
 * Every value carries its count, counted against the other facets, so nothing offered here
 * can lead to an empty page. In a house where the price is on request, how many is the only
 * quantity a visitor is given, and it is given honestly.
 */

interface RefineBarProps {
  facets: FacetState;
  counts: Record<FacetKey, Record<string, number>>;
  total: number;
  /** The department or page's own name — the first word of the line. */
  leading: string;
  /** A facet the page itself is: shown in the line, but not removable from it. */
  locked?: FacetKey;
  /** Carat sorting is offered only when the pieces in view publish a carat weight. */
  caratAvailable: boolean;
  onChange: (next: FacetState) => void;
}

const ORDERED = (key: FacetKey, values: Record<string, number>) =>
  key === 'weight'
    ? WEIGHT_BAND_ORDER.filter((b) => values[b]).map((b) => [b, values[b]] as const)
    : Object.entries(values).sort((a, b) => b[1] - a[1]);

export function RefineBar({ facets, counts, total, leading, locked, caratAvailable, onChange }: RefineBarProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const active = activeCount(facets) - (locked && facets[locked] ? 1 : 0);
  const phrases = facetPhrases(facets);
  const sorts: SortKey[] = caratAvailable ? ['featured', 'weight-asc', 'weight-desc', 'carat-desc'] : ['featured', 'weight-asc', 'weight-desc'];

  const set = (key: FacetKey, value: string | undefined) => onChange({ ...facets, [key]: facets[key] === value ? undefined : value });

  return (
    <div className="sticky top-0 z-[5] border-b border-line bg-bg/95 text-fg backdrop-blur-[2px]" data-theme="ivory">
      <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 px-gutter py-4">
        <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-[1.0625rem] leading-tight" style={{ fontVariationSettings: '"opsz" 18' }}>
          <span>{leading}</span>
          {/* the locked facet is already in `leading`; repeating it reads as a stutter */}
          {phrases
            .filter((phrase) => phrase.key !== locked)
            .map((phrase) => (
              <span key={phrase.key} className="flex items-baseline gap-2">
                <span className="text-fg-muted">·</span>
                <button
                  type="button"
                  onClick={() => set(phrase.key, undefined)}
                  aria-label={`Remove ${phrase.label}`}
                  className="group/rm relative text-fg transition-colors hover:text-fg-muted"
                >
                  {phrase.label}
                  <span aria-hidden className="hairline absolute inset-x-0 -bottom-px origin-left scale-x-0 transition-transform duration-500 group-hover/rm:scale-x-100" />
                </button>
              </span>
            ))}
          <span className="flex items-baseline gap-2 text-fg-muted">
            <span>·</span>
            <span>
              {total} {total === 1 ? 'piece' : 'pieces'}
            </span>
          </span>
        </h2>

        <div className="flex items-center gap-8">
          <p className="sr-only" role="status">
            {total} {total === 1 ? 'piece' : 'pieces'}
          </p>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={cn('eyebrow relative pb-1 transition-colors', open || active ? 'text-fg' : 'text-fg-muted hover:text-fg')}
          >
            Refine{active > 0 ? ` · ${active}` : ''}
            <span aria-hidden className={cn('hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-500', open || active ? 'scale-x-100' : 'scale-x-0')} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.42, ease: EASE.out }}
            className="overflow-hidden border-t border-line"
          >
            <div className="flex flex-col gap-8 px-gutter py-8">
              {FACET_KEYS.map((key) => {
                if (key === locked) return null;
                const values = ORDERED(key, counts[key] ?? {});
                // a facet with one value tells a visitor nothing they cannot already see
                if (values.length < 2) return null;
                return (
                  <div key={key} role="group" aria-label={FACET_LABEL[key]} className="flex flex-col gap-3">
                    <p className="micro text-fg-muted">{FACET_LABEL[key]}</p>
                    <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
                      {values.map(([value, n]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={facets[key] === value}
                          onClick={() => set(key, value)}
                          className={cn(
                            'group/f relative pb-1 font-display text-[1.0625rem] transition-colors',
                            facets[key] === value ? 'text-fg' : 'text-fg-muted hover:text-fg',
                          )}
                          style={{ fontVariationSettings: '"opsz" 18' }}
                        >
                          {facetValueLabel(key, value)}
                          <span className="micro ml-2 align-baseline text-fg-muted">{n}</span>
                          <span
                            aria-hidden
                            className={cn(
                              'hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-500',
                              facets[key] === value ? 'scale-x-100' : 'scale-x-0 group-hover/f:scale-x-100',
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div role="group" aria-label="Order" className="flex flex-col gap-3">
                <p className="micro text-fg-muted">Order</p>
                <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
                  {sorts.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={facets.sort === s}
                      onClick={() => onChange({ ...facets, sort: s })}
                      className={cn('group/s relative pb-1 font-display text-[1.0625rem] transition-colors', facets.sort === s ? 'text-fg' : 'text-fg-muted hover:text-fg')}
                      style={{ fontVariationSettings: '"opsz" 18' }}
                    >
                      {SORT_LABEL[s]}
                      <span
                        aria-hidden
                        className={cn('hairline absolute inset-x-0 bottom-0 origin-left transition-transform duration-500', facets.sort === s ? 'scale-x-100' : 'scale-x-0 group-hover/s:scale-x-100')}
                      />
                    </button>
                  ))}
                </div>
                {/* said once, in the drawer, rather than under every photograph — and in
                    sentence case, because the micro face upper-cases and a shouted paragraph
                    is not a quiet aside */}
                <p className="mt-2 max-w-[36em] text-[0.8125rem] leading-relaxed text-fg-muted">
                  Sixteen pieces in the whole collection carry a published price, so there is no ordering by price. Weight is what Waseem publishes, and what a
                  buyer here asks for first.
                </p>
              </div>

              {active > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...facets, ...Object.fromEntries(FACET_KEYS.filter((k) => k !== locked).map((k) => [k, undefined])) })}
                  className="eyebrow self-start text-fg-muted transition-colors hover:text-fg"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
