import { TOOL_DEFS } from './toolDefs';
import type { JsonSchema, JsonSchemaProperty, ToolDef, ToolName } from '../types';

/**
 * The single gate on every tool call, whichever engine produced it.
 *
 * This is the security boundary of the whole concierge, and it is deliberately isomorphic:
 * the server runs it before emitting `tool.call`, and `executeTool` runs it again at the top
 * of every execution. That duplication is not redundancy — the keyless engine and the voice's
 * direct rung do not pass through the server at all, so a validator that lived only there
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

/**
 * Where the concierge may take a visitor. Departments and kinds are matched by shape rather
 * than enumerated so a new department needs no change here — the route itself still has to
 * exist, and `dynamicParams = false` refuses the rest.
 */
const PATH_ALLOWED = [/^\/$/, /^\/(gold|diamond|bridal|men|kids)(\/[a-z-]+)?(\?[\w=&%.+-]*)?$/, /^\/collections\/[a-z0-9-]+(\?[\w=&%.+-]*)?$/, /^\/jewellery\/[a-z0-9-]+$/];

const byName = new Map<string, ToolDef>(TOOL_DEFS.map((t) => [t.name, t]));

function checkValue(key: string, spec: JsonSchemaProperty, value: unknown): string | null {
  if (spec.type === 'array') {
    if (!Array.isArray(value)) return `"${key}" must be a list`;
    if (spec.minItems !== undefined && value.length < spec.minItems) return `"${key}" needs at least ${spec.minItems}`;
    if (spec.maxItems !== undefined && value.length > spec.maxItems) return `"${key}" takes at most ${spec.maxItems}`;
    const item = spec.items;
    if (item) {
      for (const v of value) {
        if (item.type === 'string' && typeof v !== 'string') return `every entry of "${key}" must be a string`;
        if ((item.type === 'integer' || item.type === 'number') && typeof v !== 'number') return `every entry of "${key}" must be a number`;
        if (item.enum && typeof v === 'string' && !item.enum.includes(v)) return `"${key}" may only contain ${item.enum.join(', ')}`;
        if (item.pattern && typeof v === 'string' && !new RegExp(item.pattern).test(v)) return `"${key}" contains a malformed entry`;
      }
    }
    return null;
  }
  if (spec.type === 'string') {
    if (typeof value !== 'string') return `"${key}" must be a string`;
    if (spec.enum && !spec.enum.includes(value)) return `"${key}" must be one of ${spec.enum.join(', ')}`;
    if (spec.pattern && !new RegExp(spec.pattern).test(value)) return `"${key}" is malformed`;
    return null;
  }
  /**
   * A number out of range is a magnitude, not a mistake about what exists — so it is clamped
   * rather than refused. A model asking for forty pieces meant "several", and refusing the
   * call over it would cost the visitor their answer to make a point about a bound. Enum
   * values and patterns are refused instead, because those name things that do not exist.
   */
  if (spec.type === 'integer' || spec.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `"${key}" must be a number`;
    return null;
  }
  if (spec.type === 'boolean' && typeof value !== 'boolean') return `"${key}" must be true or false`;
  return null;
}

/**
 * Brings a validated value inside the bounds its own schema declares.
 *
 * The bound travels with the argument rather than living here as a constant: `deepSearch`
 * permits twelve results and the tray tools permit six, and a single hard-coded clamp quietly
 * gave the wider tool the narrower limit.
 */
function coerce(spec: JsonSchemaProperty, value: unknown): unknown {
  if (spec.type === 'array') return [...(value as unknown[])];
  if ((spec.type === 'integer' || spec.type === 'number') && typeof value === 'number') {
    let n = spec.type === 'integer' ? Math.round(value) : value;
    if (spec.minimum !== undefined) n = Math.max(spec.minimum, n);
    if (spec.maximum !== undefined) n = Math.min(spec.maximum, n);
    return n;
  }
  return value;
}

/**
 * Validates and **rebuilds** the arguments.
 *
 * The distinction matters: the previous version said it dropped undeclared arguments and then
 * returned the caller's object untouched, so anything a model invented travelled straight
 * through to `executeTool`. Nothing is copied across here unless the schema declares it, so
 * the object a tool receives can only contain fields the registry knows about.
 *
 * An undeclared argument is still not an *error* — a model adding a field it imagined should
 * not cost the visitor their answer. It simply does not exist downstream.
 */
function sanitiseArgs(schema: JsonSchema, raw: Record<string, unknown>): { error: string } | { args: Record<string, unknown> } {
  for (const key of schema.required ?? []) {
    if (raw[key] === undefined) return { error: `missing required argument "${key}"` };
  }
  const args: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema.properties)) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const error = checkValue(key, spec, value);
    if (error) return { error };
    args[key] = coerce(spec, value);
  }
  return { args };
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

  const raw: Record<string, unknown> = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};

  const sanitised = sanitiseArgs(def.parameters, raw);
  if ('error' in sanitised) return { ok: false, error: { code: 'TOOL_ARGS', message: sanitised.error } };
  const args = sanitised.args;

  /**
   * A slug that names no listable piece is refused, not corrected — guessing which piece
   * was meant is how a visitor ends up looking at something nobody chose.
   *
   * Which arguments name a piece comes from the schema, not from their spelling. A
   * collection slug is checked against its own enum by `checkValue` and is deliberately not
   * looked up here: "bridal" is a real destination and never a piece.
   */
  for (const [key, spec] of Object.entries(def.parameters.properties)) {
    const value = args[key];
    if (value === undefined) continue;
    if (spec.format === 'piece-slug' && typeof value === 'string' && !isKnownSlug(value)) {
      return { ok: false, error: { code: 'TOOL_UNKNOWN_SLUG', message: `no piece with the reference "${value}"` } };
    }
    if (spec.type === 'array' && spec.items?.format === 'piece-slug' && Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry !== 'string' || !isKnownSlug(entry)) {
          return { ok: false, error: { code: 'TOOL_UNKNOWN_SLUG', message: `no piece with the reference "${String(entry)}"` } };
        }
      }
    }
  }

  if (typeof args.path === 'string' && !PATH_ALLOWED.some((re) => re.test(args.path as string))) {
    return { ok: false, error: { code: 'TOOL_PATH', message: `"${args.path}" is not a page of this site` } };
  }

  return { ok: true, name: name as ToolName, args };
}
