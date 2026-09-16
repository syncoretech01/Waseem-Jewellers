'use client';

import { capabilities } from '../capabilities';
import { ScriptedExampleAdapter, WebSpeechAdapter, recognitionSupported, type VoiceAdapter } from './adapters';
import { ServerTranscriptionAdapter, serverVoiceSupported } from './serverTranscription';

/** Whether this device can hear at all, by any tier the deployment offers. */
export function hearingAvailable(): boolean {
  const voice = capabilities().voice;
  if (voice === 'native' && nativeEngine && nativeEngine().isSupported()) return true;
  if ((voice === 'native' || voice === 'server') && serverVoiceSupported()) return true;
  return recognitionSupported() && !/Firefox/i.test(navigator.userAgent);
}

/**
 * Which engine listens — decided in one place, by the same probe that selects the text model.
 *
 * Three tiers, top down:
 *
 *   native   the realtime model: hearing, understanding and speaking are one system. The
 *            client-demo voice. Advertised as `voice: 'native'` when the credential is set.
 *   server   a transcription model and a speech model around the text concierge. Hears every
 *            language the concierge answers in, in any browser with a microphone. The
 *            fallback for a realtime session that could not be opened, and the tier a
 *            deployment gets with `CONCIERGE_REALTIME=off`.
 *   browser  `SpeechRecognition`. Never handles Pakistani Punjabi (no browser offers `pa-PK`)
 *            and handles code-switched Urdu badly. What ships with no credential at all.
 *
 * `tier` lets the controller step down one rung for the visitor in front of it — a realtime
 * session that failed to open falls to the server tier, a server utterance that failed
 * falls to the browser — without the probe's answer changing for anyone else.
 */
type EngineFactory = () => VoiceAdapter;

let nativeEngine: EngineFactory | null = null;

/** Called by the realtime voice module when it loads. Absent until it exists. */
export function registerVoiceEngine(factory: EngineFactory) {
  nativeEngine = factory;
}

export type VoiceTier = 'auto' | 'server' | 'browser' | 'scripted';

export interface EngineChoice {
  adapter: VoiceAdapter;
  kind: VoiceAdapter['kind'];
}

export function chooseVoiceEngine(opts: { tier?: VoiceTier; language?: string | null; exampleLine: () => string }): EngineChoice {
  const tier = opts.tier ?? 'auto';
  const voice = capabilities().voice;
  if (tier === 'auto' && voice === 'native' && nativeEngine) {
    const adapter = nativeEngine();
    if (adapter.isSupported()) return { adapter, kind: adapter.kind };
  }
  if ((tier === 'auto' || tier === 'server') && (voice === 'native' || voice === 'server') && serverVoiceSupported()) {
    return { adapter: new ServerTranscriptionAdapter(opts.language ?? null), kind: 'server' };
  }
  /**
   * Firefox reports `SpeechRecognition` and then never returns a result — a supported API that
   * does not work is worse than an absent one, because the visitor waits for it.
   */
  if (tier !== 'scripted' && recognitionSupported() && !/Firefox/i.test(navigator.userAgent)) {
    return { adapter: new WebSpeechAdapter(), kind: 'webspeech' };
  }
  return { adapter: new ScriptedExampleAdapter(opts.exampleLine), kind: 'scripted' };
}
