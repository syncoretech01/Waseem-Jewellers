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

/**
 * One credential switches everything on.
 *
 * `OPENAI_API_KEY` is the credential this project is actually given; `CONCIERGE_API_KEY` exists
 * for a deployment that routes the text model through another provider or base. When the base
 * is OpenAI's, the OpenAI key serves the text path too, so the same secret is never stored
 * twice. A non-OpenAI base never receives the OpenAI key.
 */
export function conciergeEnv(): ConciergeEnv {
  const baseUrl = (process.env.CONCIERGE_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
  const openAiBase = /api\.openai\.com/.test(baseUrl);
  const apiKey = process.env.CONCIERGE_API_KEY?.trim() || (openAiBase ? process.env.OPENAI_API_KEY?.trim() : null) || null;
  return {
    apiKey,
    /** A current, low-latency tool-caller; the turn route sends the parameters its family accepts. */
    model: process.env.CONCIERGE_MODEL?.trim() || 'gpt-5.6-terra',
    baseUrl,
    // falls back to the key so a deployment that sets one variable still gets signed
    // continuations; without either there is no model path to protect
    secret: process.env.CONCIERGE_SIGNING_SECRET?.trim() || apiKey,
  };
}

export const modelIsConfigured = () => Boolean(conciergeEnv().apiKey);
