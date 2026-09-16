import { voiceEnv } from '@/server/env';
import { clientIp, sameOrigin, takeToken, MAX_INPUT_CHARS, type Limit } from '@/server/concierge/limits';
import { REALTIME_VOICES } from '@/concierge/voice/realtimePrompt';

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
  'You are a highly trained private jewellery associate in a quiet showroom in Lahore, speaking with one client. Feminine, refined, warm, composed and confident. Speak a little more slowly and deliberately than an assistant would, with brief calm pauses; restrained warmth, never cheerful, never salesy, never like a call centre or an assistant app. Precise diction: piece names, numbers, weights and rupee amounts clearly. Pronounce Urdu, Roman Urdu and Punjabi words as a native speaker of Lahore would, and English with a soft South Asian English cadence.';
/** A visitor's voice, for the harness that speaks the test prompts into the microphone. */
const VISITOR_INSTRUCTIONS = 'You are a Pakistani customer from Lahore speaking naturally to a shop assistant, at a normal conversational pace, in your own accent. Pronounce Urdu, Roman Urdu and Punjabi as a native speaker would, mixing in English words the way people in Lahore do.';
const VOICE_SET = new Set<string>([...REALTIME_VOICES, 'nova', 'onyx', 'fable']);

export async function POST(request: Request) {
  const env = voiceEnv();
  const fail = (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

  if (!env.apiKey) return fail('CONCIERGE_VOICE_OFFLINE', 'no voice configured', 503);
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);
  const limit = takeToken(clientIp(request), 'speak', SPEAK_LIMIT);
  if (!limit.ok) return fail('RATE_LIMITED', `too many requests; retry in ${limit.retryAfterSeconds}s`, 429);

  let body: { text?: unknown; voice?: unknown; style?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; voice?: unknown; style?: unknown };
  } catch {
    return fail('BAD_REQUEST', 'unreadable body', 400);
  }
  // an audition may name another voice from the fixed list; the harness may ask for a visitor's voice
  const voice = typeof body.voice === 'string' && VOICE_SET.has(body.voice) ? body.voice : env.ttsVoice;
  const visitor = body.style === 'visitor';
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
      body: JSON.stringify({ model: env.ttsModel, voice, input: text, instructions: visitor ? VISITOR_INSTRUCTIONS : INSTRUCTIONS, response_format: 'mp3', speed: visitor ? 1 : 0.94 }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail('UPSTREAM', 'the speech service did not answer', 502);
  }
  if (!res.ok || !res.body) return fail('UPSTREAM', `speech ${res.status}`, 502);

  // streamed through as it arrives; a reply repeats often enough that the browser may keep it for an hour
  return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=3600' } });
}
