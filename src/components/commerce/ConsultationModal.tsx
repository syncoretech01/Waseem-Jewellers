'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, ChoiceRow } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useSiteStore } from '@/state/siteStore';
import { getProduct, productsBySlugs, SITE } from '@/data';
import { whatsappHref } from '@/data/site';
import { COPY } from '@/data/copy';
import { EASE } from '@/lib/motion/easings';

type Stage = 'idle' | 'submitting' | 'success';

const OCCASIONS = [
  { value: 'bridal', label: 'Bridal' },
  { value: 'bespoke', label: 'Bespoke' },
  { value: 'viewing', label: 'Private viewing' },
  { value: 'gift', label: 'Gift' },
];
const WINDOWS = [
  { value: 'afternoon', label: 'Afternoon 12–4' },
  { value: 'evening', label: 'Evening 4–9:30' },
];

function reference() {
  const d = new Date();
  const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  return `WJ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${code}`;
}

/** Private consultation — no backend. The request is kept in sessionStorage and acknowledged by the concierge. */
export function ConsultationModal() {
  const consultation = useSiteStore((s) => s.consultation);
  const close = useSiteStore((s) => s.closeConsultation);
  const [stage, setStage] = useState<Stage>('idle');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showroom, setShowroom] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [window_, setWindow] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ref, setRef] = useState('');

  const pieces = useMemo(() => {
    const slugs = consultation.productSlugs ?? (consultation.productSlug ? [consultation.productSlug] : []);
    return productsBySlugs(slugs);
  }, [consultation.productSlug, consultation.productSlugs]);

  // each opening begins afresh (derived during render, keyed on the open flag)
  const [seenOpen, setSeenOpen] = useState(false);
  if (consultation.open !== seenOpen) {
    setSeenOpen(consultation.open);
    if (consultation.open) {
      setStage('idle');
      setErrors({});
      const topic = consultation.topic;
      setOccasion(topic === 'bridal' ? 'bridal' : topic === 'bespoke' ? 'bespoke' : topic === 'viewing' ? 'viewing' : null);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Your name, please.';
    if (!/^\+?[\d\s-]{7,}$/.test(phone.trim())) next.phone = 'A telephone number we can reach.';
    if (!showroom) next.showroom = 'Choose a showroom.';
    if (!occasion) next.occasion = 'Choose an occasion.';
    setErrors(next);
    if (Object.keys(next).length) {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      return;
    }
    setStage('submitting');
    const code = reference();
    setRef(code);
    try {
      sessionStorage.setItem('wj:consultation', JSON.stringify({ code, name, phone, email, showroom, occasion, date, window: window_, pieces: pieces.map((p) => p.slug), message, at: Date.now() }));
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setStage('success'), 700);
  };

  const showroomName = SITE.showrooms.find((s) => s.id === showroom)?.name ?? '';
  const waText = `Private consultation request ${ref}: ${name}, ${showroomName}${pieces.length ? `, regarding ${pieces.map((p) => p.editorialTitle).join(', ')}` : ''}.`;

  return (
    <Dialog open={consultation.open} onClose={close} label={COPY.consultation.eyebrow} variant="center" theme="ivory" className="px-8 py-10 md:px-12 md:py-12">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="micro text-fg-muted">{COPY.consultation.eyebrow}</p>
          <h2 className="display mt-3 text-display-m">{COPY.consultation.title}</h2>
          <p className="micro mt-3 text-fg-muted">{COPY.consultation.sub}</p>
        </div>
        <button type="button" onClick={close} className="micro pt-1 text-fg-muted transition-colors hover:text-fg" data-cursor="close">
          Close
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {stage === 'success' ? (
          <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE.out }} className="mt-10 flex flex-col gap-6">
            <p className="font-display text-heading" style={{ fontVariationSettings: '"opsz" 32' }}>
              {COPY.consultation.success.title}
            </p>
            <p className="max-w-[30em] text-fg-muted">{COPY.consultation.success.line}</p>
            <p className="micro text-fg-muted">
              Reference <span className="text-gold font-display text-[1rem] tracking-normal">{ref}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-8">
              <Button variant="bracket" href={whatsappHref(waText)} target="_blank">
                {COPY.consultation.success.whatsapp}
              </Button>
              <Button variant="text" onClick={close}>
                {COPY.consultation.success.close}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} className="mt-6 flex flex-col gap-2">
            {pieces.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {pieces.map((p) => (
                  <span key={p.slug} className="micro border-b border-line pb-1 text-fg">
                    {p.editorialTitle}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required autoComplete="name" />
              <Field label="Telephone" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} required type="tel" autoComplete="tel" hint="+92 3xx xxx xxxx" />
            </div>
            <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            <ChoiceRow label="Showroom" options={SITE.showrooms.map((s) => ({ value: s.id, label: s.name }))} value={showroom} onChange={setShowroom} error={errors.showroom} />
            <ChoiceRow label="Occasion" options={OCCASIONS} value={occasion} onChange={setOccasion} error={errors.occasion} />
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Field label="Preferred date" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              <ChoiceRow label="Time" options={WINDOWS} value={window_} onChange={setWindow} />
            </div>
            <Field label="A note for us" multiline value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="mt-8 flex items-center gap-8">
              <Button variant="bracket" type="submit" disabled={stage === 'submitting'}>
                {stage === 'submitting' ? 'A moment' : 'Request a consultation'}
              </Button>
              {stage === 'submitting' && <span className="hairline w-10 animate-pulse" aria-hidden />}
            </div>
            {consultation.productSlug && getProduct(consultation.productSlug) && <p className="sr-only">Regarding {getProduct(consultation.productSlug)?.editorialTitle}</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
