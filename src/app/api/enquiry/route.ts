import 'server-only';

import { randomBytes } from 'node:crypto';
import { getRepository } from '@/data/repository';
import { enquiryReadiness, enquirySink, type Enquiry } from '@/server/enquiry/sink';
import { SITE } from '@/data/site';
import { ENQUIRY_LIMIT, clientIp, takeToken } from '@/server/concierge/limits';

/**
 * A consultation request, with the reference issued here rather than in a browser.
 *
 * The reference was built client-side from `Math.random`, which is fine while nothing receives
 * it and a genuine hazard the moment something does: two visitors on the same day can be handed
 * the same code, and a jeweller ringing back has no way to tell which request they are holding.
 *
 * The route refuses to accept anything at all until every part of the production configuration
 * exists — a destination, a canonical origin, a privacy statement and a privacy contact. That is
 * not caution for its own sake: accepting a name and a telephone number and then discarding
 * them is still a transmission. The decision is `enquiryReadiness()`, the same function the
 * capabilities endpoint uses to tell the form whether to post, so the two cannot disagree.
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

const bad = (message: string, status = 400, headers?: HeadersInit) => Response.json({ error: message }, { status, headers });

/** A consultation request is a few hundred bytes. Anything near this is not one. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Best-effort idempotency, described honestly.
 *
 * A retried submission — a dropped connection, a double tap — must not become two enquiries
 * in the sheet. The form sends a key it generated once, and a repeat within the window gets
 * the reference already issued without delivering again. In-memory, so on serverless it
 * holds within an instance and not across them: the sink still sees the rare duplicate that
 * lands on a different one, which is a smaller problem than a visitor who thinks their
 * request was lost.
 */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const issued = new Map<string, { reference: string; at: number }>();

/** The body as text, or null the moment it exceeds `max` bytes. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function remembered(key: string | undefined): string | null {
  if (!key) return null;
  const now = Date.now();
  for (const [k, v] of issued) if (now - v.at > IDEMPOTENCY_WINDOW_MS) issued.delete(k);
  return issued.get(key)?.reference ?? null;
}

export async function POST(req: Request) {
  const readiness = enquiryReadiness();
  if (!readiness.ready) {
    // the client asks first and does not post; this is the belt to that braces
    return bad('ENQUIRY_NOT_CONFIGURED', 503);
  }

  /**
   * Only from this site. A browser always sends Origin on a cross-site POST and on a same-site
   * fetch, so an absent header is not a browser form — it is a script — and is refused rather
   * than waved through.
   */
  const origin = req.headers.get('origin');
  let sameOrigin = false;
  try {
    sameOrigin = origin !== null && new URL(origin).origin === readiness.config.origin;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return bad('ORIGIN', 403);

  /**
   * Rate, size and repetition — the three cheap abuses.
   *
   * The bucket is the enquiry one, not the concierge one: three a minute is a retry, five
   * an hour is a thorough person, and a limiter sized for conversation would let a script
   * file sixty requests an hour into a jeweller's inbox. Best-effort on serverless, as
   * `limits.ts` says plainly; the sink's own quota is the ceiling behind it.
   */
  const limit = takeToken(clientIp(req), 'enquiry', ENQUIRY_LIMIT);
  if (!limit.ok) return bad('RATE_LIMITED', 429, { 'retry-after': String(limit.retryAfterSeconds ?? 60) });

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return bad('TOO_LARGE', 413);

  let body: Record<string, unknown>;
  /**
   * Streamed, and counted in bytes as it arrives. `req.text()` would buffer a chunked body of
   * any size before a length could be checked, and `.length` on the result counts UTF-16
   * units rather than bytes. The reader is cancelled the moment the cap is crossed, so the
   * most a request can cost is the cap plus one chunk.
   */
  const text = await readCapped(req, MAX_BODY_BYTES);
  if (text === null) return bad('TOO_LARGE', 413);
  try {
    body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('MALFORMED');
  } catch {
    return bad('MALFORMED');
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.idempotencyKey) ? body.idempotencyKey : undefined;
  const already = remembered(idempotencyKey);
  if (already) return Response.json({ reference: already, repeated: true });

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
    /**
     * The visitor has already written it out; losing it silently is the one unacceptable
     * outcome. The reference travels with the failure because a sink can time out *after*
     * the row landed — a cold Apps Script routinely does — and a jeweller then holds a code
     * the visitor was never shown. Sending it lets the form quote the one that may exist.
     */
    return Response.json({ error: 'DELIVERY', reference: enquiry.reference }, { status: 502 });
  }

  if (idempotencyKey) issued.set(idempotencyKey, { reference: enquiry.reference, at: Date.now() });
  return Response.json({ reference: enquiry.reference });
}
