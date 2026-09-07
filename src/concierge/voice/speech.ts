'use client';

import { pulseSpeech, stopSpeechEnvelope } from './meter';

let chosen: SpeechSynthesisVoice | null = null;
let envelope: number | null = null;

export function synthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function score(v: SpeechSynthesisVoice) {
  let s = 0;
  if (/^en-GB/i.test(v.lang)) s += 5;
  else if (/^en-IN/i.test(v.lang)) s += 4;
  else if (/^en-AU/i.test(v.lang)) s += 2;
  else if (/^en/i.test(v.lang)) s += 1;
  if (/sonia|libby|neerja|heera|kate|serena|moira|fiona|female|woman|google uk english female|hazel|susan/i.test(v.name)) s += 4;
  if (/male|david|george|ryan|daniel|mark|ravi|prabhat|james/i.test(v.name)) s -= 4;
  if (v.localService) s += 1;
  return s;
}

export function pickVoice(): SpeechSynthesisVoice | null {
  if (!synthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  chosen = [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
  return chosen;
}

if (typeof window !== 'undefined' && synthesisSupported()) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => pickVoice());
}

function chunks(text: string) {
  return text
    .split(/(?<=[.?!—])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Settles the reply currently being spoken (set by speak, run by cancelSpeech). */
let pending: (() => void) | null = null;

/** Speaks a reply in sentence chunks; resolves when finished or cancelled. */
export function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void } = {}) {
  return new Promise<void>((resolve) => {
    if (!synthesisSupported()) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const parts = chunks(text);
    if (!parts.length) {
      resolve();
      return;
    }
    let started = false;
    let remaining = parts.length;
    let boundaries = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pending = null;
      stopSpeechEnvelope();
      if (envelope) window.clearInterval(envelope);
      envelope = null;
      handlers.onEnd?.();
      resolve();
    };
    pending = finish;
    parts.forEach((part) => {
      const u = new SpeechSynthesisUtterance(part);
      if (chosen) u.voice = chosen;
      u.rate = 0.95;
      u.pitch = 1;
      u.onstart = () => {
        if (!started) {
          started = true;
          handlers.onStart?.();
          // voices without boundary events get a pseudo-random envelope
          envelope = window.setInterval(() => {
            if (boundaries === 0) pulseSpeech(0.5 + Math.random() * 0.4);
          }, 250);
        }
      };
      u.onboundary = () => {
        boundaries += 1;
        pulseSpeech(0.9);
      };
      u.onend = () => {
        remaining -= 1;
        if (remaining === 0) finish();
      };
      u.onerror = () => {
        remaining -= 1;
        if (remaining === 0) finish();
      };
      synth.speak(u);
    });
  });
}

export function cancelSpeech() {
  if (!synthesisSupported()) return;
  window.speechSynthesis.cancel();
  stopSpeechEnvelope();
  if (envelope) window.clearInterval(envelope);
  envelope = null;
  // cancelled utterances never fire `end`, so settle the reply ourselves
  const settle = pending;
  pending = null;
  settle?.();
}
