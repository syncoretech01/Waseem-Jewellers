import { conciergeEnv } from '@/server/env';
import { ground } from '@/server/concierge/retrieve';
import { buildMessages } from '@/server/concierge/prompt';
import { MAX_ROUNDS, open, seal, type ContinuationPayload } from '@/server/concierge/continuation';
import { MAX_INPUT_CHARS, clientIp, sameOrigin, takeToken } from '@/server/concierge/limits';
import { getRepository } from '@/data/repository';
import { validateToolCall, MAX_TOOL_CALLS } from '@/concierge/tools/validate';
import { TOOL_DEFS } from '@/concierge/tools/toolDefs';
import { enforceBrandRegister } from '@/concierge/register';
import type { SiteContext } from '@/concierge/types';

/**
 * One turn of the model conversation, streamed as NDJSON.
 *
 * **Stateless by necessity.** A serverless function cannot hold a connection while the
 * browser runs a tool, so the loop is: the server streams until the model wants a tool, emits
 * `await.tools` with a signed continuation, and stops. The client executes the tools — in the
 * browser, where the tools *are* browser actions — and posts the results back with that
 * continuation. Three rounds, four tool calls, and the turn is over whatever the model wants.
 *
 * Each frame maps one-to-one onto a `ProviderEvent`, so the controller cannot tell a model
 * turn from a keyless one by its shape. That is deliberate: it is what lets a failure fall
 * back mid-turn without the UI noticing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Mumbai is roughly 120 ms closer to Lahore than the default. */
export const preferredRegion = ['bom1'];

interface TurnRequest {
  turnId: string;
  text: string;
  context: SiteContext;
  /** Present on rounds after the first. */
  continuation?: string;
  toolResults?: { callId: string; name: string; result: unknown }[];
}

type Frame =
  | { type: 'text.delta'; delta: string }
  | { type: 'text.done'; text: string }
  | { type: 'tool.call'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'await.tools'; continuation: string }
  | { type: 'turn.done' }
  | { type: 'turn.error'; message: string; code: string; recoverable: boolean };

const line = (f: Frame) => `${JSON.stringify(f)}\n`;

export async function POST(request: Request) {
  const env = conciergeEnv();

  // every refusal here is `recoverable`, because the controller answers it by re-running the
  // same sentence through the keyless engine — the visitor never learns it happened
  const fail = (code: string, message: string, status = 200) =>
    new Response(line({ type: 'turn.error', message, code, recoverable: true }), {
      status,
      headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' },
    });

  if (!env.apiKey) return fail('CONCIERGE_OFFLINE', 'no model configured');
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);

  let body: TurnRequest;
  try {
    body = (await request.json()) as TurnRequest;
  } catch {
    return fail('BAD_REQUEST', 'unreadable body', 400);
  }

  const text = String(body.text ?? '').slice(0, MAX_INPUT_CHARS).trim();
  if (!text || !body.turnId) return fail('BAD_REQUEST', 'nothing to answer', 400);

  const limit = takeToken(clientIp(request));
  if (!limit.ok) return fail('RATE_LIMITED', `too many requests; retry in ${limit.retryAfterSeconds}s`);

  // ── the conversation so far, verified rather than trusted ─────────────────
  let messages: ContinuationPayload['messages'];
  let round = 0;
  let callsSoFar = 0;

  if (body.continuation) {
    const opened = open(body.continuation, body.turnId);
    if (!opened.ok) return fail(opened.reason, 'this turn has expired; ask again');
    round = opened.payload.round;
    callsSoFar = opened.payload.callsSoFar;
    messages = opened.payload.messages;
    for (const r of body.toolResults ?? []) {
      messages.push({ role: 'tool', tool_call_id: r.callId, content: JSON.stringify(r.result).slice(0, 4000) });
    }
  } else {
    const grounding = await ground(text, {
      currentSlug: body.context?.currentProduct?.slug ?? null,
      recentSlugs: (body.context?.recentResults ?? []).map((r) => r.slug),
    });
    messages = buildMessages(text, grounding, body.context);
  }

  if (round >= MAX_ROUNDS) return fail('ROUNDS', 'that took too many steps; ask again more simply');

  const repo = getRepository();
  const listable = new Set(await repo.allSlugs());
  const isKnownSlug = (slug: string) => listable.has(slug);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (f: Frame) => controller.enqueue(enc.encode(line(f)));
      let sentText = false;

      try {
        const upstream = await fetch(`${env.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${env.apiKey}` },
          body: JSON.stringify({
            model: env.model,
            messages,
            stream: true,
            max_tokens: 220,
            temperature: 0.4,
            tools: TOOL_DEFS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
          }),
          signal: AbortSignal.timeout(20_000),
        });

        if (!upstream.ok || !upstream.body) {
          send({ type: 'turn.error', message: `upstream ${upstream.status}`, code: 'UPSTREAM', recoverable: !sentText });
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';
        const toolCalls = new Map<number, { id: string; name: string; args: string }>();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const payload = part.replace(/^data:\s*/, '').trim();
            if (!payload || payload === '[DONE]') continue;
            let chunk: {
              choices?: { delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
            };
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              assistantText += delta.content;
              sentText = true;
              send({ type: 'text.delta', delta: delta.content });
            }
            for (const call of delta?.tool_calls ?? []) {
              const existing = toolCalls.get(call.index) ?? { id: '', name: '', args: '' };
              toolCalls.set(call.index, {
                id: call.id ?? existing.id,
                name: call.function?.name ?? existing.name,
                args: existing.args + (call.function?.arguments ?? ''),
              });
            }
          }
        }

        // the register runs on the whole reply, not on fragments: it counts sentences, and a
        // fragment has not finished being one
        const finalText = enforceBrandRegister(assistantText);
        if (finalText) send({ type: 'text.done', text: finalText });

        if (!toolCalls.size) {
          send({ type: 'turn.done' });
          controller.close();
          return;
        }

        /**
         * Every call is validated here, before the browser is ever asked to run it. It is
         * validated again inside `executeTool`, because the browser and the realtime data
         * channel do not pass through this route at all.
         */
        const accepted: { callId: string; name: string; args: Record<string, unknown> }[] = [];
        const rejected: { callId: string; name: string; result: unknown }[] = [];
        for (const [, call] of toolCalls) {
          let raw: unknown = {};
          try {
            raw = call.args ? JSON.parse(call.args) : {};
          } catch {
            raw = {};
          }
          const verdict = validateToolCall(call.name, raw, { isKnownSlug, callsSoFar: callsSoFar + accepted.length });
          if (verdict.ok) accepted.push({ callId: call.id, name: verdict.name, args: verdict.args });
          else rejected.push({ callId: call.id, name: call.name, result: { error: verdict.error.code, message: verdict.error.message } });
        }

        messages.push({
          role: 'assistant',
          content: assistantText,
          tool_calls: [...toolCalls].map(([, c]) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })),
        });
        // a refused call is answered to the model as a tool result, so it can correct itself
        // in the next round rather than repeating the same invention
        for (const r of rejected) messages.push({ role: 'tool', tool_call_id: r.callId, content: JSON.stringify(r.result) });

        if (!accepted.length) {
          send({ type: 'turn.done' });
          controller.close();
          return;
        }

        for (const call of accepted) send({ type: 'tool.call', callId: call.callId, name: call.name, args: call.args });

        const continuation = seal({
          turnId: body.turnId,
          round: round + 1,
          callsSoFar: Math.min(callsSoFar + accepted.length, MAX_TOOL_CALLS),
          messages,
          issuedAt: Date.now(),
        });
        if (continuation) send({ type: 'await.tools', continuation });
        else send({ type: 'turn.done' });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'upstream failed';
        send({ type: 'turn.error', message, code: 'UPSTREAM', recoverable: !sentText });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
