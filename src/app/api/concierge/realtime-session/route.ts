import { realtimeEnv } from '@/server/concierge/realtimeEnv';
import { getRepository } from '@/data/repository';
import type { PieceRow } from '@/lib/facets';
import { clientIp, sameOrigin, takeToken, type Limit } from '@/server/concierge/limits';
import {
  REALTIME_VOICES,
  TRANSCRIPTION_PROMPT,
  realtimeTools,
  type RealtimeVoice,
  type VoiceContextInput,
  withVoiceContext,
} from '@/concierge/voice/realtimePrompt';

/**
 * Creates one server-configured Realtime WebRTC call after an explicit voice activation.
 * The browser receives only the SDP answer; the permanent OpenAI credential never leaves
 * this route, and the function list cannot be supplied by the browser.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_LIMIT: Limit = { perMinute: 4, perHour: 24 };
const UPSTREAM_TIMEOUT_MS = 15_000;
const VOICE_SET = new Set<string>(REALTIME_VOICES);
const ROUTE = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+){0,2})?$/;
const LANGUAGE = new Set(['en', 'ur', 'ur-Latn', 'pa-Latn', 'pa-Arab', 'pa-Guru', 'mixed']);

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Resolve all catalogue wording server-side; a request body may carry only route and real slugs. */
async function sanitiseContext(raw: unknown): Promise<VoiceContextInput> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = await getRepository().rows();
  const bySlug = new Map(rows.map((row) => [row.s, row]));
  const published = (row: PieceRow) =>
    [row.k, row.w !== undefined ? `${row.w.toFixed(3)} g` : undefined, row.ct !== undefined ? `${row.ct} ct` : undefined, row.rf]
      .filter(Boolean)
      .join(', ') || (row.p > 0 ? `Rs. ${new Intl.NumberFormat('en-US').format(row.p)}` : 'price on request');
  const factsOf = (slug: string) => {
    const row = bySlug.get(slug);
    return row ? { name: row.t, facts: published(row) } : null;
  };

  const rawPiece = source.pieceInView && typeof source.pieceInView === 'object' ? (source.pieceInView as Record<string, unknown>) : null;
  const pieceSlug = rawPiece ? str(rawPiece.slug, 120) : '';
  const piece = pieceSlug ? factsOf(pieceSlug) : null;
  const recent = (Array.isArray(source.recent) ? source.recent.slice(0, 6) : [])
    .map((entry) => (entry && typeof entry === 'object' ? str((entry as Record<string, unknown>).slug, 120) : ''))
    .filter(Boolean)
    .map((slug, index) => ({ slug, ordinal: index + 1, resolved: factsOf(slug) }))
    .filter((entry) => entry.resolved)
    .map((entry) => ({ ordinal: entry.ordinal, slug: entry.slug, name: entry.resolved!.name, facts: entry.resolved!.facts }));
  const route = str(source.route, 120);
  const language = str(source.language, 12);
  const frames = typeof source.frames === 'number' && Number.isFinite(source.frames) ? Math.max(0, Math.min(12, Math.round(source.frames))) : undefined;

  return {
    route: ROUTE.test(route) ? route : '/',
    pieceInView: piece ? { slug: pieceSlug, ...piece } : null,
    recent,
    standing: str(source.standing, 160),
    language: LANGUAGE.has(language) ? language : undefined,
    frames,
    // A state only: never a name, phone number, email or free-form appointment note.
    appointment: str(source.appointment, 200) || undefined,
    comparison: str(source.comparison, 200) || undefined,
  };
}

function upstreamError(detail: string, status: number) {
  let code = 'UPSTREAM';
  let message = `realtime session ${status}`;
  try {
    const parsed = JSON.parse(detail) as { error?: { code?: string; type?: string; message?: string } };
    const rawCode = parsed.error?.code ?? parsed.error?.type;
    if (rawCode) code = String(rawCode).slice(0, 64);
    if (parsed.error?.message) message = String(parsed.error.message).slice(0, 240);
  } catch {
    /* SDP/plain-text errors have no visitor-safe provider message to parse. */
  }
  return { code, message };
}

export async function POST(request: Request) {
  const env = realtimeEnv();
  const fail = (code: string, message: string, status: number) =>
    Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

  if (!env.enabled || !env.apiKey) return fail('CONCIERGE_VOICE_OFFLINE', 'Realtime voice is not configured', 503);
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);
  const limit = takeToken(clientIp(request), 'realtime-session', SESSION_LIMIT);
  if (!limit.ok) return fail('RATE_LIMITED', `too many sessions; retry in ${limit.retryAfterSeconds}s`, 429);

  let body: { sdp?: unknown; context?: unknown; voice?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail('BAD_REQUEST', 'unreadable body', 400);
  }
  const sdp = typeof body.sdp === 'string' ? body.sdp : '';
  if (!sdp.trim() || sdp.length > 64_000 || !/^v=0/m.test(sdp)) return fail('BAD_REQUEST', 'an SDP offer is required', 400);

  const voice: RealtimeVoice = typeof body.voice === 'string' && VOICE_SET.has(body.voice) ? (body.voice as RealtimeVoice) : env.voice;
  const context = await sanitiseContext(body.context);
  const session = {
    type: 'realtime',
    model: env.model,
    instructions: withVoiceContext(context),
    output_modalities: ['audio'],
    reasoning: { effort: 'low' },
    max_output_tokens: 96,
    tool_choice: 'auto',
    parallel_tool_calls: false,
    tools: realtimeTools(),
    audio: {
      input: {
        transcription: { model: 'gpt-4o-mini-transcribe', prompt: TRANSCRIPTION_PROMPT },
        turn_detection: { type: 'semantic_vad', eagerness: 'auto', create_response: true, interrupt_response: true },
        noise_reduction: { type: 'near_field' },
      },
      output: { voice, speed: 0.95 },
    },
  };

  let response: Response;
  try {
    // The unified WebRTC call endpoint receives the SDP offer plus the server-owned session
    // configuration as multipart form data. Sending JSON is rejected before a Realtime call
    // is created; keep the configuration here so it never enters the browser bundle.
    const form = new FormData();
    form.set('sdp', sdp);
    form.set('session', JSON.stringify(session));
    response = await fetch(`${env.baseUrl}/realtime/calls`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail('UPSTREAM', 'the voice service did not answer', 502);
  }

  const answer = await response.text().catch(() => '');
  if (!response.ok) {
    console.error('[realtime-session] upstream', response.status, answer.slice(0, 900));
    const error = upstreamError(answer, response.status);
    return fail(error.code, error.message, 502);
  }
  // The unified endpoint returns JSON; accept an SDP body as well for compatible local
  // transports, but hand the browser only the negotiated SDP it needs.
  let answerSdp = answer;
  try {
    const parsed = JSON.parse(answer) as { transport?: { sdp?: unknown } };
    if (typeof parsed.transport?.sdp === 'string') answerSdp = parsed.transport.sdp;
  } catch {
    /* Compatibility transport returned SDP directly. */
  }
  if (!/^v=0/m.test(answerSdp)) return fail('UPSTREAM', 'no SDP answer from the voice service', 502);

  return Response.json({ model: env.model, voice, sdp: answerSdp }, { headers: { 'cache-control': 'no-store' } });
}
