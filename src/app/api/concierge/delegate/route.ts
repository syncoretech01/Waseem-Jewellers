import { liveEnv } from '@/server/concierge/liveEnv';
import { ground } from '@/server/concierge/retrieve';
import { buildMessages } from '@/server/concierge/prompt';
import { MAX_ROUNDS, hashArgs, open, seal, type ContinuationPayload } from '@/server/concierge/continuation';
import { MAX_INPUT_CHARS, clientIp, sameOrigin, takeToken } from '@/server/concierge/limits';
import { getRepository } from '@/data/repository';
import { runServerTool, runtimeOf } from '@/server/concierge/serverTools';
import { sanitiseContext, sanitiseMemory, sanitiseToolResult } from '@/server/concierge/untrusted';
import { createResponse, toInputItems, type ResponsesItem } from '@/server/concierge/responses';
import { validateToolCall, MAX_TOOL_CALLS } from '@/concierge/tools/validate';
import { enforceBrandRegister, stripBannedPhrases } from '@/concierge/register';
import type { SiteContext, ToolName } from '@/concierge/types';

/**
 * A delegated turn: the reasoning model behind the voice, on the text path's grounding.
 *
 * GPT-Live hands the application the visitor's words; the browser's router sends the ones
 * the deterministic parser cannot resolve here. The loop is the turn route's — stateless,
 * a signed continuation between rounds, server tools run here, browser tools sent down as
 * frames and their real outcomes posted back — and the grounding is the turn route's too:
 * `ground()` chooses at most twelve real pieces, `buildMessages()` writes the persona and
 * the rules, `validateToolCall` is the gate. Only the model and its API differ: a reasoning
 * model over the Responses API, at low effort, on the priority tier when the account is
 * admitted to it.
 *
 * `mode: 'voice'` changes one thing — the model is told its text is not spoken: it returns
 * one English line of facts for the voice model to say in the visitor's language.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_TIMEOUT_MS = 25_000;
const MAX_HISTORY = 8;
const MAX_LINE = 240;

interface DelegateRequest {
  turnId: string;
  text: string;
  context: SiteContext;
  memory?: unknown;
  /** The last few transcript lines of the voice conversation, for "yes", "the other one" and corrections. */
  history?: { role?: string; text?: string }[];
  mode?: 'voice' | 'text';
  continuation?: string;
  toolResults?: { callId: string; name: string; result: unknown }[];
}

type Frame =
  | { type: 'text.done'; text: string }
  | { type: 'tool.call'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'await.tools'; continuation: string }
  | { type: 'turn.trace'; note: string }
  | { type: 'turn.done' }
  | { type: 'turn.error'; message: string; code: string; recoverable: boolean };

const line = (f: Frame) => `${JSON.stringify(f)}\n`;

const VOICE_BACKEND = `## Voice conversation context
You are the backend of a live voice conversation. A voice model speaks with the visitor; you act on the page with the tools and return facts. The visitor's words are a transcript of speech — English, Roman Urdu, Punjabi or a mix — and may contain mistakes, unfinished phrases or a later correction; use the latest words and the page state. Act with the tools the moment the request is clear: never ask for confirmation before a search, a movement on the page or opening a piece. Ordinals ("the second one", "doosra") name the pieces just shown, in order.
Your text reply is NOT spoken to the visitor. It is handed to the voice model as a fact. Return ONE short English line of facts and status: what is now on the page, what was found (the count and the kind), what the appointment form still needs — never a list of pieces, never a weight, purity or price a tool did not return, never a question to the visitor except the one the status needs. If nothing was found, say so and name the nearest alternative (nearby pieces, or the bridal pieces). If the request cannot be understood, return exactly: Not understood; ask once more, briefly.`;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');

export async function POST(request: Request) {
  const env = liveEnv();
  const fail = (code: string, message: string, status = 200) =>
    new Response(line({ type: 'turn.error', message, code, recoverable: true }), { status, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });

  if (!env.apiKey) return fail('CONCIERGE_OFFLINE', 'no model configured');
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);

  let body: DelegateRequest;
  try {
    body = (await request.json()) as DelegateRequest;
  } catch {
    return fail('BAD_REQUEST', 'unreadable body', 400);
  }
  const text = String(body.text ?? '').slice(0, MAX_INPUT_CHARS).trim();
  if (!text || !body.turnId) return fail('BAD_REQUEST', 'nothing to answer', 400);
  const voice = body.mode === 'voice';

  const limit = takeToken(clientIp(request), 'delegate');
  if (!limit.ok) return fail('RATE_LIMITED', `too many requests; retry in ${limit.retryAfterSeconds}s`);

  const repo = getRepository();
  const listable = new Set(await repo.allSlugs());
  const isKnownSlug = (slug: string) => listable.has(slug);

  let items: ResponsesItem[];
  let round = 0;
  let callsSoFar = 0;

  if (body.continuation) {
    const opened = open(body.continuation, body.turnId);
    if (!opened.ok) return fail(opened.reason, 'this turn has expired; ask again');
    round = opened.payload.round;
    callsSoFar = opened.payload.callsSoFar;
    items = opened.payload.messages;
    // a returned result must prove it belongs to a call this turn issued: by id, by name, once
    const pending = new Map(opened.payload.pending.map((p) => [p.callId, p]));
    const answered = new Set<string>();
    for (const r of body.toolResults ?? []) {
      const expected = typeof r?.callId === 'string' ? pending.get(r.callId) : undefined;
      if (!expected || expected.name !== r.name || answered.has(r.callId)) continue;
      answered.add(r.callId);
      items.push({ type: 'function_call_output', call_id: r.callId, output: JSON.stringify(sanitiseToolResult(r.result, { isKnownSlug })).slice(0, 4000) });
    }
    for (const [callId, p] of pending) {
      if (!answered.has(callId)) items.push({ type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'NO_RESULT', tool: p.name }) });
    }
  } else {
    const memory = sanitiseMemory(body.memory, { isKnownSlug });
    const safeContext = sanitiseContext(body.context);
    const current = body.context?.currentProduct?.slug;
    const grounding = await ground(text, {
      currentSlug: typeof current === 'string' && isKnownSlug(current) ? current : null,
      recentSlugs: (body.context?.recentResults ?? []).slice(0, 12).map((r) => r?.slug).filter((x): x is string => typeof x === 'string' && isKnownSlug(x)),
      memory,
    });
    const messages = buildMessages(text, grounding, safeContext, memory.language);
    const system = messages.filter((m) => m.role === 'system');
    const user = messages.filter((m) => m.role === 'user');
    /** The recent spoken exchange, clipped and bounded, between the rules and the sentence. */
    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h?.role === 'concierge' ? ('assistant' as const) : ('user' as const), content: str(h?.text, MAX_LINE) }))
      .filter((h) => h.content);
    items = toInputItems([...system, ...(voice ? [{ role: 'system' as const, content: VOICE_BACKEND }] : []), ...history, ...user]);
  }

  if (round >= MAX_ROUNDS) return fail('ROUNDS', 'that took too many steps; ask again more simply');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (f: Frame) => controller.enqueue(enc.encode(line(f)));
      try {
        const result = await createResponse({ apiKey: env.apiKey!, baseUrl: env.baseUrl, model: env.delegateModel, effort: env.delegateEffort, input: items, maxOutputTokens: voice ? 300 : 360, timeoutMs: UPSTREAM_TIMEOUT_MS });
        if (!result.ok) {
          console.error('[delegate] upstream', result.status, result.detail);
          // the provider's own words travel with the code, so a quota refusal is on the record verbatim
          send({ type: 'turn.error', message: `upstream ${result.status}: ${result.detail.slice(0, 200)}`, code: result.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM', recoverable: true });
          controller.close();
          return;
        }
        const out = result.output;
        send({ type: 'turn.trace', note: `${env.delegateModel} · effort ${env.delegateEffort} · tier ${out.tier ?? 'default'} · round ${round + 1}` });
        const finalText = voice ? stripBannedPhrases(out.text).replace(/\s+/g, ' ').trim().slice(0, 320) : enforceBrandRegister(out.text);
        if (finalText) send({ type: 'text.done', text: finalText });

        items.push(...out.items);
        if (!out.calls.length) {
          send({ type: 'turn.done' });
          controller.close();
          return;
        }

        const accepted: { callId: string; name: ToolName; args: Record<string, unknown> }[] = [];
        for (const call of out.calls) {
          let raw: unknown = {};
          try {
            raw = call.args ? JSON.parse(call.args) : {};
          } catch {
            raw = {};
          }
          const verdict = validateToolCall(call.name, raw, { isKnownSlug, callsSoFar: callsSoFar + accepted.length });
          if (verdict.ok) accepted.push({ callId: call.callId, name: verdict.name, args: verdict.args });
          else items.push({ type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ error: verdict.error.code, message: verdict.error.message }) });
        }
        const serverCalls = accepted.filter((c) => runtimeOf(c.name) === 'server');
        const browserCalls = accepted.filter((c) => runtimeOf(c.name) !== 'server');
        for (const call of serverCalls) {
          const r = await runServerTool(call.name, call.args).catch((err) => ({ error: 'TOOL_FAILED', message: err instanceof Error ? err.message : 'tool failed' }));
          items.push({ type: 'function_call_output', call_id: call.callId, output: JSON.stringify(r).slice(0, 4000) });
        }
        for (const call of browserCalls) send({ type: 'tool.call', callId: call.callId, name: call.name, args: call.args });

        const refusedAll = accepted.length === 0;
        const needsAnotherRound = browserCalls.length > 0 || serverCalls.length > 0 || (refusedAll && !finalText);
        const canContinue = round + 1 < MAX_ROUNDS;
        if (!needsAnotherRound || !canContinue) {
          if (!finalText && accepted.length === 0) send({ type: 'turn.error', code: 'NO_ANSWER', message: 'let me try that a different way', recoverable: true });
          else send({ type: 'turn.done' });
          controller.close();
          return;
        }
        const continuation = seal({
          turnId: body.turnId,
          round: round + 1,
          callsSoFar: Math.min(callsSoFar + accepted.length, MAX_TOOL_CALLS),
          messages: items,
          pending: browserCalls.map((c) => ({ callId: c.callId, name: c.name, argsHash: hashArgs(c.args) })),
          issuedAt: Date.now(),
        } satisfies ContinuationPayload);
        if (continuation) send({ type: 'await.tools', continuation });
        else send({ type: 'turn.done' });
        controller.close();
      } catch (err) {
        send({ type: 'turn.error', message: err instanceof Error ? err.message : 'upstream failed', code: 'UPSTREAM', recoverable: true });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
