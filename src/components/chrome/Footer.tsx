'use client';

import { useRef, useState } from 'react';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { Button } from '@/components/ui/Button';
import { Monogram } from './Monogram';
import { useSiteStore } from '@/state/siteStore';
import { runtime, scrollTo } from '@/state/runtime';
import { sectionElement } from '@/state/sections';
import { MENU, SITE } from '@/data';
import { COPY } from '@/data/copy';
import type { MenuItem } from '@/data/types';
import type { SectionId } from '@/state/siteStore';

/**
 * Fixed beneath #page-root (which carries margin-bottom: 100svh), so the last chapter
 * lifts away to reveal it. Editorial, not a four-column e-commerce footer.
 */
export function Footer() {
  const openConsultation = useSiteStore((s) => s.openConsultation);
  const setPendingSection = useSiteStore((s) => s.setPendingSection);
  const routeKind = useSiteStore((s) => s.routeKind);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const go = (item: MenuItem) => {
    if (item.kind === 'route') {
      void (runtime.transition?.navigate(item.target, { kind: 'curtain' }) ?? runtime.router?.push(item.target, { scroll: false }));
    } else if (item.kind === 'chapter') {
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

  return (
    <footer
      data-theme="dark"
      data-section="footer"
      className="fixed inset-x-0 bottom-0 z-0 flex h-svh flex-col justify-between bg-ink px-gutter pb-8 pt-[10svh] text-ivory"
      aria-label="Footer"
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <h2 className="display max-w-[11em] text-display-m">{COPY.footer.invitation}</h2>
        <Button variant="bracket" onClick={() => openConsultation({ topic: 'general', source: 'cta' })}>
          {COPY.footer.cta}
        </Button>
      </div>

      <div className="flex flex-col items-start gap-4">
        <p className="display text-[clamp(2.75rem,9.5vw,12rem)] leading-[0.9] text-ivory">{COPY.footer.mark}</p>
        <div className="flex items-center gap-5">
          <Monogram className="h-8 w-auto" />
          <span className="micro text-champagne">{COPY.footer.since}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 border-t border-champagne/15 pt-8 text-[0.75rem] text-ivory/70 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="micro mb-2 text-champagne">The House</p>
          {MENU.map((m) => (
            <button key={m.id} type="button" onClick={() => go(m)} className="w-fit text-left transition-colors hover:text-ivory">
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className="micro mb-2 text-champagne">Visit</p>
          {SITE.showrooms.map((s) => (
            <span key={s.id}>{s.address}</span>
          ))}
          <span className="mt-2">
            {SITE.hours} · {SITE.phone}
          </span>
          <span>WhatsApp {SITE.whatsapp}</span>
          <a href={SITE.showrooms[0]!.mapsUrl} target="_blank" rel="noreferrer" className="w-fit transition-colors hover:text-ivory">
            Directions →
          </a>
        </div>
        <div className="flex flex-col gap-3">
          <p className="micro mb-2 text-champagne">Correspondence</p>
          {sent ? (
            <p className="font-display italic text-[1rem] text-ivory" style={{ fontVariationSettings: '"opsz" 16' }}>
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
                  className="w-full border-b border-champagne/30 bg-transparent py-2 font-display text-[1rem] text-ivory placeholder:text-ivory/40 focus:border-champagne focus:outline-none"
                />
              </label>
              <button type="submit" className="micro pb-2 text-champagne transition-colors hover:text-ivory" aria-label="Subscribe">
                →
              </button>
            </form>
          )}
          <p>{COPY.footer.correspondence}</p>
          <div className="micro mt-4 flex flex-wrap gap-5">
            {SITE.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-ivory">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <p className="micro mt-6 text-ivory/40">{COPY.footer.legal}</p>
      <TransitionLink href="/" className="sr-only">
        Home
      </TransitionLink>
    </footer>
  );
}
