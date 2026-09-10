'use client';

import type { Language } from './nlu/script';

/**
 * What this deployment's concierge is allowed to be — asked once, of the server.
 *
 * The browser cannot work this out for itself, and deliberately so. A `NEXT_PUBLIC_` flag is
 * inlined at build time, so using one would mean a rebuild to switch the model on and would
 * put a deployment detail in every visitor's bundle. The server holds the answer; the client
 * asks when the panel first opens, and never on page load — a visitor who never opens the
 * concierge never pays for the request.
 *
 * The answer is cached for five minutes in `sessionStorage`, so opening and closing the panel
 * does not re-ask, but a deploy that adds a key is picked up without the visitor reloading.
 */

export interface ConciergeCapabilities {
  intelligence: 'model' | 'keyless';
  /** `none` no voice at all · `browser` the fallback tier · `native` a realtime voice model. */
  voice: 'none' | 'browser' | 'native';
  languages: Language[];
}

/** What a deployment is until told otherwise. It is also exactly what ships with no key. */
export const DEFAULT_CAPABILITIES: ConciergeCapabilities = {
  intelligence: 'keyless',
  voice: 'browser',
  languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'],
};

const KEY = 'wj:concierge:capabilities:v1';
const TTL_MS = 5 * 60 * 1000;

let cache: ConciergeCapabilities | null = null;
let inflight: Promise<ConciergeCapabilities> | null = null;

const VOICES = new Set(['none', 'browser', 'native']);

/** Narrowed field by field: this arrives over a network and is not trusted for its shape. */
function parse(raw: unknown): ConciergeCapabilities {
  if (!raw || typeof raw !== 'object') return DEFAULT_CAPABILITIES;
  const r = raw as Record<string, unknown>;
  return {
    intelligence: r.intelligence === 'model' ? 'model' : 'keyless',
    voice: typeof r.voice === 'string' && VOICES.has(r.voice) ? (r.voice as ConciergeCapabilities['voice']) : 'browser',
    languages: Array.isArray(r.languages) ? (r.languages.filter((l): l is Language => typeof l === 'string') as Language[]) : DEFAULT_CAPABILITIES.languages,
  };
}

function fromSession(): ConciergeCapabilities | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw) as { at: number; value: unknown };
    if (!Number.isFinite(at) || Date.now() - at > TTL_MS) return null;
    return parse(value);
  } catch {
    // private mode, a quota, a malformed entry: none of them is worth a broken panel
    return null;
  }
}

/**
 * The last answer, or the default.
 *
 * Synchronous, because the surfaces that read it — which adapter to build, whether to offer
 * the microphone — run inside an interaction and cannot await. `probeCapabilities` is what
 * makes the answer true; this is what reads it.
 */
export const capabilities = (): ConciergeCapabilities => cache ?? fromSession() ?? DEFAULT_CAPABILITIES;

export function probeCapabilities(): Promise<ConciergeCapabilities> {
  const stored = cache ?? fromSession();
  if (stored) {
    cache = stored;
    return Promise.resolve(stored);
  }
  inflight ??= fetch('/api/concierge/capabilities', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`capabilities ${r.status}`))))
    .then((json: unknown) => {
      cache = parse(json);
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), value: cache }));
      } catch {
        /* nothing here is worth failing over */
      }
      return cache;
    })
    .catch(() => {
      // an unanswered probe means the shipped default, not a broken concierge
      inflight = null;
      return DEFAULT_CAPABILITIES;
    });
  return inflight;
}
