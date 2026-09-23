'use client';

import { capabilities } from '../capabilities';
import { ScriptedExampleAdapter, type VoiceAdapter } from './adapters';

/**
 * Which engine hears — decided in one place, by the same probe that selects the text model.
 *
 * One tier. The direct Realtime session is the voice when the deployment advertises it (`voice:
 * 'native'`) and the browser can carry a WebRTC call; otherwise there is no voice, the stage
 * is not offered, and the composer is the door. There is no rung beneath the session: a
 * session that cannot open is said so once, and the written concierge answers.
 *
 * "Let me show you" is not a tier — it types an example line, and it is what the composer
 * offers where no microphone can be.
 */
type EngineFactory = () => VoiceAdapter;

let liveEngine: EngineFactory | null = null;

/** Called by the Realtime voice module when it loads. Absent until it exists. */
export function registerVoiceEngine(factory: EngineFactory) {
  liveEngine = factory;
}

/** Whether this device can hear at all: the deployment offers Realtime voice and the browser can carry it. */
export function hearingAvailable(): boolean {
  return capabilities().voice === 'native' && Boolean(liveEngine) && liveEngine!().isSupported();
}

export type VoiceTier = 'auto' | 'scripted';

export interface EngineChoice {
  adapter: VoiceAdapter;
  kind: VoiceAdapter['kind'];
}

export function chooseVoiceEngine(opts: { tier?: VoiceTier; exampleLine: () => string }): EngineChoice {
  const tier = opts.tier ?? 'auto';
  if (tier === 'auto' && hearingAvailable()) {
    const adapter = liveEngine!();
    return { adapter, kind: adapter.kind };
  }
  return { adapter: new ScriptedExampleAdapter(opts.exampleLine), kind: 'scripted' };
}
