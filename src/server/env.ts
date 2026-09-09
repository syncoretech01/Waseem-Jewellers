import 'server-only';

/**
 * Every secret this project has, read in one place that cannot reach a browser.
 *
 * `import 'server-only'` makes a client import a build error rather than a leak. It is the
 * first of three layers: an ESLint rule forbids `@/server/*` from `src/components`,
 * `src/concierge`, `src/state` and `src/motion`, and `scripts/dev/secret-scan.mjs` greps the
 * built client chunks for the key's actual value before `npm run check` passes.
 *
 * **Nothing here is `NEXT_PUBLIC_`, and that is the point.** A `NEXT_PUBLIC_` variable is
 * inlined into the client bundle at build time, so it could not satisfy the requirement that
 * the model be activated by adding one variable and redeploying the *same* build. The server
 * decides; the client asks it what it is allowed to expect.
 */

export interface ConciergeEnv {
  /** The model is live only when a key is present. Absent is the normal, shipped state. */
  apiKey: string | null;
  model: string;
  baseUrl: string;
  /** Signs the continuation between rounds of one turn. */
  secret: string | null;
}

export function conciergeEnv(): ConciergeEnv {
  return {
    apiKey: process.env.CONCIERGE_API_KEY?.trim() || null,
    model: process.env.CONCIERGE_MODEL?.trim() || 'gpt-4o-mini',
    baseUrl: (process.env.CONCIERGE_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    // falls back to the key so a deployment that sets one variable still gets signed
    // continuations; without either there is no model path to protect
    secret: process.env.CONCIERGE_SIGNING_SECRET?.trim() || process.env.CONCIERGE_API_KEY?.trim() || null,
  };
}

export const modelIsConfigured = () => Boolean(conciergeEnv().apiKey);
