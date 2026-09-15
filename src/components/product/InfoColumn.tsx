'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { SaveButton } from '@/components/commerce/SaveButton';
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

export function InfoColumn({ product }: { product: Product }) {
  const scope = useRef<HTMLDivElement>(null);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const world = product.world ? WORLD_BY_SLUG[product.world] : undefined;
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
    <div ref={scope} className="flex flex-col gap-8">
      <div data-rise>
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
        {product.campaign && <p className="micro text-fg-muted">{product.campaign}</p>}
        <h1 className="display text-display-m">{product.editorialTitle ?? product.title}</h1>
      </div>

      <div data-rise className="flex flex-col gap-2">
        <p className="eyebrow text-fg">{formatPrice(product.price)}</p>
        <p className="text-[0.75rem] text-fg-muted">
          {product.price.kind === 'fixed'
            ? [asOfLabel(product.price.asOf), 'subject to the gold rate', 'Prices in Pakistani rupees', 'Viewings in Lahore by appointment'].filter(Boolean).join(' · ')
            : COPY.product.priceNote}
        </p>
      </div>

      <div data-rise className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Button variant="bracket" onClick={() => requestConcierge({ mode: 'chat', product: product.slug, submit: 'Tell me about this piece' })}>
          Enquire
        </Button>
        <Button variant="hairline" onClick={() => openConsultation({ topic: 'viewing', productSlug: product.slug, source: 'cta' })}>
          Book a viewing
        </Button>
        <SaveButton slug={product.slug} variant="full" />
      </div>

      <div data-rise className="flex flex-col gap-5">
        <p className="font-display text-lead italic leading-[1.35] text-fg" style={{ fontVariationSettings: '"opsz" 24' }}>
          {product.story?.lede ?? describe(product)}
        </p>
        {product.story?.craft && <p className="max-w-[34em] text-fg-muted">{product.story.craft}</p>}
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
                <dd className="max-w-[34em] text-[0.8125rem] leading-relaxed text-fg-muted">{n.body}</dd>
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
                  <ul className="flex flex-col gap-1">
                    {SITE.showrooms.map((s) => (
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
