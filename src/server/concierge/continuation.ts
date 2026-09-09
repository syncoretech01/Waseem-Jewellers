import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { conciergeEnv } from '../env';

/**
 * How one turn survives a round trip without the server remembering anything.
 *
 * A serverless function cannot hold a socket open while the browser executes a tool, so the
 * conversation so far has to travel with the request. That makes it a thing the client holds
 * — and therefore a thing a client could edit. Signing it is not ceremony: without a
 * signature, a visitor could hand us arbitrary "assistant" history and have the model treat
 * their own words as its own prior reasoning.
 *
 * So: base64url of the messages, an HMAC over the payload *and* the turn id, and a sixty
 * second life. Bound to the turn so a continuation cannot be replayed into a different one,
 * and short enough that a captured one is worthless by the time it is useful.
 */

export interface ContinuationPayload {
  turnId: string;
  round: number;
  callsSoFar: number;
  messages: { role: string; content: string; tool_call_id?: string; tool_calls?: unknown }[];
  issuedAt: number;
}

/** Three rounds answer any question this concierge is asked. */
export const MAX_ROUNDS = 3;
const TTL_MS = 60_000;

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function sign(body: string, turnId: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(`${turnId}.${body}`).digest());
}

export function seal(payload: ContinuationPayload): string | null {
  const { secret } = conciergeEnv();
  if (!secret) return null;
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body, payload.turnId, secret)}`;
}

export type Opened = { ok: true; payload: ContinuationPayload } | { ok: false; reason: 'CONTINUATION_INVALID' | 'CONTINUATION_EXPIRED' };

export function open(token: string, turnId: string): Opened {
  const { secret } = conciergeEnv();
  if (!secret) return { ok: false, reason: 'CONTINUATION_INVALID' };
  const dot = token.lastIndexOf('.');
  if (dot < 1) return { ok: false, reason: 'CONTINUATION_INVALID' };
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);
  const expected = sign(body, turnId, secret);

  // constant time, and length-checked first because timingSafeEqual throws on a mismatch
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'CONTINUATION_INVALID' };

  try {
    const payload = JSON.parse(unb64url(body).toString('utf8')) as ContinuationPayload;
    if (payload.turnId !== turnId) return { ok: false, reason: 'CONTINUATION_INVALID' };
    if (Date.now() - payload.issuedAt > TTL_MS) return { ok: false, reason: 'CONTINUATION_EXPIRED' };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'CONTINUATION_INVALID' };
  }
}
