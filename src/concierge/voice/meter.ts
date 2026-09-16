'use client';

import { gsap } from '@/lib/motion/gsap';

/** Mutable, read in useFrame / tickers — never React state (60 Hz writes would re-render the panel). */
export const voiceMeter = { level: 0, speech: 0, synthetic: false };

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
/** Whether stopMeter may end the stream's tracks — false when a caller lent its own microphone. */
let ownsStream = true;
let tick: ((t: number) => void) | null = null;
let syntheticTick: ((t: number) => void) | null = null;
let speechDecay: ((t: number) => void) | null = null;
/** Bumped by stopMeter so a start still awaiting the microphone knows it was cancelled. */
let generation = 0;

/** Meters a microphone stream into voiceMeter.level with a breath-like attack/release. */
export async function startMeter(existing?: MediaStream, opts: { own?: boolean } = {}) {
  stopMeter();
  const mine = generation;
  const own = opts.own ?? !existing;
  ownsStream = own;
  try {
    const granted = existing ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
    if (mine !== generation) {
      // the session closed while the visitor was answering the permission prompt
      if (own) granted.getTracks().forEach((t) => t.stop());
      return false;
    }
    stream = granted;
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i]! - 128) / 128;
        sum += v * v;
      }
      const raw = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      voiceMeter.level += (raw - voiceMeter.level) * (raw > voiceMeter.level ? 0.5 : 0.12);
    };
    gsap.ticker.add(tick);
    voiceMeter.synthetic = false;
    return true;
  } catch {
    if (mine !== generation) return false;
    startSyntheticMeter();
    return false;
  }
}

/** When no microphone stream is available the orb still breathes as if listening. */
export function startSyntheticMeter() {
  stopMeter();
  voiceMeter.synthetic = true;
  syntheticTick = (t) => {
    voiceMeter.level = 0.12 + 0.08 * Math.sin(t * 2.4) + 0.04 * (Math.random() - 0.5);
  };
  gsap.ticker.add(syntheticTick);
}

export function stopMeter() {
  generation += 1;
  if (tick) gsap.ticker.remove(tick);
  if (syntheticTick) gsap.ticker.remove(syntheticTick);
  tick = null;
  syntheticTick = null;
  if (ownsStream) stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  ownsStream = true;
  if (ctx && ctx.state !== 'closed') void ctx.close();
  ctx = null;
  voiceMeter.level = 0;
  voiceMeter.synthetic = false;
}

/** Speech envelope driven by SpeechSynthesis boundary events (or a pseudo-random envelope). */
export function pulseSpeech(value = 0.9) {
  voiceMeter.speech = Math.max(voiceMeter.speech, value);
  if (!speechDecay) {
    speechDecay = (_t: number, dt?: number) => {
      const d = (dt ?? 16) / 1000;
      voiceMeter.speech = Math.max(0, voiceMeter.speech - d * 6);
      if (voiceMeter.speech === 0 && speechDecay) {
        gsap.ticker.remove(speechDecay);
        speechDecay = null;
      }
    };
    gsap.ticker.add(speechDecay);
  }
}

export function stopSpeechEnvelope() {
  voiceMeter.speech = 0;
  if (speechDecay) gsap.ticker.remove(speechDecay);
  speechDecay = null;
}
