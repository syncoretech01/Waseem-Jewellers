'use client';

import { pulseSpeech, stopSpeechEnvelope } from './meter';
import { RATE_FOR_ROMAN_URDU, speechRuns, voiceFor } from './languages';

/**
 * Speaking, behind one seam.
 *
 * The controller says `speak(text)` and never knows which engine answers. The browser's
 * own synthesis is the default; a server engine registers itself when the deployment has
 * the credential, and any reply it cannot deliver falls back to the browser for that reply
 * alone. Both drive the same meter, so the ring breathes the same way whichever speaks.
 */
export interface SpeechHandlers {
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechPlan {
  parts: { text: string; voice: SpeechSynthesisVoice | null; lang: string; rate: number }[];
  /** True when at least one run of the reply has no voice in its own language. */
  missingAVoice: boolean;
}

export interface SpeechEngine {
  readonly kind: 'browser' | 'server';
  isSupported(): boolean;
  plan(text: string): SpeechPlan;
  speak(text: string, handlers: SpeechHandlers): Promise<void>;
  cancel(): void;
}

// ── the browser engine ───────────────────────────────────────────────────────

let envelope: number | null = null;
/** The voice list, kept current: Chromium's first read is often empty and fills in later. */
let voiceList: SpeechSynthesisVoice[] = [];
let voicesWatched = false;

export function synthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function voices(): SpeechSynthesisVoice[] {
  if (!synthesisSupported()) return [];
  if (!voicesWatched) {
    voicesWatched = true;
    const read = () => {
      voiceList = window.speechSynthesis.getVoices();
    };
    read();
    window.speechSynthesis.addEventListener?.('voiceschanged', read);
  }
  if (!voiceList.length) voiceList = window.speechSynthesis.getVoices();
  return voiceList;
}

/** Sentence ends in every script the concierge answers in — the same set the register uses. */
function sentencesOf(text: string) {
  return text
    .split(/(?<=[.?!—۔؟।॥])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function planSpeech(text: string): SpeechPlan {
  return speechEngine().plan(text);
}

/**
 * A reply is split into runs of one script and each run asks for a voice in its own
 * language. A run with no voice is not spoken by some other language's voice — an Urdu
 * sentence read by an English voice is confident nonsense in the visitor's ear. When the
 * browser has not listed its voices yet, nothing is known either way, and the reply is
 * spoken with its language tag rather than declared voiceless.
 */
function browserPlan(text: string): SpeechPlan {
  const available = voices();
  const unknown = available.length === 0;
  const parts = speechRuns(text)
    .flatMap((run) => {
      const voice = voiceFor(run.lang, available);
      const romanUrdu = run.script === 'latin' && /\b(ka|ki|ke|hai|hain|mujhe|dikhao|chahiye|kitna|kya)\b/i.test(run.text);
      return sentencesOf(run.text).map((t) => ({ t, voice, lang: run.lang, romanUrdu }));
    })
    .map(({ t, voice, lang, romanUrdu }) => ({ text: t, voice, lang, rate: romanUrdu ? RATE_FOR_ROMAN_URDU : 0.95 }));
  return { parts, missingAVoice: !unknown && parts.some((p) => p.voice === null) };
}

/** Settles the reply currently being spoken (set by speak, run by cancel). */
let pending: (() => void) | null = null;

function browserSpeak(text: string, handlers: SpeechHandlers): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!synthesisSupported()) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const { parts } = browserPlan(text);
    const known = voices().length > 0;
    // a run with no voice in its own language is skipped, never spoken in another —
    // unless the voice list is simply not in yet, when the language tag has to do
    const speakable = parts.filter((p) => p.voice !== null || !known);
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
    // Chromium drops the utterance queued in the same tick as a cancel; a breath first
    window.setTimeout(() => {
      if (done) return;
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
    }, 40);
  });
}

function browserCancel() {
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

export const browserSpeechEngine: SpeechEngine = {
  kind: 'browser',
  isSupported: synthesisSupported,
  plan: browserPlan,
  speak: browserSpeak,
  cancel: browserCancel,
};

// ── the seam ─────────────────────────────────────────────────────────────────

let serverEngine: SpeechEngine | null = null;

/** Called by the server speech module when the deployment advertises it. */
export function registerSpeechEngine(engine: SpeechEngine | null) {
  serverEngine = engine;
}

/** The engine that will speak the next reply. */
export function speechEngine(): SpeechEngine {
  return serverEngine && serverEngine.isSupported() ? serverEngine : browserSpeechEngine;
}

/** Whether a reply can be voiced at all on this device, by any engine. */
export function speechAvailable() {
  return speechEngine().isSupported();
}

/** Speaks a reply; resolves when finished or cancelled. A server reply that fails falls back to the browser for that reply. */
export async function speak(text: string, handlers: SpeechHandlers = {}): Promise<void> {
  const engine = speechEngine();
  if (engine.kind === 'server') {
    try {
      await engine.speak(text, handlers);
      return;
    } catch {
      if (!browserSpeechEngine.isSupported()) {
        handlers.onEnd?.();
        return;
      }
    }
  }
  await browserSpeechEngine.speak(text, handlers);
}

export function cancelSpeech() {
  serverEngine?.cancel();
  browserCancel();
}
