'use client';

import { capabilities } from '../capabilities';
import { ScriptedExampleAdapter, WebSpeechAdapter, recognitionSupported, type VoiceAdapter } from './adapters';

/**
 * Which engine listens — decided in one place, by the same probe that selects the text model.
 *
 * Browser `SpeechRecognition` is the **fallback tier**, not the target. It will never handle
 * Pakistani Punjabi, because no browser offers `pa-PK` at all, and it handles code-switched
 * Urdu badly for the same reason three separate APIs cannot agree about one sentence. The
 * production target is a realtime model where hearing, understanding and speaking are one
 * multilingual system.
 *
 * That engine is sequenced last and is droppable, so what is built now is the seam it plugs
 * into rather than a stub pretending to be it. When it lands it calls `registerVoiceEngine`
 * and the server begins advertising `voice: 'native'`; nothing in `VoiceStage`, the nine
 * states, the language control or the meter changes, because none of them knows which engine
 * it is talking to. If the engine is advertised but has not registered — an older bundle
 * against a newer deployment — selection falls through to the browser rather than failing.
 */

type EngineFactory = () => VoiceAdapter;

let nativeEngine: EngineFactory | null = null;

/** Called by the realtime voice module when it loads. Absent until it exists. */
export function registerVoiceEngine(factory: EngineFactory) {
  nativeEngine = factory;
}

export interface EngineChoice {
  adapter: VoiceAdapter;
  kind: VoiceAdapter['kind'];
}

export function chooseVoiceEngine(opts: { forceScripted?: boolean; exampleLine: () => string }): EngineChoice {
  if (!opts.forceScripted && capabilities().voice === 'native' && nativeEngine) {
    const adapter = nativeEngine();
    if (adapter.isSupported()) return { adapter, kind: adapter.kind };
  }
  /**
   * Firefox reports `SpeechRecognition` and then never returns a result — a supported API that
   * does not work is worse than an absent one, because the visitor waits for it.
   */
  if (!opts.forceScripted && recognitionSupported() && !/Firefox/i.test(navigator.userAgent)) {
    return { adapter: new WebSpeechAdapter(), kind: 'webspeech' };
  }
  return { adapter: new ScriptedExampleAdapter(opts.exampleLine), kind: 'scripted' };
}
