import 'server-only';

import { TOOL_DEFS } from '@/concierge/tools/toolDefs';
import type { JsonSchemaProperty, ToolDef } from '@/concierge/types';

/**
 * The written Concierge model, reached through the Responses API.
 *
 * This belongs only to the typed Concierge path. Premium voice never enters this module:
 * it uses direct Realtime function calls. The grounding is the text path's
 * (`retrieve.ts`, `prompt.ts`, `untrusted.ts`, `validate.ts`, `serverTools.ts`); this module
 * only knows the Responses request and its output shape, so nothing about what the model may
 * see or do is decided twice.
 */

export type ResponsesItem = Record<string, unknown>;

export interface ResponsesCall {
  callId: string;
  name: string;
  args: string;
}

export interface ResponsesOutput {
  text: string;
  calls: ResponsesCall[];
  /** The items to carry into the next round: the calls and the message, as the API returned them. */
  items: ResponsesItem[];
  status: string;
  /** Which service tier actually served the request. */
  tier: string | null;
  usage: unknown;
}

function cleanProperty(p: JsonSchemaProperty): Record<string, unknown> {
  // `format: 'piece-slug'` and `default` belong to the validator; a model is not helped by either
  const { format: _format, default: _default, items, ...rest } = p;
  void _format;
  void _default;
  const out: Record<string, unknown> = { ...rest };
  if (items) {
    const { format: _itemFormat, ...itemRest } = items;
    void _itemFormat;
    out.items = itemRest;
  }
  return out;
}

/** The registry in the Responses function-tool shape — every tool, browser and server alike. */
export function responsesTools(defs: readonly ToolDef[] = TOOL_DEFS) {
  return defs.map((t) => ({
    type: 'function' as const,
    name: t.name,
    description: t.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(t.parameters.properties).map(([k, v]) => [k, cleanProperty(v)])),
      ...(t.parameters.required ? { required: t.parameters.required } : {}),
    },
    strict: false,
  }));
}

/** Chat-shaped messages, as `buildMessages` writes them, become Responses input items. */
export function toInputItems(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): ResponsesItem[] {
  return messages.map((m) =>
    m.role === 'assistant'
      ? { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: m.content }] }
      : { type: 'message', role: m.role === 'system' ? 'developer' : 'user', content: [{ type: 'input_text', text: m.content }] },
  );
}

export interface ResponsesRequest {
  apiKey: string;
  baseUrl: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
  input: ResponsesItem[];
  maxOutputTokens: number;
  timeoutMs: number;
}

const looksLikeTierRefusal = (status: number, detail: string) => status >= 400 && status < 500 && /service_tier|priority|fast mode|fast_tier/i.test(detail);

/**
 * One Responses call. Priority service first, because a visitor is waiting mid-sentence; if
 * the account is not admitted to it the request is repeated on the default tier and the
 * answer says which served it.
 */
export async function createResponse(req: ResponsesRequest): Promise<{ ok: true; output: ResponsesOutput } | { ok: false; status: number; detail: string }> {
  const body = (tier: 'priority' | 'default') => ({
    model: req.model,
    input: req.input,
    tools: responsesTools(),
    tool_choice: 'auto',
    parallel_tool_calls: true,
    reasoning: { effort: req.effort },
    text: { verbosity: 'low' },
    max_output_tokens: req.maxOutputTokens,
    service_tier: tier,
    store: false,
  });
  let res: Response;
  let tier: 'priority' | 'default' = 'priority';
  try {
    res = await fetch(`${req.baseUrl}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
      body: JSON.stringify(body(tier)),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      if (!looksLikeTierRefusal(res.status, detail)) return { ok: false, status: res.status, detail: detail.slice(0, 600) };
      tier = 'default';
      res = await fetch(`${req.baseUrl}/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
        body: JSON.stringify(body(tier)),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 600) };
    }
  } catch (err) {
    return { ok: false, status: 0, detail: err instanceof Error ? err.message : 'fetch failed' };
  }
  const json = (await res.json().catch(() => null)) as { output?: unknown[]; status?: string; service_tier?: string; usage?: unknown; error?: { message?: string } } | null;
  if (!json) return { ok: false, status: res.status, detail: 'unreadable response' };
  if (json.error?.message) return { ok: false, status: res.status, detail: String(json.error.message).slice(0, 600) };
  return { ok: true, output: readOutput(json, tier) };
}

function readOutput(json: { output?: unknown[]; status?: string; service_tier?: string; usage?: unknown }, requestedTier: string): ResponsesOutput {
  const calls: ResponsesCall[] = [];
  const items: ResponsesItem[] = [];
  let text = '';
  for (const raw of json.output ?? []) {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (item.type === 'function_call') {
      const callId = String(item.call_id ?? '');
      const name = String(item.name ?? '');
      const args = typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {});
      if (callId && name) {
        calls.push({ callId, name, args });
        items.push({ type: 'function_call', call_id: callId, name, arguments: args });
      }
    } else if (item.type === 'message') {
      const content = Array.isArray(item.content) ? (item.content as Record<string, unknown>[]) : [];
      const part = content
        .filter((c) => c.type === 'output_text' && typeof c.text === 'string')
        .map((c) => String(c.text))
        .join(' ');
      if (part) {
        text = text ? `${text} ${part}` : part;
        items.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: part }] });
      }
    }
    // reasoning items are not carried: the next round reasons afresh at low effort, and nothing is stored
  }
  return { text, calls, items, status: String(json.status ?? ''), tier: typeof json.service_tier === 'string' ? json.service_tier : requestedTier, usage: json.usage ?? null };
}
