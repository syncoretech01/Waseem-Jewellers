import 'server-only';

import { conciergeEnv } from '@/server/env';
import { REALTIME_MODEL, REALTIME_VOICE, type RealtimeVoice } from '@/concierge/voice/realtimePrompt';

/** The server-only configuration for the direct WebRTC Realtime session. */
export interface RealtimeEnv {
  apiKey: string | null;
  baseUrl: string;
  model: string;
  voice: RealtimeVoice;
  enabled: boolean;
}

export function realtimeEnv(): RealtimeEnv {
  const concierge = conciergeEnv();
  const onOpenAi = /api\.openai\.com/.test(concierge.baseUrl);
  const baseUrl = onOpenAi ? concierge.baseUrl : 'https://api.openai.com/v1';
  // Realtime is an OpenAI transport. A third-party text base never receives this credential.
  const apiKey = process.env.OPENAI_API_KEY?.trim() || (onOpenAi ? concierge.apiKey : null) || null;
  const explicitlyOff = /^(off|0|false)$/i.test(process.env.CONCIERGE_REALTIME?.trim() ?? process.env.CONCIERGE_LIVE?.trim() ?? '');
  return {
    apiKey,
    baseUrl,
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE,
    enabled: Boolean(apiKey) && !explicitlyOff,
  };
}

export const realtimeIsConfigured = () => realtimeEnv().enabled;
