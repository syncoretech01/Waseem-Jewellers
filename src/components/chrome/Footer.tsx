'use client';

import { useRef, useState, type ReactNode } from 'react';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { Button } from '@/components/ui/Button';
import { WaseemLockup } from '@/components/brand/WaseemLockup';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo } from '@/state/runtime';
import { sectionElement } from '@/state/sections';
import { MENU, SITE } from '@/data';
import { COPY } from '@/data/copy';
import { showroomsInOrder } from '@/data/heritage';
import type { MenuItem } from '@/data/types';
import type { SectionId } from '@/state/siteStore';
import { cn } from '@/lib/cn';

const link = 'w-fit underline-offset-4 transition-colors duration-300 hover:text-ivory hover:underline';

function Column({ title, children, className = 'gap-2.5' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <p className="micro mb-1.5 text-champagne">{title}</p>
      {children}
    </div>
  );
}

/**
 * On a wide screen the footer waits fixed beneath #page-root (which carries margin-bottom:
 * 100svh), so the last chapter lifts away to reveal it — from the foot upward: the legal line
 * first, then the directory, then the invitation, and the signature last at the head. It is
 * composed as a letterhead on the site's content column: the signature (the lockup at 72px,
 * the year beneath it) at the head, the invitation and the appointment in the body, and the
 * directory — Explore, Visit, Contact, Correspondence on the twelve-column grid — at the foot
 * with the legal line and the socials. Three groups, two equal pauses; the ink between them
 * is the letter's paper, not space left over. The lockup is a signature, not the headline:
 * 72px, the crest at 20px — the same crest the concierge wears at 24px.
 *
 * On a phone it is a footer: in the flow of the page, compact, and read top to bottom — the
 * signature, the invitation, where to go, where to come, how to reach us, the socials and the
 * legal line, which ends above the concierge's lane. The two compositions share their parts;
 * only the arrangement changes.
 */
export function Footer() {
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const setPendingSection = useSiteStore((s) => s.setPendingSection);
  const routeKind = useSiteStore((s) => s.routeKind);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const showrooms = showroomsInOrder();

  /** A department is a real link; a chapter or the bespoke form goes through the store. */
  const go = (item: MenuItem) => {
    if (item.kind === 'chapter') {
      const id = item.target as SectionId;
      if (routeKind === 'home') {
        const el = sectionElement(id);
        if (el) scrollTo(el, { duration: 1.8 });
      } else {
        setPendingSection(id);
        void (runtime.transition?.navigate('/', { kind: 'curtain' }) ?? runtime.router?.push('/', { scroll: false }));
      }
    } else {
      openConsultation({ topic: 'bespoke', source: 'menu' });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      field.current?.focus();
      return;
    }
    try {
      localStorage.setItem('wj:letters', email);
    } catch {
      /* ignore */
    }
    setSent(true);
  };

  const explore = MENU.map((m) =>
    m.kind === 'route' ? (
      <TransitionLink key={m.id} href={m.target} className={link}>
        {m.label}
      </TransitionLink>
    ) : (
      <button key={m.id} type="button" onClick={() => go(m)} className={cn(link, 'text-left')}>
        {m.label}
      </button>
    ),
  );

  // the three showrooms in the order the client set, each a door to its map; the hours are theirs
  const visit = (withAddress: boolean) => (
    <>
      {showrooms.map((s) => (
        <div key={s.id} className="flex flex-col gap-0.5">
          <a href={s.mapsUrl} target="_blank" rel="noreferrer" className={link}>
            {s.name}
          </a>
          {withAddress && <span className="text-[0.75rem] leading-snug text-ivory/50">{s.address}</span>}
        </div>
      ))}
      <span className={cn('text-ivory/50', withAddress && 'mt-1')}>{SITE.hours}</span>
    </>
  );

  const contact = (
    <>
      <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className={link}>
        {SITE.phone}
      </a>
      <a href={SITE.whatsappHref} target="_blank" rel="noreferrer" className={link}>
        WhatsApp {SITE.whatsapp}
      </a>
    </>
  );

  const socials = SITE.socials.map((s) => (
    <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="transition-colors duration-300 hover:text-ivory">
      {s.label}
    </a>
  ));

  // the signature: the lockup with the year set beneath it (a column) or beside it (a row)
  const signature = (arrangement: 'column' | 'row') => (
    <div className={cn('flex', arrangement === 'column' ? 'flex-col items-start gap-3' : 'items-end gap-5')}>
      <WaseemLockup layout="tight" tone="gold" className={cn('w-auto', arrangement === 'column' ? 'h-16 lg:h-[4.5rem]' : 'h-[3.25rem]')} />
      <span className={cn('micro text-champagne', arrangement === 'row' && 'pb-px')}>{COPY.footer.since}</span>
    </div>
  );

  const cta = (
    <Button variant="bracket" onClick={() => openConsultation({ topic: 'general', source: 'cta' })}>
      {COPY.footer.cta}
    </Button>
  );

  return (
    <footer
      data-theme="dark"
      data-section="footer"
      /**
       * The phone rule in globals.css puts the footer in flow but stretches it to a full
       * screen; a footer of this size does not need the stretch, so it is released here.
       */
      className="fixed inset-x-0 bottom-0 z-0 flex h-svh flex-col bg-ink px-gutter pt-12 pb-[calc(var(--orb-lane)+var(--safe-bottom))] text-ivory md:pb-8 md:pt-[max(10svh,5.5rem)]"
      aria-label="Footer"
    >
      {/* phone: the last line clears the concierge's corner, so the footer ends above the orb's lane */}
      <div className="flex flex-col gap-10 md:hidden">
        {signature('row')}

        <div className="flex flex-col items-start gap-5">
          <h2 className="display text-balance text-[clamp(1.75rem,7.5vw,2.5rem)] leading-[1.05]">{COPY.footer.invitation}</h2>
          {cta}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-9 border-t border-champagne/15 pt-8 text-[0.8125rem] text-ivory/75">
          <Column title="Explore">{explore}</Column>
          <Column title="Visit">{visit(false)}</Column>
          <Column title="Contact" className="col-span-2 gap-2.5">
            {contact}
          </Column>
        </div>

        <div className="flex flex-col gap-5 border-t border-champagne/15 pt-6">
          <div className="micro flex flex-wrap gap-x-6 gap-y-3 text-ivory/70">{socials}</div>
          <p className="micro text-ivory/40">{COPY.footer.legal}</p>
        </div>
      </div>

      {/* wide: the letterhead — the signature at the head, the invitation in the body, the directory at the foot */}
      <div className="wj-content hidden flex-1 flex-col justify-between gap-y-12 md:flex">
        {signature('column')}

        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <h2 className="display max-w-[11em] text-balance text-display-m">{COPY.footer.invitation}</h2>
          {cta}
        </div>

        <div>
          {/* the directory on the twelve-column grid: four equal columns from lg, two by two before it */}
          <div className="wj-grid border-t border-champagne/15 pt-8 text-[0.75rem] text-ivory/70 md:gap-y-10">
            <Column title="Explore" className="gap-2.5 md:col-span-6 lg:col-span-3">
              {explore}
            </Column>
            <Column title="Visit" className="gap-3 md:col-span-6 lg:col-span-3">
              {visit(true)}
            </Column>
            <Column title="Contact" className="gap-2.5 md:col-span-6 lg:col-span-3">
              {contact}
            </Column>
            <div className="flex flex-col gap-3 md:col-span-6 lg:col-span-3">
              <p className="micro mb-2 text-champagne">Correspondence</p>
              {sent ? (
                <p className="font-display text-[1rem] italic text-ivory" style={{ fontVariationSettings: '"opsz" 16' }}>
                  {COPY.footer.correspondenceSuccess}
                </p>
              ) : (
                <form onSubmit={submit} className="flex items-end gap-4">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="sr-only">Your email</span>
                    <input
                      ref={field}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email"
                      autoComplete="email"
                      className="w-full border-b border-champagne/30 bg-transparent py-2 font-display text-[1rem] text-ivory placeholder:text-ivory/40 focus:border-champagne focus:outline-none"
                    />
                  </label>
                  <button type="submit" className="micro pb-2 text-champagne transition-colors hover:text-ivory" aria-label="Subscribe">
                    →
                  </button>
                </form>
              )}
              <p>{COPY.footer.correspondence}</p>
            </div>
          </div>
          {/* the last line: the legal at the left, the socials at the right, clear of the orb's corner */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-champagne/15 pt-6" style={{ paddingRight: 'max(0px, var(--orb-clear))' }}>
            <p className="micro text-ivory/40">{COPY.footer.legal}</p>
            <div className="micro flex flex-wrap gap-x-6 gap-y-2 text-ivory/70">{socials}</div>
          </div>
        </div>
        <TransitionLink href="/" className="sr-only">
          Home
        </TransitionLink>
      </div>
    </footer>
  );
}
