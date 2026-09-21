'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Eyebrow, UrduAccent } from '@/components/ui/primitives';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { formatAsOf, formatPrice } from '@/lib/format';
import { specRows, isMeasured } from '@/lib/specs';
import { notesFor } from '@/data/editorial/materials';
import { requestConcierge } from '@/concierge/bridge';
import { useSiteStore } from '@/state/siteStore';
import { SITE } from '@/data';
import { COPY } from '@/data/copy';
import { WORLD_BY_SLUG } from '@/data/worlds';
import { showroomsInOrder } from '@/data/heritage';
import { useRise } from '@/motion/hooks/useReveals';
import { EASE } from '@/lib/motion/easings';
import type { Product } from '@/data/types';
import { categoryLabel, departmentLabel, DEPARTMENT_LABEL, MATERIAL_LABEL, describe } from '@/data';
import { cn } from '@/lib/cn';

/** "As at 9 Sep 2026" where the date parses, and simply "Indicative" where it does not. */
const asOfLabel = (iso: string) => {
  const when = formatAsOf(iso);
  return when ? `Indicative, as at ${when}` : 'Indicative';
};

/**
 * The line beneath a price. Where the piece is on request, the price line already says so,
 * so the note keeps only what it adds — the viewing — rather than saying "on request" twice.
 */
const priceNoteOf = (product: Product) =>
  product.price.kind === 'fixed'
    ? [asOfLabel(product.price.asOf), 'subject to the gold rate', 'Prices in Pakistani rupees', 'Viewings in Lahore by appointment'].join(' · ')
    : COPY.product.priceNote;

/** "Rs. 380,000", or "Price on request" in the house's sentence case rather than as a shouted label. */
const priceLineOf = (product: Product) => (product.price.kind === 'fixed' ? formatPrice(product.price) : 'Price on request');

export function InfoColumn({ product }: { product: Product }) {
  const scope = useRef<HTMLDivElement>(null);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const world = product.world ? WORLD_BY_SLUG[product.world] : undefined;
  /**
   * The rise is for the wide screen, where the column stands beside the photographs and
   * enters with them. On a phone the words follow the photograph in the flow of the page,
   * and the name, the price and the two buttons must be there at rest — an entrance that
   * leaves the first screen of information at opacity 0 is a blank, not a reveal. The scope
   * is withheld below the breakpoint, so the hook sets nothing to hide.
   */
  useRise(scope, { start: 'top 95%' });

  /**
   * Back to the piece's own department, not to the one collection Stage 1 happened to have.
   * A men's bracelet whose back link said Bridal was wrong in a way a visitor would notice
   * before we did.
   */
  const department = product.departments[0];
  const backHref = department ? `/${department}` : '/';
  const backLabel = department ? DEPARTMENT_LABEL[department] : 'Waseem Jewellers';
  // one specification table, shared with the comparison surface and the concierge
  const rows = specRows(product);
  const measured = isMeasured(product);
  const notes = notesFor(product);

  return (
    <div
      ref={(el) => {
        scope.current = el && window.matchMedia('(min-width: 768px)').matches ? el : null;
      }}
      className="flex flex-col gap-7 md:gap-8"
      data-info
    >
      {/* the way back, in the column on a wide screen; a phone carries it above the photograph */}
      <div data-rise className="hidden md:block">
        <TransitionLink href={backHref} className="micro inline-flex items-center gap-3 text-fg-muted transition-colors hover:text-fg">
          <span aria-hidden>←</span>
          {backLabel}
        </TransitionLink>
      </div>

      <div data-rise className="flex flex-col gap-3">
        <Eyebrow>
          {world ? world.name : departmentLabel(product.departments[0])} · {categoryLabel(product.category)}
          {world?.urdu && <UrduAccent text={world.urdu} className="ml-3 text-[0.95rem]" />}
        </Eyebrow>
        {/* the campaign, unless the eyebrow has just said it as the world's name */}
        {product.campaign && product.campaign.toLowerCase() !== world?.name.toLowerCase() && <p className="micro text-fg-muted">{product.campaign}</p>}
        <h1 className="display text-balance text-display-m">{product.editorialTitle ?? product.title}</h1>
      </div>

      <div data-rise className="flex flex-col gap-2">
        <p className="font-display text-[1.25rem] leading-none text-fg" style={{ fontVariationSettings: '"opsz" 20' }}>
          {priceLineOf(product)}
        </p>
        <p className="text-pretty text-[0.75rem] leading-relaxed text-fg-muted">{priceNoteOf(product)}</p>
      </div>

      {/* the two doors, one above the other on a phone and clear of the orb's corner; side by side in the column */}
      <div data-rise className="flex flex-col items-start gap-y-2 md:flex-row md:flex-wrap md:items-center md:gap-x-8 md:gap-y-3" style={{ paddingRight: 'max(0px, var(--orb-clear))' }}>
        <Button variant="bracket" onClick={() => requestConcierge({ mode: 'chat', product: product.slug, submit: 'Tell me about this piece' })}>
          Enquire
        </Button>
        <Button variant="hairline" onClick={() => openConsultation({ topic: 'viewing', productSlug: product.slug, source: 'cta' })}>
          Book a viewing
        </Button>
      </div>

      <div data-rise className="flex flex-col gap-5">
        <p className="text-pretty font-display text-lead italic leading-[1.35] text-fg" style={{ fontVariationSettings: '"opsz" 24' }}>
          {product.story?.lede ?? describe(product)}
        </p>
        {product.story?.craft && <p className="max-w-[34em] text-pretty text-fg-muted">{product.story.craft}</p>}
      </div>

      <div data-rise className="flex flex-col gap-5 border-t border-line pt-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
          {rows.map((r) => (
            <Row key={r.key} k={r.label} v={r.value} />
          ))}
        </dl>
        {!measured && <p className="text-[0.75rem] text-fg-muted">{COPY.product.specsNote}</p>}
      </div>

      {/**
       * With no story on 589 of 599 pieces, the alternative to this is a blank space or an
       * invented paragraph. These notes are general facts about the material, headed as
       * such, and every one of them appears only because this piece publishes the
       * specification it explains. None of them says anything about the piece itself.
       */}
      {notes.length > 0 && (
        <div data-rise className="flex flex-col gap-5 border-t border-line pt-6">
          <p className="micro text-fg-muted">About these materials</p>
          <dl className="flex flex-col gap-4">
            {notes.map((n) => (
              <div key={n.id} className="flex flex-col gap-1">
                <dt className="font-display text-[1.0625rem] text-fg" style={{ fontVariationSettings: '"opsz" 16' }}>
                  {n.term}
                </dt>
                <dd className="max-w-[34em] text-pretty text-[0.8125rem] leading-relaxed text-fg-muted">{n.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div data-rise>
        <Accordion
          items={[
            {
              title: 'Details',
              body: (
                <p>
                  {categoryLabel(product.category)}
                  {product.material ? ` · ${MATERIAL_LABEL[product.material]}` : ''}
                  {world ? ` · ${world.name} — ${world.mood}` : ''}
                </p>
              ),
            },
            // no "Materials" panel: the table above already lists the purity, the stones and
            // the technique, and repeating them behind a disclosure is furniture
            ...(product.story?.care ? [{ title: 'Care', body: <p>{product.story.care}</p> }] : []),
            {
              title: 'Visit a showroom',
              body: (
                <div className="flex flex-col gap-3">
                  {/* the three showrooms in the order the client set: Liberty Market, MM Alam Road, DHA */}
                  <ul className="flex flex-col gap-1">
                    {showroomsInOrder().map((s) => (
                      <li key={s.id}>{s.address}</li>
                    ))}
                  </ul>
                  <p>
                    {SITE.hours} · {SITE.phone}
                  </p>
                  <button type="button" className="eyebrow self-start text-fg underline-offset-4 hover:underline" onClick={() => openConsultation({ topic: 'viewing', productSlug: product.slug, source: 'cta' })}>
                    Book a viewing
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="micro pt-1 text-fg-muted">{k}</dt>
      <dd className="font-display text-[1.0625rem] text-fg" style={{ fontVariationSettings: '"opsz" 14' }}>
        {v}
      </dd>
    </>
  );
}

function Accordion({ items }: { items: { title: string; body: React.ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="border-t border-line">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.title} className="border-b border-line">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`acc-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between py-4 text-left"
              style={{ paddingRight: 'max(0px, var(--orb-clear))' }}
            >
              <span className="eyebrow text-fg">{it.title}</span>
              <span aria-hidden className={cn('font-display text-[1.25rem] leading-none text-fg-2 transition-transform duration-500', isOpen && 'rotate-45')}>
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`acc-${i}`}
                  role="region"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1, transition: { duration: 0.55, ease: EASE.out } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.35, ease: EASE.silk } }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 text-small text-fg-muted">{it.body}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
