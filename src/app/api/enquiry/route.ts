import 'server-only';

import { randomBytes } from 'node:crypto';
import { getRepository } from '@/data/repository';
import { enquirySink, enquiryIsConfigured, type Enquiry } from '@/server/enquiry/sink';
import { SITE } from '@/data/site';

/**
 * A consultation request, with the reference issued here rather than in a browser.
 *
 * The reference was built client-side from `Math.random`, which is fine while nothing receives
 * it and a genuine hazard the moment something does: two visitors on the same day can be handed
 * the same code, and a jeweller ringing back has no way to tell which request they are holding.
 *
 * The route refuses to accept anything at all while no destination is configured. That is not
 * caution for its own sake — accepting a name and a telephone number and then discarding them
 * is still a transmission, and this site has no privacy statement yet. Until Waseem supplies a
 * destination and a privacy contact, the form stays where it is: on the visitor's device.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = { name: 80, phone: 32, email: 120, message: 1200, specQuestion: 400, showroom: 40, occasion: 40, date: 24, window: 40, language: 12 } as const;

const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  // newlines out of every single-line field: a header injection in an email sink starts here
  const t = v.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  return t || undefined;
};

/** Crockford-ish: no I, O, 0 or 1, so a code read down a telephone is not misheard. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function reference(): string {
  const d = new Date();
  const bytes = randomBytes(6);
  const code = Array.from(bytes.subarray(0, 6), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `WJ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${code}`;
}

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  if (!enquiryIsConfigured()) {
    // the client asks first and does not post; this is the belt to that braces
    return bad('ENQUIRY_NOT_CONFIGURED', 503);
  }

  // a request from somewhere that is not this site
  const origin = req.headers.get('origin');
  const expected = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (origin && expected && new URL(origin).origin !== new URL(expected).origin) return bad('ORIGIN', 403);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad('MALFORMED');
  }

  // a real visitor takes longer than three seconds to fill this in
  const elapsed = typeof body.elapsedMs === 'number' ? body.elapsedMs : 0;
  if (elapsed < 3000) return bad('TOO_FAST');
  if (clean(body.company, 40)) return bad('TOO_FAST'); // honeypot: no human fills a hidden field

  const name = clean(body.name, MAX.name);
  const phone = clean(body.phone, MAX.phone);
  const showroom = clean(body.showroom, MAX.showroom);
  const occasion = clean(body.occasion, MAX.occasion);
  if (!name || name.length < 2) return bad('NAME');
  if (!phone || !/^\+?[\d\s-]{7,}$/.test(phone)) return bad('PHONE');
  if (!showroom || !SITE.showrooms.some((s) => s.id === showroom)) return bad('SHOWROOM');
  if (!occasion) return bad('OCCASION');

  // a slug the catalogue does not carry is dropped, not refused: it costs the enquiry a line,
  // never the whole request a visitor has just spent a minute writing
  const repo = getRepository();
  const listable = new Set(await repo.allSlugs());
  const pieceSlugs = Array.isArray(body.pieceSlugs)
    ? body.pieceSlugs.filter((s): s is string => typeof s === 'string' && listable.has(s)).slice(0, 40)
    : [];

  const enquiry: Enquiry = {
    reference: reference(),
    name,
    phone,
    email: clean(body.email, MAX.email),
    showroom,
    occasion,
    date: clean(body.date, MAX.date),
    window: clean(body.window, MAX.window),
    pieceSlugs,
    message: typeof body.message === 'string' ? body.message.trim().slice(0, MAX.message) || undefined : undefined,
    budgetPkr: typeof body.budgetPkr === 'number' && body.budgetPkr > 0 ? Math.round(Math.min(body.budgetPkr, 1_000_000_000)) : undefined,
    specQuestion: clean(body.specQuestion, MAX.specQuestion),
    preferredLanguage: clean(body.preferredLanguage, MAX.language),
    receivedAt: new Date().toISOString(),
  };

  try {
    await enquirySink().deliver(enquiry);
  } catch {
    // the visitor has already written it out; losing it silently is the one unacceptable outcome
    return bad('DELIVERY', 502);
  }

  return Response.json({ reference: enquiry.reference });
}
