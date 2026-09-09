'use client';

import { FallbackProvider } from './providers/FallbackProvider';
import type { ConciergeProvider } from './types';

/**
 * One provider, always.
 *
 * There is no selection to make here any more. `FallbackProvider` tries the server-mediated
 * model and falls back to the keyless engine on any recoverable failure — including the
 * ordinary case of no key being configured, which is what every deployment does until Waseem
 * supplies one. Turning the model on is a server variable and a redeploy of the *same* build;
 * the bundle this file is in does not change.
 *
 * `NEXT_PUBLIC_CONCIERGE_PROVIDER` used to live here. It could not do the job: a
 * `NEXT_PUBLIC_` variable is inlined at build time, so it would have required a rebuild to
 * flip — and it would have put a deployment detail in the browser for no gain.
 */
export function createProvider(): ConciergeProvider {
  return new FallbackProvider();
}
