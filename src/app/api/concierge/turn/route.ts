import { conciergeEnv } from '@/server/env';
import { ground } from '@/server/concierge/retrieve';
import { buildMessages } from '@/server/concierge/prompt';
import { MAX_ROUNDS, hashArgs, open, seal, type ContinuationPayload } from '@/server/concierge/continuation';
import { MAX_INPUT_CHARS, clientIp, sameOrigin, takeToken } from '@/server/concierge/limits';
import { getRepository } from '@/data/repository';
import { runServerTool, runtimeOf } from '@/server/concierge/serverTools';
import { sanitiseContext, sanitiseMemory, sanitiseToolResult } from '@/server/concierge/untrusted';
import { validateToolCall, MAX_TOOL_CALLS } from '@/concierge/tools/validate';
import { TOOL_DEFS } from '@/concierge/tools/toolDefs';
import { enforceBrandRegister } from '@/concierge/register';
import type { SiteContext, ToolName } from '@/concierge/types';

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
/**
 * The region is no longer declared here — `preferredRegion` is deprecated in this version of
 * Next, and the value was only ever passed through to the platform anyway. The decision itself
 * stands and now lives in `vercel.json`: Mumbai, roughly 120 ms closer to Lahore than the
 * default. Latency matters on this route because it is the one a visitor waits on mid-sentence.
 */

interface TurnRequest {
  turnId: string;
  text: string;
  context: SiteContext;
  /** The bounded slice of conversation memory — re-validated here, never trusted. */
  memory?: unknown;
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

  const repo = getRepository();
  const listable = new Set(await repo.allSlugs());
  const isKnownSlug = (slug: string) => listable.has(slug);

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

    /**
     * A returned result has to prove it belongs to a call this turn actually issued.
     *
     * The signature covers the messages, which are what the *model* said. The results are what
     * the *browser* claims happened, and unbound they would let a client answer a call that
     * was never made, answer one twice, or return a search payload for a save. Each is matched
     * against the pending call by id, by name and by an argument digest; anything unmatched is
     * dropped rather than refused, so a stale retry costs a fact rather than the whole turn.
     */
    const pending = new Map(opened.payload.pending.map((p) => [p.callId, p]));
    const answered = new Set<string>();
    for (const r of body.toolResults ?? []) {
      const expected = typeof r?.callId === 'string' ? pending.get(r.callId) : undefined;
      if (!expected) continue;
      if (expected.name !== r.name) continue;
      if (answered.has(r.callId)) continue;
      answered.add(r.callId);
      const safe = sanitiseToolResult(r.result, { isKnownSlug });
      messages.push({ role: 'tool', tool_call_id: r.callId, content: JSON.stringify(safe).slice(0, 4000) });
    }
    // a call the browser never answered still needs a reply, or the model waits for a message
    // that is not coming
    for (const [callId, p] of pending) {
      if (answered.has(callId)) continue;
      messages.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify({ error: 'NO_RESULT', tool: p.name }) });
    }
  } else {
    /**
     * The standing topic travels with the sentence.
     *
     * Without it the model was handed only the current words and a couple of slugs, so
     * "now bracelets" retrieved every bracelet in the shop while the keyless engine — which
     * carries the topic — correctly retrieved gold ones under fifteen grams. The model was
     * reasoning faithfully about the wrong set, which is worse than not reasoning at all.
     */
    const memory = sanitiseMemory(body.memory, { isKnownSlug });
    const safeContext = sanitiseContext(body.context);
    const current = body.context?.currentProduct?.slug;
    const grounding = await ground(text, {
      // an unknown slug resolves to no anchor rather than to a name the browser chose
      currentSlug: typeof current === 'string' && isKnownSlug(current) ? current : null,
      recentSlugs: (body.context?.recentResults ?? []).slice(0, 12).map((r) => r?.slug).filter((x): x is string => typeof x === 'string' && isKnownSlug(x)),
      memory,
    });
    messages = buildMessages(text, grounding, safeContext, memory.language);
  }

  if (round >= MAX_ROUNDS) return fail('ROUNDS', 'that took too many steps; ask again more simply');

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
            /**
             * A reasoning-family model refuses `temperature` and wants `max_completion_tokens`;
             * it answers a concierge sentence fastest with no reasoning at all. The older
             * families take the sampling parameters they always did.
             */
            ...(/^gpt-[5-9]/.test(env.model) ? { max_completion_tokens: 260, reasoning_effort: 'none', verbosity: 'low' } : { max_tokens: 220, temperature: 0.4 }),
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
         * validated again inside `executeTool`, because the voice's direct rung does not pass
         * through this route at all.
         */
        const accepted: { callId: string; name: ToolName; args: Record<string, unknown> }[] = [];
        const rejected: { callId: string; result: unknown }[] = [];
        for (const [, call] of toolCalls) {
          let raw: unknown = {};
          try {
            raw = call.args ? JSON.parse(call.args) : {};
          } catch {
            raw = {};
          }
          const verdict = validateToolCall(call.name, raw, { isKnownSlug, callsSoFar: callsSoFar + accepted.length });
          if (verdict.ok) accepted.push({ callId: call.id, name: verdict.name, args: verdict.args });
          else rejected.push({ callId: call.id, result: { error: verdict.error.code, message: verdict.error.message } });
        }

        messages.push({
          role: 'assistant',
          content: assistantText,
          tool_calls: [...toolCalls].map(([, c]) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })),
        });
        // a refused call is answered to the model as a tool result, so it can correct itself
        // in the next round rather than repeating the same invention
        for (const r of rejected) messages.push({ role: 'tool', tool_call_id: r.callId, content: JSON.stringify(r.result) });

        /**
         * Reading the catalogue happens here; acting on the page happens in the browser.
         *
         * A tool that only consults the catalogue has no business making a round trip through
         * a client: the answer is already on this side of the wire, the browser cannot compute
         * it any better, and routing it outward turns a fact into something that has to be
         * re-validated on the way back. Tools that *are* browser actions — navigating,
         * scrolling, opening the selection — still run where the page is.
         */
        const serverCalls = accepted.filter((c) => runtimeOf(c.name) === 'server');
        const browserCalls = accepted.filter((c) => runtimeOf(c.name) !== 'server');

        for (const call of serverCalls) {
          const result = await runServerTool(call.name, call.args).catch((err) => ({
            error: 'TOOL_FAILED',
            message: err instanceof Error ? err.message : 'tool failed',
          }));
          messages.push({ role: 'tool', tool_call_id: call.callId, content: JSON.stringify(result).slice(0, 4000) });
        }

        for (const call of browserCalls) send({ type: 'tool.call', callId: call.callId, name: call.name, args: call.args });

        /**
         * Another round happens when there are facts the model has not seen yet — results
         * from a server tool, an action the browser is about to run, or the refusals of
         * calls that were all rejected. That last case is the one that used to end in
         * silence: every call invented a slug, none was accepted, nothing was pending, and
         * a model that had spoken no words closed the turn with no text, no action and no
         * error. Giving it the refusals and one more round is how it corrects itself.
         */
        const needsAnotherRound = browserCalls.length > 0 || serverCalls.length > 0 || (rejected.length > 0 && !sentText);
        // sealing a continuation for a round the next request will refuse turns a finished
        // turn into a ROUNDS error; the last permitted round ends the turn instead
        const canContinue = round + 1 < MAX_ROUNDS;
        if (!needsAnotherRound || !canContinue) {
          /**
           * Out of rounds with nothing said and nothing done. There is no honest sentence
           * to invent here, so the turn fails recoverably and the keyless engine — which
           * has not spoken either — answers it instead.
           */
          if (!sentText && accepted.length === 0) {
            send({ type: 'turn.error', code: 'NO_ANSWER', message: 'let me try that a different way', recoverable: true });
          } else {
            send({ type: 'turn.done' });
          }
          controller.close();
          return;
        }

        const continuation = seal({
          turnId: body.turnId,
          round: round + 1,
          callsSoFar: Math.min(callsSoFar + accepted.length, MAX_TOOL_CALLS),
          messages,
          // only the calls the browser was actually asked to run; a server call is already
          // answered and must not be answerable again from outside
          pending: browserCalls.map((c) => ({ callId: c.callId, name: c.name, argsHash: hashArgs(c.args) })),
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
