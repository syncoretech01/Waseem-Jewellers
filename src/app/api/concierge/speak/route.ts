import { voiceEnv } from '@/server/env';
import { clientIp, sameOrigin, takeToken, MAX_INPUT_CHARS, type Limit } from '@/server/concierge/limits';

/**
 * Speaking, through a speech model.
 *
 * The browser's own voices are the fallback tier: most platforms carry no Urdu or Punjabi
 * voice at all, and the concierge would rather write than read Urdu aloud in English. This
 * route turns a reply the register has already filtered into speech in the visitor's own
 * language, streamed as it is made. The text is the concierge's, never the visitor's, so
 * nothing private is ever spoken by anyone but the visitor's own device.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEAK_LIMIT: Limit = { perMinute: 20, perHour: 240 };
const UPSTREAM_TIMEOUT_MS = 20_000;

/** How the concierge sounds: an associate in a quiet showroom, not an announcer. */
const INSTRUCTIONS =
  'You are the concierge of a fine jeweller in Lahore. Speak calmly, warmly and without hurry, with precise diction and no salesmanship. Pronounce Urdu, Roman Urdu and Punjabi words as a native speaker of Lahore would, and English with a soft South Asian English cadence. Never sound like an announcer or an assistant app.';

export async function POST(request: Request) {
  const env = voiceEnv();
  const fail = (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

  if (!env.apiKey) return fail('CONCIERGE_VOICE_OFFLINE', 'no voice configured', 503);
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);
  const limit = takeToken(clientIp(request), 'speak', SPEAK_LIMIT);
  if (!limit.ok) return fail('RATE_LIMITED', `too many requests; retry in ${limit.retryAfterSeconds}s`, 429);

  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return fail('BAD_REQUEST', 'unreadable body', 400);
  }
  const text = String(body.text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INPUT_CHARS);
  if (!text) return fail('BAD_REQUEST', 'nothing to say', 400);

  let res: Response;
  try {
    res = await fetch(`${env.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.ttsModel, voice: env.ttsVoice, input: text, instructions: INSTRUCTIONS, response_format: 'mp3', speed: 0.96 }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail('UPSTREAM', 'the speech service did not answer', 502);
  }
  if (!res.ok || !res.body) return fail('UPSTREAM', `speech ${res.status}`, 502);

  // streamed through as it arrives; a reply repeats often enough that the browser may keep it for an hour
  return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=3600' } });
}
