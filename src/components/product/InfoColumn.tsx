'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { SaveButton } from '@/components/commerce/SaveButton';
import { Eyebrow, UrduAccent } from '@/components/ui/primitives';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { formatPrice, formatGrams } from '@/lib/format';
import { requestConcierge } from '@/concierge/bridge';
import { useSiteStore } from '@/state/siteStore';
import { SITE } from '@/data';
import { COPY } from '@/data/copy';
import { WORLD_BY_SLUG } from '@/data/worlds';
import { useRise } from '@/motion/hooks/useReveals';
import { EASE } from '@/lib/motion/easings';
import type { Product } from '@/data/types';
import { cn } from '@/lib/cn';

const CATEGORY_LABEL: Record<Product['category'], string> = {
  'bridal-set': 'Bridal set',
  necklace: 'Necklace',
  earrings: 'Earrings',
  ring: 'Ring',
  bracelet: 'Bracelet',
  bangle: 'Bangle',
};

export function InfoColumn({ product }: { product: Product }) {
  const scope = useRef<HTMLDivElement>(null);
  const lastRoute = useSiteStore((s) => s.lastOpenedProduct);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const world = product.world ? WORLD_BY_SLUG[product.world] : undefined;
  useRise(scope, { start: 'top 95%' });

  const backHref = '/collections/bridal';
  const backLabel = lastRoute ? 'The Bridal House' : 'The House';
  const specs = product.metadata;
  const rows: [string, string][] = [];
  if (specs.karat) rows.push(['Purity', specs.karat]);
  if (specs.grossWeightGrams) rows.push(['Gross weight', formatGrams(specs.grossWeightGrams)]);
  if (specs.diamondColour) rows.push(['Diamond colour', specs.diamondColour]);
  if (specs.clarity) rows.push(['Clarity', specs.clarity]);
  if (specs.carat) rows.push(['Carats', `${specs.carat} ct`]);
  if (specs.itemCode) rows.push(['Reference', specs.itemCode]);
  if (rows.length < 3) {
    if (specs.stones?.length) rows.push(['Stones', specs.stones.join(', ')]);
    if (specs.technique?.length) rows.push(['Technique', specs.technique.join(', ')]);
  }
  // verified measurements, as opposed to descriptive attributes — decides whether the absence is named
  const measured = Boolean(specs.karat || specs.grossWeightGrams || specs.carat);

  return (
    <div ref={scope} className="flex flex-col gap-8">
      <div data-rise>
        <TransitionLink href={lastRoute ? backHref : '/'} className="micro inline-flex items-center gap-3 text-fg-muted transition-colors hover:text-fg">
          <span aria-hidden>←</span>
          {backLabel}
        </TransitionLink>
      </div>

      <div data-rise className="flex flex-col gap-3">
        <Eyebrow>
          {world ? world.name : 'The House'} · {CATEGORY_LABEL[product.category]}
          {world?.urdu && <UrduAccent text={world.urdu} className="ml-3 text-[0.95rem]" />}
        </Eyebrow>
        {product.house && <p className="micro text-fg-muted">{product.house}</p>}
        <h1 className="display text-display-m">{product.editorialTitle}</h1>
      </div>

      <div data-rise className="flex flex-col gap-2">
        <p className="eyebrow text-fg">{formatPrice(product.price)}</p>
        <p className="text-[0.75rem] text-fg-muted">
          {product.price.kind === 'fixed' ? 'Indicative, subject to the gold rate · Prices in Pakistani rupees · Private viewing available in Lahore' : COPY.product.priceNote}
        </p>
      </div>

      <div data-rise className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Button variant="bracket" onClick={() => requestConcierge({ mode: 'chat', product: product.slug, submit: 'Tell me about this piece' })}>
          Enquire
        </Button>
        <Button variant="hairline" onClick={() => openConsultation({ topic: 'viewing', productSlug: product.slug, source: 'cta' })}>
          Private viewing
        </Button>
        <SaveButton slug={product.slug} variant="full" />
      </div>

      <div data-rise className="flex flex-col gap-5">
        <p className="font-display text-lead italic leading-[1.35] text-fg" style={{ fontVariationSettings: '"opsz" 24' }}>
          {product.story.lede}
        </p>
        <p className="max-w-[34em] text-fg-muted">{product.story.craft}</p>
      </div>

      <div data-rise className="flex flex-col gap-5 border-t border-line pt-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
          {rows.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
        </dl>
        {!measured && <p className="text-[0.75rem] text-fg-muted">{COPY.product.specsNote}</p>}
      </div>

      <div data-rise>
        <Accordion
          items={[
            {
              title: 'Details',
              body: (
                <p>
                  {CATEGORY_LABEL[product.category]} · {product.material.replace('-', ' and ')}
                  {world ? ` · ${world.name} — ${world.mood}` : ''}
                </p>
              ),
            },
            {
              title: 'Materials',
              body: (
                <p>
                  {[specs.karat ? `${specs.karat} gold` : null, specs.stones?.join(', '), specs.technique?.join(', ')].filter(Boolean).join(' · ') || 'Details shared at a private viewing.'}
                </p>
              ),
            },
            { title: 'Care', body: <p>{product.story.care}</p> },
            {
              title: 'Private viewing',
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
                    Arrange a viewing
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <p data-rise className="micro text-fg-muted">
        Made only once.
      </p>
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
