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

/**
 * The model-backed voice tier: hearing through a transcription model, speaking through a
 * speech model. Its key is `OPENAI_API_KEY` (reserved for voice since Stage 2), falling back
 * to the concierge key when the concierge base is OpenAI's, so one credential can switch
 * both on. Absent is the shipped state; the browser's own speech is the fallback tier.
 */
export interface VoiceEnv {
  apiKey: string | null;
  baseUrl: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
}

export function voiceEnv(): VoiceEnv {
  const concierge = conciergeEnv();
  const openAiBase = /api\.openai\.com/.test(concierge.baseUrl);
  const baseUrl = (process.env.CONCIERGE_VOICE_BASE_URL?.trim() || (openAiBase ? concierge.baseUrl : 'https://api.openai.com/v1')).replace(/\/$/, '');
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || (openAiBase ? concierge.apiKey : null),
    baseUrl,
    sttModel: process.env.CONCIERGE_STT_MODEL?.trim() || 'gpt-4o-transcribe',
    ttsModel: process.env.CONCIERGE_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
    ttsVoice: process.env.CONCIERGE_TTS_VOICE?.trim() || process.env.OPENAI_REALTIME_VOICE?.trim() || 'marin',
  };
}

export const voiceIsConfigured = () => Boolean(voiceEnv().apiKey);
