'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, ChoiceRow } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useSiteStore, type ConsultationDraftField } from '@/state/siteStore';
import { SITE } from '@/data';
import { showroomsInOrder } from '@/data/heritage';
import { getRow, getRows, loadIndex } from '@/data/clientIndex';
import { whatsappHref } from '@/data/site';
import { COPY } from '@/data/copy';
import { EASE } from '@/lib/motion/easings';
import { capabilities, probeCapabilities } from '@/concierge/capabilities';
import { OCCASIONS, WINDOWS } from '@/concierge/tools/appointment';

/**
 * `ready` is the local outcome: details prepared on the device, nothing sent. `delivered` is
 * the server outcome: the route accepted it and the sink took it. They are different states
 * because they are different facts, and the acknowledgement must not say the second when
 * only the first happened — including when a server submission fails and falls back.
 */
type Stage = 'idle' | 'submitting' | 'ready' | 'delivered';

/** The fields the concierge can write into; the honeypot is deliberately not one of them. */
type FieldName = Exclude<ConsultationDraftField, 'productSlugs'>;

function reference() {
  const d = new Date();
  /**
   * Four characters from the platform CSPRNG rather than `Math.random`, and drawn from an
   * alphabet with no I, O, 0 or 1 — this code gets read down a telephone.
   *
   * While no destination is configured nothing receives it, so a collision is invisible; the
   * moment one is, the server issues the reference instead and this is not used at all.
   */
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `WJ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${code}`;
}

/** The appointment request — no backend. The request is kept in sessionStorage and acknowledged by the concierge. */
export function ConsultationModal() {
  const consultation = useSiteStore((s) => s.consultation);
  /** What this deployment allows; re-read when the dialog opens, after the probe has answered. */
  const [caps, setCaps] = useState(capabilities);
  // the index arrives when the form does; a visitor who never opens it never pays for it
  useEffect(() => {
    if (consultation.open) {
      void loadIndex();
      // whether a request may leave the device at all — asked of the server, once
      void probeCapabilities().then(setCaps);
      /**
       * One clock and one key per enquiry, not per opening. The fields persist when the
       * dialog is closed and reopened, so resetting the clock there refused a genuine visitor
       * who came back to press the button — and minting a fresh key made a resubmission
       * after a dropped response into a second enquiry rather than the same one. Both are
       * reset together when a submission has actually concluded.
       */
      if (!openedAt.current) openedAt.current = Date.now();
      if (!idempotencyKey.current) idempotencyKey.current = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }, [consultation.open]);
  const close = useSiteStore((s) => s.closeConsultation);
  const submitNonce = useSiteStore((s) => s.consultationSubmitNonce);
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
  /** The pieces a submission carried, held for the acknowledgement after the draft is cleared. */
  const [sentPieces, setSentPieces] = useState<string[] | null>(null);
  /**
   * When the visitor last typed into each field. The concierge's draft carries its own
   * stamps, and a field shows whichever hand wrote last: a value the visitor typed is
   * theirs until the concierge is told something newer, and a draft value follows into every
   * field the visitor has not touched since. Nothing is copied between the two — the shown
   * value is derived, so the form and the draft cannot disagree about what is on screen.
   */
  const [touchedAt, setTouchedAt] = useState<Partial<Record<FieldName, number>>>({});
  const touch = (field: FieldName) => setTouchedAt((t) => ({ ...t, [field]: Date.now() }));
  const draft = consultation.draft;
  const draftAt = consultation.draftAt;
  const shown = <T,>(field: FieldName, own: T, fromDraft: T | undefined): T => {
    const wrote = draftAt?.[field] ?? 0;
    if (!wrote || fromDraft === undefined) return own;
    return wrote > (touchedAt[field] ?? 0) ? fromDraft : own;
  };
  const values = {
    name: shown('name', name, draft?.name),
    phone: shown('phone', phone, draft?.phone),
    email: shown('email', email, draft?.email),
    showroom: shown<string | null>('showroom', showroom, draft?.showroom),
    occasion: shown<string | null>('occasion', occasion, draft?.occasion),
    date: shown('date', date, draft?.date),
    window: shown<string | null>('window', window_, draft?.window),
    message: shown('message', message, draft?.message),
  };
  /** A hidden field. No visitor fills it; a form-filling script does. */
  const [honeypot, setHoneypot] = useState('');
  /**
   * When the form was opened, so a submission faster than a human can be refused.
   *
   * Initialised to 0 rather than to the clock: reading the clock during render is impure, and
   * the value that matters is set when the dialog actually opens, a few lines below.
   */
  const openedAt = useRef(0);
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus();
  }, [errors]);
  /** One per opening of the form, so a retry after a dropped connection is not a second enquiry. */
  const idempotencyKey = useRef('');

  const draftSlugs = draft?.productSlugs;
  const pieces = useMemo(() => {
    const slugs = consultation.productSlugs ?? (consultation.productSlug ? [consultation.productSlug] : []);
    // the pieces the door was opened with, and the ones the concierge added to the request
    return getRows([...new Set([...slugs, ...(draftSlugs ?? [])])]);
  }, [consultation.productSlug, consultation.productSlugs, draftSlugs]);

  // each opening begins afresh (derived during render, keyed on the open flag)
  const [seenOpen, setSeenOpen] = useState(false);
  if (consultation.open !== seenOpen) {
    setSeenOpen(consultation.open);
    if (consultation.open) {
      setStage('idle');
      setErrors({});
      setHoneypot('');
      setSentPieces(null);
      const topic = consultation.topic;
      setOccasion(topic === 'bridal' ? 'bridal' : topic === 'bespoke' ? 'bespoke' : topic === 'viewing' ? 'viewing' : null);
    }
  }

  const form = useRef<HTMLFormElement>(null);
  /** The nonce this form last acted on, so a re-render does not submit twice. */
  const handledNonce = useRef(0);
  const setOutcome = useSiteStore((s) => s.setConsultationOutcome);
  const clearDraft = useSiteStore((s) => s.clearConsultationDraft);
  /**
   * The concierge asks; the form answers, through its own button.
   *
   * `requestSubmit` raises the same submit event the visitor's click does, so the
   * validation, the honeypot and the elapsed-time rule below run unchanged — the concierge
   * has no second path around them. A request that arrives while the form is not showing
   * (closed, or already acknowledged) is answered as invalid rather than left hanging.
   */
  useEffect(() => {
    if (submitNonce === 0 || handledNonce.current === submitNonce) return;
    if (!consultation.open) return;
    if (stage === 'submitting') return;
    handledNonce.current = submitNonce;
    if (stage !== 'idle' || !form.current) {
      setOutcome({ nonce: submitNonce, status: 'invalid', missing: [] });
      return;
    }
    form.current.requestSubmit();
  }, [submitNonce, consultation.open, stage, setOutcome]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, phone, email, showroom, occasion, date, window: window_ } = values;
    const message = values.message;
    const nonce = useSiteStore.getState().consultationSubmitNonce;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Your name, please.';
    if (!/^\+?[\d\s-]{7,}$/.test(phone.trim())) next.phone = 'A telephone number we can reach.';
    if (!showroom) next.showroom = 'Choose a showroom.';
    if (!occasion) next.occasion = 'Choose an occasion.';
    setErrors(next);
    // focus moves in the effect below, once React has rendered aria-invalid — a querySelector
    // here ran before it existed and found nothing, so the visitor was told nothing
    if (Object.keys(next).length) {
      setOutcome({ nonce, status: 'invalid', missing: Object.keys(next) });
      return;
    }
    /**
     * What is sent is what is shown. The shown values are pinned into the visitor's own
     * state here so the form still holds them once the draft is cleared — which happens when
     * this submission concludes, because this request is the one the draft was gathered for.
     */
    setName(name);
    setPhone(phone);
    setEmail(email);
    setShowroom(showroom);
    setOccasion(occasion);
    setDate(date);
    setWindow(window_);
    setMessage(message);
    setSentPieces(pieces.map((p) => p.s));
    setStage('submitting');
    /**
     * Nothing leaves the device unless Waseem has given us somewhere to send it.
     *
     * `capabilities().enquiry` is 'local' on every deployment today, so this is the same
     * client-side flow the form has always had: a reference, a note kept in this tab, and
     * the visitor's own WhatsApp message. It becomes a real request the moment a destination
     * is configured — which must not happen before there is a privacy statement to point at,
     * because that is the first time a name and a telephone number would travel.
     */
    const local = caps.enquiry !== 'server';
    const fallback = reference();
    const sent = pieces;
    const waLine = (code: string) => whatsappHref(`Appointment request ${code}: ${name}, ${SITE.showrooms.find((s) => s.id === showroom)?.name ?? ''}${sent.length ? `, regarding ${sent.map((p) => p.t).join(', ')}` : ''}.`);

    const keepLocally = (code: string) => {
      try {
        sessionStorage.setItem('wj:consultation', JSON.stringify({ code, name, phone, email, showroom, occasion, date, window: window_, pieces: sent.map((p) => p.s), message, at: Date.now() }));
      } catch {
        /* private mode: the reference on screen is still the visitor's copy */
      }
    };

    /**
     * The one place the outcome is written, so the concierge and the screen say the same
     * thing. `prepared` is the screen's "ready": kept here, nothing sent. `failed` is a
     * server submission that did not arrive — the screen shows "ready" for it too, because
     * the request is still the visitor's to send, but the concierge is told the difference.
     */
    const conclude = (status: 'prepared' | 'delivered' | 'failed', code: string) => {
      setRef(code);
      keepLocally(code);
      setStage(status === 'delivered' ? 'delivered' : 'ready');
      clearDraft();
      setOutcome({ nonce, status, reference: code, whatsappHref: waLine(code) });
    };

    if (local) {
      window.setTimeout(() => conclude('prepared', fallback), 700);
      return;
    }

    void fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        email,
        showroom,
        occasion,
        date,
        window: window_,
        pieceSlugs: sent.map((p) => p.s),
        message,
        budgetPkr: consultation.budgetPkr,
        elapsedMs: Date.now() - openedAt.current,
        company: honeypot,
        idempotencyKey: idempotencyKey.current,
      }),
    })
      .then(async (r) => {
        const json = (await r.json().catch(() => ({}))) as { reference?: string; error?: string };
        if (r.ok && json.reference) return { delivered: true, reference: json.reference };
        // a delivery failure may still carry the reference the sink recorded before timing out
        return { delivered: false, reference: typeof json.reference === 'string' ? json.reference : fallback };
      })
      .catch(() => ({ delivered: false, reference: fallback }))
      .then(({ delivered, reference: issued }) => {
        // the visitor has already written it out: show them a reference and their own
        // WhatsApp line rather than losing the request to a failed request; and it did not
        // arrive, so the words must not say it did
        conclude(delivered ? 'delivered' : 'failed', issued);
        if (delivered) {
          // this enquiry is concluded; the next one gets its own clock and key
          openedAt.current = 0;
          idempotencyKey.current = '';
        }
      });
  };

  const showroomName = SITE.showrooms.find((s) => s.id === values.showroom)?.name ?? '';
  const acknowledged = sentPieces ? getRows(sentPieces) : pieces;
  const waText = `Appointment request ${ref}: ${values.name}, ${showroomName}${acknowledged.length ? `, regarding ${acknowledged.map((p) => p.t).join(', ')}` : ''}.`;

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
        {stage === 'ready' || stage === 'delivered' ? (
          <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE.out }} className="mt-10 flex flex-col gap-6">
            <p className="font-display text-heading" style={{ fontVariationSettings: '"opsz" 32' }}>
              {COPY.consultation[stage].title}
            </p>
            <p className="max-w-[30em] text-fg-muted">{COPY.consultation[stage].line}</p>
            <p className="micro text-fg-muted">
              Reference <span className="text-gold font-display text-[1rem] tracking-normal">{ref}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-8">
              <Button variant="bracket" href={whatsappHref(waText)} target="_blank">
                {COPY.consultation[stage].whatsapp}
              </Button>
              <Button variant="text" onClick={close}>
                {COPY.consultation[stage].close}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form ref={form} key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} className="mt-6 flex flex-col gap-2">
            {/*
              A field no person can see and no person fills. It is hidden from assistive
              technology too — a screen-reader user is a visitor, not a bot, and must not be
              asked to skip a decoy. tabIndex keeps it out of the keyboard order.
            */}
            <div aria-hidden hidden>
              <label htmlFor="wj-company">Company</label>
              <input
                id="wj-company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            {pieces.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {pieces.map((p) => (
                  <span key={p.s} className="micro border-b border-line pb-1 text-fg">
                    {p.t}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Field
                label="Name"
                value={values.name}
                onChange={(e) => {
                  setName(e.target.value);
                  touch('name');
                }}
                error={errors.name}
                required
                autoComplete="name"
              />
              <Field
                label="Telephone"
                value={values.phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  touch('phone');
                }}
                error={errors.phone}
                required
                type="tel"
                autoComplete="tel"
                hint="+92 3xx xxx xxxx"
              />
            </div>
            <Field
              label="Email"
              value={values.email}
              onChange={(e) => {
                setEmail(e.target.value);
                touch('email');
              }}
              type="email"
              autoComplete="email"
            />
            <ChoiceRow
              label="Showroom"
              options={showroomsInOrder().map((s) => ({ value: s.id, label: s.name }))}
              value={values.showroom}
              onChange={(v) => {
                setShowroom(v);
                touch('showroom');
              }}
              error={errors.showroom}
            />
            <ChoiceRow
              label="Occasion"
              options={[...OCCASIONS]}
              value={values.occasion}
              onChange={(v) => {
                setOccasion(v);
                touch('occasion');
              }}
              error={errors.occasion}
            />
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Field
                label="Preferred date"
                type="date"
                value={values.date}
                onChange={(e) => {
                  setDate(e.target.value);
                  touch('date');
                }}
                min={new Date().toISOString().slice(0, 10)}
              />
              <ChoiceRow
                label="Time"
                options={[...WINDOWS]}
                value={values.window}
                onChange={(v) => {
                  setWindow(v);
                  touch('window');
                }}
              />
            </div>
            <Field
              label="A note for us"
              multiline
              value={values.message}
              onChange={(e) => {
                setMessage(e.target.value);
                touch('message');
              }}
            />
            <div className="mt-8 flex items-center gap-8">
              {/*
                Shown only when a submission will leave the device. The server hands these
                two values over with the permission itself, so this line cannot be absent on
                a deployment that posts — and is never shown on one that does not, where it
                would be a disclosure about a transmission that is not happening.
              */}
              {caps.enquiry === 'server' && caps.privacy && (
                <p className="micro max-w-[34em] text-fg-muted">
                  {COPY.consultation.consent(caps.privacy.contact).split(COPY.consultation.consentLink)[0]}
                  <a href={caps.privacy.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 decoration-line-strong hover:decoration-gold-hi">
                    {COPY.consultation.consentLink}
                  </a>
                  {COPY.consultation.consent(caps.privacy.contact).split(COPY.consultation.consentLink)[1]}
                </p>
              )}
              <Button variant="bracket" type="submit" disabled={stage === 'submitting'}>
                {stage === 'submitting' ? 'A moment' : 'Request an appointment'}
              </Button>
              {stage === 'submitting' && <span className="hairline w-10 animate-pulse" aria-hidden />}
            </div>
            {consultation.productSlug && getRow(consultation.productSlug) && <p className="sr-only">Regarding {getRow(consultation.productSlug)?.t}</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
