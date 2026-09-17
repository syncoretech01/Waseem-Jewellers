import { SITE } from '@/data/site';
import type { ConsultationDraft, ConsultationDraftField } from '@/state/siteStore';

/**
 * The appointment draft, read the way the form reads it.
 *
 * The form is the authority on what an appointment needs — a name, a telephone number, a
 * showroom, an occasion — and these helpers repeat that rule rather than redefine it, so the
 * concierge can say "I still need your telephone number" before the form has to. Nothing
 * here submits, stores or transmits; it only reads a draft and describes it.
 */

/** The four the form refuses without. In the order the form asks for them. */
export const REQUIRED_FIELDS: readonly ConsultationDraftField[] = ['name', 'phone', 'showroom', 'occasion'];

/** The same words the form offers, so a value the concierge writes is one the form can show. */
export const OCCASIONS = [
  { value: 'bridal', label: 'Bridal' },
  { value: 'bespoke', label: 'Bespoke' },
  { value: 'viewing', label: 'A viewing' },
  { value: 'gift', label: 'Gift' },
] as const;

export const WINDOWS = [
  { value: 'afternoon', label: 'Afternoon 12–4' },
  { value: 'evening', label: 'Evening 4–9:30' },
] as const;

export type OccasionValue = (typeof OCCASIONS)[number]['value'];
export type WindowValue = (typeof WINDOWS)[number]['value'];

export const isOccasion = (v: unknown): v is OccasionValue => OCCASIONS.some((o) => o.value === v);
export const isWindow = (v: unknown): v is WindowValue => WINDOWS.some((w) => w.value === v);

/** The form's own telephone rule, repeated so the concierge can ask again before the form has to. */
export const PHONE_RE = /^\+?[\d\s-]{7,}$/;

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * A showroom by id or by the name a visitor says — "Liberty", "MM Alam", "DHA", "Gulberg".
 * Nothing is guessed: a word that matches none of the three returns undefined.
 */
export function resolveShowroom(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const key = fold(input);
  if (!key) return undefined;
  const byId = SITE.showrooms.find((s) => s.id === input.trim().toLowerCase());
  if (byId) return byId.id;
  for (const s of SITE.showrooms) {
    const name = fold(s.name);
    const address = fold(s.address);
    if (key === name || name.includes(key) || key.includes(name)) return s.id;
    // the district a visitor names — "Gulberg" for Liberty Market — is in the published address
    if (key.length >= 3 && address.includes(key)) return s.id;
  }
  return undefined;
}

export const showroomName = (id: string | undefined) => SITE.showrooms.find((s) => s.id === id)?.name;
export const occasionLabel = (v: string | undefined) => OCCASIONS.find((o) => o.value === v)?.label;
export const windowLabel = (v: string | undefined) => WINDOWS.find((w) => w.value === v)?.label;

/** Today in the visitor's own calendar, as YYYY-MM-DD, so a date is judged where they stand. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * A date the form can take: YYYY-MM-DD, a real calendar day, and not before today. The
 * model normalises "Saturday" or "the 20th" to this shape itself; this only refuses what
 * would not survive the form's own `min`.
 */
export function checkDate(input: unknown, now = new Date()): { ok: true; date: string } | { ok: false; reason: string } {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, reason: 'a date must be written as YYYY-MM-DD' };
  const [y, m, d] = input.split('-').map(Number) as [number, number, number];
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return { ok: false, reason: 'that is not a day in the calendar' };
  if (input < todayIso(now)) return { ok: false, reason: 'that date has passed; ask for a day from today onwards' };
  return { ok: true, date: input };
}

/** Which of the four required fields the draft still lacks. */
export function missingFields(draft: ConsultationDraft | undefined): ConsultationDraftField[] {
  const d = draft ?? {};
  return REQUIRED_FIELDS.filter((f) => {
    const v = d[f];
    if (typeof v !== 'string') return true;
    if (f === 'name') return v.trim().length < 2;
    if (f === 'phone') return !PHONE_RE.test(v.trim());
    return !v.trim();
  });
}

/**
 * The draft as a person would read it back: names rather than ids, labels rather than
 * values, and the pieces by name. Given to the model so its confirming sentence is built
 * from the same words the visitor sees on the form.
 */
export function describeDraft(draft: ConsultationDraft | undefined, pieceName: (slug: string) => string | undefined) {
  const d = draft ?? {};
  const pieces = (d.productSlugs ?? []).map((slug) => ({ slug, name: pieceName(slug) ?? slug }));
  return {
    name: d.name ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    showroom: d.showroom ? { id: d.showroom, name: showroomName(d.showroom) ?? d.showroom } : null,
    occasion: d.occasion ? { value: d.occasion, label: occasionLabel(d.occasion) ?? d.occasion } : null,
    date: d.date ?? null,
    window: d.window ? { value: d.window, label: windowLabel(d.window) ?? d.window } : null,
    message: d.message ?? null,
    pieces,
    missing: missingFields(draft),
  };
}

/**
 * The draft without the visitor's identity, for a context block that is refreshed on every
 * page change: which fields are filled and which are not, never the name or the number.
 */
export function summariseDraft(draft: ConsultationDraft | undefined): string {
  const d = draft ?? {};
  const have: string[] = [];
  if (d.name) have.push('name given');
  if (d.phone) have.push('telephone given');
  if (d.email) have.push('email given');
  const showroom = showroomName(d.showroom);
  if (showroom) have.push(`showroom ${showroom}`);
  const occasion = occasionLabel(d.occasion);
  if (occasion) have.push(`occasion ${occasion}`);
  if (d.date) have.push(`date ${d.date}`);
  const window = windowLabel(d.window);
  if (window) have.push(`time ${window}`);
  if (d.productSlugs?.length) have.push(`${d.productSlugs.length} piece${d.productSlugs.length === 1 ? '' : 's'}`);
  const missing = missingFields(draft);
  return `${have.length ? have.join(', ') : 'nothing filled yet'}; still needed: ${missing.length ? missing.join(', ') : 'nothing'}`;
}
