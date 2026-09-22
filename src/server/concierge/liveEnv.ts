import 'server-only';

import { conciergeEnv } from '@/server/env';
import { LIVE_MODEL } from '@/concierge/voice/livePrompt';

/**
 * The Live voice and its backend, read where the credential is.
 *
 * One credential switches everything on: `OPENAI_API_KEY` serves the text model (through
 * `conciergeEnv`), the Live session and the delegation model. `CONCIERGE_LIVE=off` keeps the
 * voice dark on a deployment that has the key — the typed concierge stays as it is. Nothing
 * here is `NEXT_PUBLIC_`; the browser learns what it may be from the capabilities route.
 */
export interface LiveEnv {
  apiKey: string | null;
  /** The OpenAI base the Live endpoint hangs off; the Live API is served only there. */
  baseUrl: string;
  model: string;
  enabled: boolean;
  /** The delegation model behind the voice, and its reasoning effort. */
  delegateModel: string;
  delegateEffort: 'low' | 'medium' | 'high';
}

export function liveEnv(): LiveEnv {
  const concierge = conciergeEnv();
  const onOpenAi = /api\.openai\.com/.test(concierge.baseUrl);
  const baseUrl = onOpenAi ? concierge.baseUrl : 'https://api.openai.com/v1';
  // the Live endpoint takes the OpenAI credential alone; a non-OpenAI base never receives it
  const apiKey = process.env.OPENAI_API_KEY?.trim() || (onOpenAi ? concierge.apiKey : null) || null;
  const off = /^(off|0|false)$/i.test(process.env.CONCIERGE_LIVE?.trim() ?? '');
  const effort = process.env.CONCIERGE_DELEGATE_EFFORT?.trim();
  return {
    apiKey,
    baseUrl,
    model: LIVE_MODEL,
    enabled: Boolean(apiKey) && !off,
    delegateModel: process.env.CONCIERGE_DELEGATE_MODEL?.trim() || 'gpt-6-astra',
    delegateEffort: effort === 'medium' || effort === 'high' ? effort : 'low',
  };
}

export const liveIsConfigured = () => liveEnv().enabled;
