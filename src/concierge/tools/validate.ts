import { TOOL_DEFS } from './toolDefs';
import type { JsonSchema, ToolDef, ToolName } from '../types';

/**
 * The single gate on every tool call, whichever engine produced it.
 *
 * This is the security boundary of the whole concierge, and it is deliberately isomorphic:
 * the server runs it before emitting `tool.call`, and `executeTool` runs it again at the top
 * of every execution. That duplication is not redundancy — the browser path and the realtime
 * data channel do not pass through the server at all, so a validator that lived only there
 * would guard nothing on two of the three paths.
 *
 * What it refuses, and why each matters:
 *
 *   an unknown tool name          a model inventing capabilities it does not have
 *   arguments off the schema      a string where a number belongs, an enum value that isn't
 *   **a slug that does not exist**  the important one: a hallucinated or *withheld* piece
 *   a path outside the allowlist  navigation to somewhere that is not this site
 *   the fifth call in a turn      a loop that would walk the visitor through the catalogue
 *
 * The slug check is the reason this file exists. 64 pieces are imported and withheld — they
 * have no page, and `dynamicParams = false` means their URLs 404. A model that recommends
 * one is offering a visitor a door onto nothing, and no amount of prompt instruction can be
 * relied on to prevent it. So the existence check is mechanical, and it consults the same
 * listable set the routes are generated from.
 */

export type ValidationError =
  | { code: 'TOOL_UNKNOWN'; message: string }
  | { code: 'TOOL_ARGS'; message: string }
  | { code: 'TOOL_UNKNOWN_SLUG'; message: string }
  | { code: 'TOOL_PATH'; message: string }
  | { code: 'TOOL_BUDGET'; message: string };

export type Validated =
  | { ok: true; name: ToolName; args: Record<string, unknown> }
  | { ok: false; error: ValidationError };

/** At most four tool calls answer one sentence. Beyond that the visitor is being walked. */
export const MAX_TOOL_CALLS = 4;

/** Every argument that names a piece. */
const SLUG_ARGS = ['slug', 'anchor', 'a', 'b', 'c'] as const;

/**
 * Where the concierge may take a visitor. Departments and kinds are matched by shape rather
 * than enumerated so a new department needs no change here — the route itself still has to
 * exist, and `dynamicParams = false` refuses the rest.
 */
const PATH_ALLOWED = [/^\/$/, /^\/(gold|diamond|bridal|men|kids)(\/[a-z-]+)?(\?[\w=&%.+-]*)?$/, /^\/collections\/[a-z0-9-]+(\?[\w=&%.+-]*)?$/, /^\/jewellery\/[a-z0-9-]+$/];

const byName = new Map<string, ToolDef>(TOOL_DEFS.map((t) => [t.name, t]));

function checkArgs(schema: JsonSchema, args: Record<string, unknown>): string | null {
  for (const key of schema.required ?? []) {
    if (args[key] === undefined) return `missing required argument "${key}"`;
  }
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    const spec = schema.properties[key];
    // an unknown argument is dropped rather than refused: a model adding a field it invented
    // should not cost the visitor their answer
    if (!spec) continue;
    if (spec.type === 'string' && typeof value !== 'string') return `"${key}" must be a string`;
    if ((spec.type === 'integer' || spec.type === 'number') && typeof value !== 'number') return `"${key}" must be a number`;
    if (spec.type === 'boolean' && typeof value !== 'boolean') return `"${key}" must be true or false`;
    if (spec.enum && typeof value === 'string' && !spec.enum.includes(value)) return `"${key}" must be one of ${spec.enum.join(', ')}`;
    if (typeof value === 'number') {
      if (spec.minimum !== undefined && value < spec.minimum) return `"${key}" is below ${spec.minimum}`;
      if (spec.maximum !== undefined && value > spec.maximum) return `"${key}" is above ${spec.maximum}`;
    }
  }
  return null;
}

export interface ValidateOptions {
  /** Slugs a visitor may be sent to — the listable set, never the imported one. */
  isKnownSlug: (slug: string) => boolean;
  /** How many calls this turn has already made. */
  callsSoFar?: number;
}

export function validateToolCall(name: string, rawArgs: unknown, { isKnownSlug, callsSoFar = 0 }: ValidateOptions): Validated {
  if (callsSoFar >= MAX_TOOL_CALLS) {
    return { ok: false, error: { code: 'TOOL_BUDGET', message: `no more than ${MAX_TOOL_CALLS} actions answer one question` } };
  }

  const def = byName.get(name);
  if (!def) return { ok: false, error: { code: 'TOOL_UNKNOWN', message: `there is no tool called "${name}"` } };

  const args: Record<string, unknown> = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? { ...(rawArgs as Record<string, unknown>) } : {};

  const argError = checkArgs(def.parameters, args);
  if (argError) return { ok: false, error: { code: 'TOOL_ARGS', message: argError } };

  // a slug that names no listable piece is refused, not corrected — guessing which piece was
  // meant is how a visitor ends up looking at something nobody chose
  for (const key of SLUG_ARGS) {
    const value = args[key];
    if (typeof value !== 'string') continue;
    if (!isKnownSlug(value)) return { ok: false, error: { code: 'TOOL_UNKNOWN_SLUG', message: `no piece with the reference "${value}"` } };
  }
  if (Array.isArray(args.slugs)) {
    for (const value of args.slugs) {
      if (typeof value !== 'string' || !isKnownSlug(value)) {
        return { ok: false, error: { code: 'TOOL_UNKNOWN_SLUG', message: `no piece with the reference "${String(value)}"` } };
      }
    }
  }

  if (typeof args.path === 'string' && !PATH_ALLOWED.some((re) => re.test(args.path as string))) {
    return { ok: false, error: { code: 'TOOL_PATH', message: `"${args.path}" is not a page of this site` } };
  }

  // clamp rather than refuse: a model asking for forty pieces meant "several"
  if (typeof args.limit === 'number') args.limit = Math.max(1, Math.min(6, Math.round(args.limit)));

  return { ok: true, name: name as ToolName, args };
}
