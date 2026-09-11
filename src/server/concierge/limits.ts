import 'server-only';

import { createHash } from 'node:crypto';

/**
 * Rate limiting, described honestly.
 *
 * This is an in-memory token bucket. On serverless it is **best effort and nothing more**:
 * each instance keeps its own counters, instances come and go, and a determined caller
 * spread across enough cold starts will not be stopped by it. Saying so plainly matters more
 * than the code — a limiter presented as a guarantee is worse than none, because it stops
 * anyone looking for the real one.
 *
 * The real ceiling is the spend limit on the provider's dashboard, which is a client action
 * and is listed as such in the open asks. This layer's job is narrower and still worth
 * having: it makes casual abuse expensive and accidental loops harmless.
 *
 * The IP is salted and hashed before it is used as a key, so nothing here is a log of who
 * asked what.
 */

/**
 * A limit is a pair of windows. The concierge allows a conversation; the enquiry form allows
 * a visitor to change their mind once or twice. The two are sized differently because a
 * limiter tuned for talking would let a script file sixty consultation requests an hour.
 */
export interface Limit {
  perMinute: number;
  perHour: number;
}

export const CONCIERGE_LIMIT: Limit = { perMinute: 12, perHour: 60 };
/** Three in a minute is a retry; five in an hour is a person being thorough. More is not a person. */
export const ENQUIRY_LIMIT: Limit = { perMinute: 3, perHour: 5 };

interface Bucket {
  minute: { count: number; until: number };
  hour: { count: number; until: number };
}

/** One map per scope, so an hour of conversation cannot spend the enquiry allowance or vice versa. */
const scopes = new Map<string, Map<string, Bucket>>();
let lastSweep = 0;

/** A stable, non-identifying key. The salt is per-process, so it does not survive a restart. */
const SALT = createHash('sha256').update(`${process.pid}:${Date.now()}`).digest('hex').slice(0, 16);
const keyFor = (ip: string) => createHash('sha256').update(`${SALT}:${ip}`).digest('hex').slice(0, 24);

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const buckets of scopes.values()) for (const [k, b] of buckets) if (b.hour.until < now) buckets.delete(k);
}

export interface LimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

export function takeToken(ip: string, scope = 'concierge', limit: Limit = CONCIERGE_LIMIT): LimitResult {
  const now = Date.now();
  sweep(now);
  const buckets = scopes.get(scope) ?? new Map<string, Bucket>();
  scopes.set(scope, buckets);
  const key = keyFor(ip);
  const b = buckets.get(key) ?? { minute: { count: 0, until: now + 60_000 }, hour: { count: 0, until: now + 3_600_000 } };

  if (b.minute.until < now) b.minute = { count: 0, until: now + 60_000 };
  if (b.hour.until < now) b.hour = { count: 0, until: now + 3_600_000 };

  if (b.minute.count >= limit.perMinute) {
    buckets.set(key, b);
    return { ok: false, retryAfterSeconds: Math.ceil((b.minute.until - now) / 1000) };
  }
  if (b.hour.count >= limit.perHour) {
    buckets.set(key, b);
    return { ok: false, retryAfterSeconds: Math.ceil((b.hour.until - now) / 1000) };
  }

  b.minute.count++;
  b.hour.count++;
  buckets.set(key, b);
  return { ok: true };
}

/** A request that did not come from this site is not a visitor. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin fetches from the app send none
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Long enough for any real question, short enough that nothing is being smuggled. */
export const MAX_INPUT_CHARS = 600;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}
