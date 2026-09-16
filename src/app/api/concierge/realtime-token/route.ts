import { realtimeEnv } from '@/server/env';
import { clientIp, sameOrigin, takeToken, type Limit } from '@/server/concierge/limits';
import { REALTIME_VOICES, TRANSCRIPTION_PROMPT, VOICE_INSTRUCTIONS, realtimeTools, renderVoiceContext, withContext, type VoiceContextInput } from '@/concierge/voice/realtimePrompt';

/**
 * A short-lived key for one realtime conversation.
 *
 * The permanent credential never leaves this route. What the browser receives is a client
 * secret good for ten minutes and one WebRTC handshake, with the whole session — the model,
 * the voice, the transcription, the tools, the instructions — already decided here. The
 * browser can refresh the site-context block through `session.update`; it cannot change the
 * voice, the model or the tools, because those are baked into the secret.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_LIMIT: Limit = { perMinute: 6, perHour: 40 };
const UPSTREAM_TIMEOUT_MS = 12_000;
/** Ten minutes is only the window for the handshake; the call itself outlives it. */
const SECRET_SECONDS = 600;

const VOICE_SET = new Set<string>(REALTIME_VOICES);

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').slice(0, max) : '');

/** Only the shapes the browser is allowed to describe; a slug it invents costs it nothing here because the tools validate. */
function sanitiseContext(raw: unknown): VoiceContextInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const piece = r.pieceInView && typeof r.pieceInView === 'object' ? (r.pieceInView as Record<string, unknown>) : null;
  const recent = Array.isArray(r.recent) ? r.recent.slice(0, 6) : [];
  return {
    route: str(r.route, 120) || '/',
    pieceInView: piece && str(piece.slug, 120) ? { slug: str(piece.slug, 120), name: str(piece.name, 120), facts: str(piece.facts, 160) } : null,
    recent: recent
      .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
      .map((x, i) => ({ ordinal: i + 1, slug: str(x.slug, 120), name: str(x.name, 120), facts: str(x.facts, 160) }))
      .filter((x) => x.slug && x.name),
    wishlistCount: Math.max(0, Math.min(40, Number(r.wishlistCount) || 0)),
    standing: str(r.standing, 160),
  };
}

export async function POST(request: Request) {
  const env = realtimeEnv();
  const fail = (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

  if (!env.enabled || !env.apiKey) return fail('CONCIERGE_VOICE_OFFLINE', 'live voice is not configured', 503);
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);
  const limit = takeToken(clientIp(request), 'realtime', TOKEN_LIMIT);
  if (!limit.ok) return fail('RATE_LIMITED', `too many sessions; retry in ${limit.retryAfterSeconds}s`, 429);

  let body: { context?: unknown; voice?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* an empty body is a fine request */
  }
  /** An audition may ask for another voice from the fixed list; anything else is the configured one. */
  const voice = typeof body.voice === 'string' && VOICE_SET.has(body.voice) ? body.voice : env.voice;
  const instructions = withContext(VOICE_INSTRUCTIONS, renderVoiceContext(sanitiseContext(body.context)));

  const session = {
    type: 'realtime',
    model: env.model,
    instructions,
    output_modalities: ['audio'],
    max_output_tokens: 240,
    tool_choice: 'auto',
    tools: realtimeTools(),
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        transcription: { model: 'gpt-4o-transcribe', prompt: TRANSCRIPTION_PROMPT },
        turn_detection: { type: 'semantic_vad', eagerness: 'auto', create_response: true, interrupt_response: true },
        noise_reduction: { type: 'near_field' },
      },
      output: { voice, speed: 0.95 },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${env.baseUrl}/realtime/client_secrets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: SECRET_SECONDS }, session }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail('UPSTREAM', 'the voice service did not answer', 502);
  }
  if (!res.ok) {
    // the provider's reason stays in the server log; the browser learns only that it failed
    const detail = await res.text().catch(() => '');
    console.error('[realtime-token] upstream', res.status, detail.slice(0, 300));
    return fail('UPSTREAM', `voice session ${res.status}`, 502);
  }
  const data = (await res.json()) as { value?: string; expires_at?: number };
  if (!data.value) return fail('UPSTREAM', 'no client secret', 502);

  return Response.json(
    {
      token: data.value,
      expiresAt: data.expires_at ?? null,
      model: env.model,
      voice,
      /** The base instructions, so the browser can refresh the context block behind them. */
      instructions: VOICE_INSTRUCTIONS,
      callsUrl: `${env.baseUrl}/realtime/calls`,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
