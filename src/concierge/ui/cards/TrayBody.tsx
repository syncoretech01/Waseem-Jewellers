'use client';

import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Img } from '@/components/media/Img';
import { useConciergeStore, type TurnResult } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { useController } from '../../useConcierge';
import { topicIsLive } from '../../memory';
import { termsOf } from '../ContextRibbon';
import { PieceTile } from './PieceTile';
import { CompareTable } from './CompareTable';
import { CONCIERGE } from '../../copy';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

export type TrayResult = Extract<TurnResult, { kind: 'pieces' | 'wishlist' | 'collections' | 'compare' }>;

/** The last result worth a tray, if any. */
export function trayResultOf(turns: { result?: TurnResult }[]): TrayResult | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const r = turns[i]?.result;
    if (r && (r.kind === 'pieces' || r.kind === 'wishlist' || r.kind === 'collections' || r.kind === 'compare')) return r;
  }
  return null;
}

interface TrayBodyProps {
  result: TrayResult;
  onClose: () => void;
  /** Inside the sheet on a phone or tablet. */
  compact?: boolean;
  /** Extra padding on the right while the desktop rail is open (the tray stops where the rail begins). */
  className?: string;
}

/**
 * What the associate brought: the title of the request, the conditions it was brought for,
 * and the pieces themselves at a size worth looking at — with View, Save and Compare on each.
 * Choose two or three and the tray sets them side by side.
 */
export function TrayBody({ result, onClose, compact, className }: TrayBodyProps) {
  const controller = useController();
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const memory = useConciergeStore((s) => s.memory);
  const turnCount = useConciergeStore((s) => s.turnCount);
  const list = useRef<HTMLOListElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  // the tray is remounted per result, so one reading of the clock is enough for its lifetime
  const [now] = useState(() => Date.now());
  const terms = topicIsLive(memory, turnCount, now) ? termsOf(memory.standingSlots) : [];
  const title = result.kind === 'pieces' ? result.title : result.kind === 'wishlist' ? 'Your selection' : result.kind === 'compare' ? CONCIERGE.labels.compareDone : 'Five worlds';

  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length >= 3 ? [...p.slice(1), slug] : [...p, slug]));

  return (
    <div className={cn('flex flex-col', className)}>
      <div className={cn('flex items-baseline justify-between gap-6', compact ? 'px-6 pt-5' : 'px-gutter pt-6')}>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className={cn('font-display italic text-fg', compact ? 'text-[1.0625rem]' : 'text-[1.25rem]')} style={{ fontVariationSettings: '"opsz" 18' }}>
            {title}
          </p>
          {terms.length > 0 && result.kind !== 'compare' && (
            <p className="text-[0.8125rem] text-fg-muted">
              <span className="micro mr-2">{CONCIERGE.broughtFor}</span>
              {terms.map((t) => t.label).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-baseline gap-6">
          {picked.length >= 2 && (
            <button
              type="button"
              onClick={() => controller?.comparePieces(picked)}
              className="group/cmp relative pb-0.5 font-display italic text-[0.9375rem] text-fg transition-colors"
              style={{ fontVariationSettings: '"opsz" 14' }}
              data-cursor="compare"
            >
              {CONCIERGE.compareSelected(picked.length)}
              <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left" />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close the results" className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="close">
            Close
          </button>
        </div>
      </div>

      {result.kind === 'compare' ? (
        <div className={cn(compact ? 'px-6 pb-6 pt-5' : 'px-gutter pb-8 pt-6')}>
          <CompareTable pieces={result.pieces} rows={result.rows} compact={compact} onOpen={(p) => controller?.tapCard(p.slug, p.name)} onAsk={(p) => openConsultation({ topic: 'viewing', productSlug: p.slug, source: 'concierge' })} />
        </div>
      ) : (
        <ol
          ref={list}
          className={cn('no-scrollbar flex snap-x snap-mandatory overflow-x-auto', compact ? 'gap-5 px-6 pb-6 pt-5' : 'gap-8 px-gutter pb-8 pt-6')}
          style={{ scrollPaddingLeft: compact ? '1.5rem' : 'var(--spacing-gutter)' }}
          data-lenis-prevent-wheel
          role="list"
        >
          {(result.kind === 'pieces' || result.kind === 'wishlist') &&
            result.pieces.map((p, i) => (
              <motion.li key={p.slug} className="shrink-0 snap-start" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.55, ease: EASE.out, delay: 0.12 + i * 0.07 } }}>
                <PieceTile card={p} total={result.pieces.length} compact={compact} onOpen={() => controller?.tapCard(p.slug, p.name)} onCompare={() => toggle(p.slug)} comparing={picked.includes(p.slug)} />
              </motion.li>
            ))}
          {result.kind === 'collections' &&
            result.collections.map((c, i) => (
              <motion.li key={c.slug} className={cn('shrink-0 snap-start', compact ? 'w-[220px]' : 'w-[clamp(240px,20vw,340px)]')} initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.55, ease: EASE.out, delay: 0.12 + i * 0.07 } }}>
                <button
                  type="button"
                  data-ordinal={c.ordinal}
                  data-slug={c.slug}
                  data-name={c.name}
                  onClick={() => controller?.submitText(`Show me ${c.name}`, 'card')}
                  className="group/world block w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                  aria-label={`World ${c.ordinal} of ${result.collections.length}, ${c.name}`}
                  data-cursor="explore"
                >
                  <span className="salon-tile relative block w-full overflow-hidden" style={{ aspectRatio: '3 / 2', background: 'var(--salon-well)' }}>
                    <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/world:scale-[1.03]">
                      <Img image={c.image} alt="" sizes="(min-width: 1280px) 20vw, 240px" />
                    </span>
                  </span>
                  <span className="mt-4 block font-display text-[1.125rem] text-fg" style={{ fontVariationSettings: '"opsz" 18' }}>
                    {c.name}
                  </span>
                </button>
              </motion.li>
            ))}
        </ol>
      )}
    </div>
  );
}
