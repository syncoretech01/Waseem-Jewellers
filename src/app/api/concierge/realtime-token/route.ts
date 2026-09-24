import { realtimeEnv } from '@/server/env';
import { getRepository } from '@/data/repository';
import type { PieceRow } from '@/lib/facets';
import { clientIp, sameOrigin, takeToken, type Limit } from '@/server/concierge/limits';
import { REALTIME_VOICES, TRANSCRIPTION_KEYWORDS, TRANSCRIPTION_PROMPT, VOICE_INSTRUCTIONS, realtimeTools, renderVoiceContext, withContext, type VoiceContextInput } from '@/concierge/voice/realtimePrompt';

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

/** Sessions, not sentences: a conversation reconnects only after four minutes of silence or a closed panel. */
const TOKEN_LIMIT: Limit = { perMinute: 4, perHour: 24 };
const UPSTREAM_TIMEOUT_MS = 12_000;
/** The window for the handshake, which takes about two seconds; the call itself outlives it. A shorter secret is a smaller thing to lose. */
const SECRET_SECONDS = 120;

const VOICE_SET = new Set<string>(REALTIME_VOICES);

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').slice(0, max) : '');

/**
 * Only slugs are believed. The browser names the pieces it is looking at; their names and
 * published facts come from the repository here, exactly as the text path does it — a
 * visitor's request body cannot put words into the session's instructions beyond a route
 * shape and the standing request, which is theirs anyway.
 */
const ROUTE = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+){0,2})?$/;
async function sanitiseContext(raw: unknown): Promise<VoiceContextInput> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rows = await getRepository().rows();
  const bySlug = new Map(rows.map((row) => [row.s, row]));
  // the published facts, in the order a jeweller would say them — the same line the browser shows
  const published = (r: PieceRow) => [r.k, r.w !== undefined ? `${r.w.toFixed(3)} g` : undefined, r.ct !== undefined ? `${r.ct} ct` : undefined, r.rf].filter(Boolean).join(', ') || (r.p > 0 ? `Rs. ${new Intl.NumberFormat('en-US').format(r.p)}` : 'price on request');
  const factsOf = (slug: string) => {
    const row = bySlug.get(slug);
    return row ? { name: row.t, facts: published(row) } : null;
  };
  const piece = r.pieceInView && typeof r.pieceInView === 'object' ? (r.pieceInView as Record<string, unknown>) : null;
  const pieceSlug = piece ? str(piece.slug, 120) : '';
  const known = pieceSlug ? factsOf(pieceSlug) : null;
  const recent = (Array.isArray(r.recent) ? r.recent.slice(0, 6) : [])
    .map((x) => (x && typeof x === 'object' ? str((x as Record<string, unknown>).slug, 120) : ''))
    .filter(Boolean)
    .map((slug, i) => ({ slug, resolved: factsOf(slug), ordinal: i + 1 }))
    .filter((x) => x.resolved)
    .map((x) => ({ ordinal: x.ordinal, slug: x.slug, name: x.resolved!.name, facts: x.resolved!.facts }));
  const route = str(r.route, 120);
  return {
    route: ROUTE.test(route) ? route : '/',
    pieceInView: known ? { slug: pieceSlug, ...known } : null,
    recent,
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
  const instructions = withContext(VOICE_INSTRUCTIONS, renderVoiceContext(await sanitiseContext(body.context)));

  /**
   * What the visitor's words are written down with. The live transcription model takes the
   * vocabulary as keywords and the three languages as hints; the older model takes a prompt.
   * If the provider refuses the first shape the second is tried, so a model rename on their
   * side degrades the transcript rather than the conversation.
   */
  const transcriptions: Record<string, unknown>[] = [
    env.sttModel.startsWith('gpt-live-transcribe') || env.sttModel.startsWith('gpt-transcribe')
      ? { model: env.sttModel, prompt: TRANSCRIPTION_PROMPT, keywords: TRANSCRIPTION_KEYWORDS, languages: ['en', 'ur'], delay: 'low' }
      : { model: env.sttModel, prompt: TRANSCRIPTION_PROMPT },
    { model: 'gpt-4o-transcribe', prompt: TRANSCRIPTION_PROMPT },
  ];
  const sessionWith = (transcription: Record<string, unknown>) => ({
    type: 'realtime',
    model: env.model,
    instructions,
    output_modalities: ['audio'],
    // Concise, grounded replies with room for a complete product explanation when asked.
    max_output_tokens: 192,
    reasoning: { effort: 'low' },
    tool_choice: 'auto',
    tools: realtimeTools(),
    parallel_tool_calls: false,
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        transcription,
        turn_detection: { type: 'semantic_vad', eagerness: 'auto', create_response: true, interrupt_response: true },
        noise_reduction: { type: 'near_field' },
      },
      output: { voice, speed: 0.95 },
    },
  });

  let res: Response | null = null;
  let transcription = transcriptions[0]!;
  for (const candidate of transcriptions) {
    transcription = candidate;
    try {
      res = await fetch(`${env.baseUrl}/realtime/client_secrets`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: SECRET_SECONDS }, session: sessionWith(candidate) }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch {
      return fail('UPSTREAM', 'the voice service did not answer', 502);
    }
    if (res.ok) break;
    // the provider's reason stays in the server log; the browser learns only that it failed
    const detail = await res.text().catch(() => '');
    console.error('[realtime-token] upstream', res.status, String(candidate.model), detail.slice(0, 900));
    if (res.status !== 400) break;
  }
  if (!res || !res.ok) return fail('UPSTREAM', `voice session ${res?.status ?? 0}`, 502);
  const data = (await res.json()) as { value?: string; expires_at?: number };
  if (!data.value) return fail('UPSTREAM', 'no client secret', 502);

  return Response.json(
    {
      token: data.value,
      expiresAt: data.expires_at ?? null,
      model: env.model,
      voice,
      transcription: String(transcription.model),
      /** The base instructions, so the browser can refresh the context block behind them. */
      instructions: VOICE_INSTRUCTIONS,
      callsUrl: `${env.baseUrl}/realtime/calls`,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
