'use client';

import { pulseSpeech, stopSpeechEnvelope } from './meter';
import { capabilities } from '../capabilities';
import { registerSpeechEngine, type SpeechEngine, type SpeechHandlers, type SpeechPlan } from './speech';

/**
 * Speaking through the server's speech model.
 *
 * A reply is fetched from /api/concierge/speak as it is generated and played through one
 * detached audio element. An analyser on that element drives the meter, so the ring
 * breathes with the actual voice rather than a guess at it. Replies repeat — the greeting,
 * "Kept in your selection" — so a handful are remembered for the session.
 *
 * On a phone the first playback has to be blessed by a tap. The mic button is a tap, so
 * `primeAudio()` runs there and the element is allowed to play whenever the reply arrives.
 */

const CACHE_MAX = 24;
const cache = new Map<string, string>();

let audio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;
let primed = false;
let active: { cancel: () => void } | null = null;

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
  }
  return audio;
}

/** Inside a user gesture: a silent play so later programmatic playback is permitted. */
export function primeAudio() {
  if (primed) return;
  primed = true;
  const el = element();
  try {
    el.muted = true;
    el.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwAAAAAAAAAAAAAAAkAAAAAAAAAAACcWQ4hR0AAAAAAAAAAAAAAAAAAAAAAAAA';
    void el.play().catch(() => undefined).finally(() => {
      el.muted = false;
    });
  } catch {
    /* nothing to bless */
  }
}

function meterFrom(el: HTMLAudioElement) {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
    }
    void ctx.resume();
    const buf = new Uint8Array(analyser!.frequencyBinCount);
    const tick = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i]! - 128) / 128;
        sum += v * v;
      }
      pulseSpeech(Math.min(1, Math.sqrt(sum / buf.length) * 3.4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch {
    // no analyser: a steady envelope still lets the ring breathe
    raf = window.setInterval(() => pulseSpeech(0.55 + Math.random() * 0.3), 220) as unknown as number;
  }
}

function stopMetering() {
  cancelAnimationFrame(raf);
  window.clearInterval(raf);
  raf = 0;
  stopSpeechEnvelope();
}

async function fetchSpeech(text: string): Promise<string> {
  const key = text;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch('/api/concierge/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`speak ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      URL.revokeObjectURL(cache.get(oldest)!);
      cache.delete(oldest);
    }
  }
  cache.set(key, url);
  return url;
}

export const serverSpeechEngine: SpeechEngine = {
  kind: 'server',
  isSupported: () => typeof window !== 'undefined' && capabilities().voice === 'server' && typeof Audio !== 'undefined',
  /** The server voice speaks every language the concierge writes in; nothing is ever voiceless. */
  plan: (text: string): SpeechPlan => ({ parts: [{ text, voice: null, lang: 'auto', rate: 1 }], missingAVoice: false }),
  speak(text: string, handlers: SpeechHandlers) {
    return new Promise<void>((resolve, reject) => {
      active?.cancel();
      let done = false;
      let started = false;
      const el = element();
      const finish = () => {
        if (done) return;
        done = true;
        active = null;
        stopMetering();
        el.onended = null;
        el.onerror = null;
        el.onplaying = null;
        handlers.onEnd?.();
        resolve();
      };
      const cancel = () => {
        if (done) return;
        try {
          el.pause();
        } catch {
          /* nothing playing */
        }
        finish();
      };
      active = { cancel };
      fetchSpeech(text)
        .then((url) => {
          if (done) return;
          el.src = url;
          el.onplaying = () => {
            if (started) return;
            started = true;
            handlers.onStart?.();
            meterFrom(el);
          };
          el.onended = finish;
          el.onerror = () => {
            if (started) finish();
            else {
              active = null;
              reject(new Error('playback'));
            }
          };
          return el.play();
        })
        .catch((err) => {
          if (done) return;
          active = null;
          done = true;
          reject(err instanceof Error ? err : new Error('speak'));
        });
    });
  },
  cancel() {
    active?.cancel();
  },
};

/** Advertise the engine; `speechEngine()` still asks `isSupported()` before every reply. */
export function registerServerSpeech() {
  registerSpeechEngine(serverSpeechEngine);
}
