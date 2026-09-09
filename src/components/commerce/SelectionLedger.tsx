'use client';

import { Dialog } from '@/components/ui/Dialog';
import { Img } from '@/components/media/Img';
import { Button } from '@/components/ui/Button';
import { useSiteStore } from '@/state/siteStore';
import { requestConcierge } from '@/concierge/bridge';
import { useOpenProduct } from '@/motion/hooks/useFlipNavigate';
import { productsBySlugs } from '@/data';
import { COPY } from '@/data/copy';
import { formatPrice, pad2 } from '@/lib/format';

/** "Your Selection" — an ivory ledger, not a cart drawer. */
export function SelectionLedger() {
  const open = useSiteStore((s) => s.ledgerOpen);
  const close = useSiteStore((s) => s.closeLedger);
  const wishlist = useSiteStore((s) => s.wishlist);
  const remove = useSiteStore((s) => s.removeFromWishlist);
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const openProduct = useOpenProduct();
  const pieces = productsBySlugs(wishlist);

  return (
    <Dialog open={open} onClose={close} label={COPY.ledger.title} variant="right" theme="ivory" zIndex={50} className="px-gutter py-10 md:px-12">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="micro text-fg-muted">Waseem Jewellers</p>
          <h2 className="display mt-3 text-display-m">{COPY.ledger.title}</h2>
        </div>
        <button type="button" onClick={close} className="micro text-fg-muted transition-colors hover:text-fg" data-cursor="close">
          Close
        </button>
      </div>

      {pieces.length === 0 ? (
        <div className="mt-16 flex flex-col gap-6">
          <p className="font-display text-lead italic" style={{ fontVariationSettings: '"opsz" 20' }}>
            {COPY.ledger.empty[0]}
          </p>
          <p className="text-fg-muted">{COPY.ledger.empty[1]}</p>
          <Button variant="hairline" href="/collections/bridal" onNavigate={close}>
            {COPY.ledger.discover}
          </Button>
        </div>
      ) : (
        <>
          <ol className="mt-12 flex flex-col divide-y divide-line">
            {pieces.map((p, i) => (
              <li key={p.slug} className="grid grid-cols-[2.5rem_5rem_1fr] items-start gap-4 py-6">
                <span className="font-display text-[1.2rem] text-fg-muted" style={{ fontVariationSettings: '"opsz" 14' }}>
                  {pad2(i + 1)}
                </span>
                <button type="button" onClick={() => { close(); openProduct(p.slug); }} className="relative block overflow-hidden" style={{ aspectRatio: '3 / 4' }} aria-label={`Open ${p.editorialTitle}`}>
                  <Img image={p.media.hero} sizes="80px" quality={70} />
                </button>
                <div className="flex flex-col gap-1">
                  {p.campaign && <p className="micro text-fg-muted">{p.campaign}</p>}
                  <button type="button" onClick={() => { close(); openProduct(p.slug); }} className="text-left font-display text-[1.125rem] leading-tight" style={{ fontVariationSettings: '"opsz" 18' }}>
                    {p.editorialTitle}
                  </button>
                  <p className="micro text-fg-2">{formatPrice(p.price)}</p>
                  <button type="button" onClick={() => remove(p.slug)} className="mt-2 w-fit text-[0.6875rem] uppercase tracking-[0.2em] text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
                    {COPY.ledger.remove}
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col items-start gap-6 border-t border-line pt-8">
            <Button variant="bracket" onClick={() => { close(); openConsultation({ topic: 'viewing', productSlugs: wishlist, source: 'ledger' }); }}>
              {COPY.ledger.viewing}
            </Button>
            <Button variant="hairline" onClick={() => { close(); requestConcierge({ mode: 'chat', submit: 'Tell me about the pieces in my selection' }); }}>
              {COPY.ledger.concierge}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
