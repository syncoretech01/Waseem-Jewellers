'use client';

import { pulseSpeech, stopSpeechEnvelope } from './meter';
import { RATE_FOR_ROMAN_URDU, speechRuns, voiceFor } from './languages';

let envelope: number | null = null;

const voices = (): SpeechSynthesisVoice[] => (synthesisSupported() ? window.speechSynthesis.getVoices() : []);

export function synthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Whether this browser can speak a reply at all, and in which parts.
 *
 * A reply is split into runs of one script and each run asks for a voice in its own
 * language. A run with no voice is not spoken by some other language's voice — an Urdu
 * sentence read by an English voice is confident nonsense in the visitor's ear, which is
 * worse than silence and much worse than reading it. The caller is told, so it can say so
 * once and let the written reply stand.
 */
export interface SpeechPlan {
  parts: { text: string; voice: SpeechSynthesisVoice | null; lang: string; rate: number }[];
  /** True when at least one run of the reply has no voice in its own language. */
  missingAVoice: boolean;
}

export function planSpeech(text: string): SpeechPlan {
  const available = voices();
  const parts = speechRuns(text).flatMap((run) => {
    const voice = voiceFor(run.lang, available);
    // a Latin run may be English or Roman Urdu; either way an en-IN voice reads it, and the
    // slower rate is what makes Roman Urdu recognisable rather than merely audible
    const romanUrdu = run.script === 'latin' && /\b(ka|ki|ke|hai|hain|mujhe|dikhao|chahiye|kitna|kya)\b/i.test(run.text);
    return sentencesOf(run.text).map((t) => ({ t, voice, lang: run.lang, romanUrdu }));
  }).map(({ t, voice, lang, romanUrdu }) => ({ text: t, voice, lang, rate: romanUrdu ? RATE_FOR_ROMAN_URDU : 0.95 }));
  return { parts, missingAVoice: parts.some((p) => p.voice === null) };
}

/** Sentence ends in every script the concierge answers in — the same set the register uses. */
function sentencesOf(text: string) {
  return text
    .split(/(?<=[.?!—۔؟।॥])\s+/)
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
    const { parts } = planSpeech(text);
    // a run with no voice in its own language is skipped, never spoken in another
    const speakable = parts.filter((p) => p.voice !== null);
    if (!speakable.length) {
      handlers.onEnd?.();
      resolve();
      return;
    }
    let started = false;
    let remaining = speakable.length;
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
    speakable.forEach((part) => {
      const u = new SpeechSynthesisUtterance(part.text);
      if (part.voice) u.voice = part.voice;
      u.lang = part.lang;
      u.rate = part.rate;
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
