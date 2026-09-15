'use client';

import { capabilities } from '../capabilities';
import { ScriptedExampleAdapter, WebSpeechAdapter, recognitionSupported, type VoiceAdapter } from './adapters';
import { ServerTranscriptionAdapter, serverVoiceSupported } from './serverTranscription';

/** Whether this device can hear at all, by any tier the deployment offers. */
export function hearingAvailable(): boolean {
  if (capabilities().voice === 'server' && serverVoiceSupported()) return true;
  return recognitionSupported() && !/Firefox/i.test(navigator.userAgent);
}

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

/**
 * What the realtime engine has to do when it arrives — kept here, at the seam, rather than
 * in a dead provider class. The earlier stub implemented `ConciergeProvider` (text turns),
 * read an environment variable that no longer exists, and was imported by nothing; the seam
 * the code actually built expects a `VoiceAdapter` registered through `registerVoiceEngine`.
 *
 *   1. POST /api/concierge/realtime-token with the site context → an ephemeral token; the
 *      API key is never read in the browser.
 *   2. new RTCPeerConnection(); getUserMedia({ audio: true }); addTrack.
 *   3. pc.ontrack → a detached <audio autoplay>; an AnalyserNode drives voiceMeter.speech.
 *   4. pc.createDataChannel('oai-events'); parse JSON frames; match event types by suffix.
 *   5. POST offer.sdp to the realtime calls endpoint with the token; setRemoteDescription.
 *   6. Text in: conversation.item.create + response.create. Cancel: response.cancel and
 *      output_audio_buffer.clear.
 *   7. function_call_arguments.done → executeTool(name, args) — which validates on its own,
 *      because on this path nothing else will — → function_call_output + response.create.
 *   8. Context changes → a debounced session.update with the rendered site context.
 *   9. Teardown: data channel, mic tracks, peer connection, AudioContext, the meter, <audio>.
 *
 * Identity: `realtime-voice`, voice `native`. The server advertises it through the
 * capabilities probe only when its credential is configured.
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

export function chooseVoiceEngine(opts: { forceScripted?: boolean; preferBrowser?: boolean; language?: string | null; exampleLine: () => string }): EngineChoice {
  if (!opts.forceScripted && capabilities().voice === 'native' && nativeEngine) {
    const adapter = nativeEngine();
    if (adapter.isSupported()) return { adapter, kind: adapter.kind };
  }
  /**
   * The server tier hears every language the concierge answers in, in any browser with a
   * microphone — Firefox included. `preferBrowser` is the controller falling back for one
   * utterance after the server could not hear it.
   */
  if (!opts.forceScripted && !opts.preferBrowser && capabilities().voice === 'server' && serverVoiceSupported()) {
    return { adapter: new ServerTranscriptionAdapter(opts.language ?? null), kind: 'server' };
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
