'use client';

import { startMeter, startSyntheticMeter, stopMeter } from './meter';

export type VoiceErrorCode = 'MIC_DENIED' | 'NO_SPEECH' | 'NETWORK' | 'ABORTED' | 'UNSUPPORTED';

export interface VoiceHandlers {
  lang: string;
  onStart(): void;
  onInterim(text: string): void;
  /** `language` arrives from the server tier, which can tell which script it heard. */
  onFinal(text: string, meta?: { language?: string | null }): void;
  /** The microphone has closed and the words are on their way — the server tier's pause. */
  onTranscribing?(): void;
  onEnd(): void;
  onError(e: { code: VoiceErrorCode; message: string }): void;
}

export interface VoiceAdapter {
  readonly kind: 'webspeech' | 'scripted' | 'server' | 'realtime';
  isSupported(): boolean;
  start(handlers: VoiceHandlers): Promise<void>;
  /** The visitor is done for now: an utterance adapter finalises; a session adapter pauses its microphone. */
  stop(): void;
  abort(): void;
  /**
   * A session adapter keeps one conversation open across turns. It hears, reasons and speaks by
   * itself, so it needs the concierge's runtime — the event sink and the tools — and it can
   * take a typed sentence into the same conversation. Utterance adapters leave these undefined.
   */
  bind?(runtime: VoiceSessionRuntime): void;
  isLive?(): boolean;
  sendText?(text: string): boolean;
  /** Cut the reply that is being spoken; the conversation stays. */
  interrupt?(): void;
}

export interface VoiceSessionRuntime {
  emit(event: import('../types').ProviderEvent): void;
  executeTool(name: import('../types').ToolName, args: Record<string, unknown>): Promise<import('../types').ToolOutcome>;
  /** What the session should know about the page, rendered small. */
  context(): import('./realtimePrompt').VoiceContextInput;
  onLanguage(language: 'ur' | 'pa-Guru'): void;
  /** Fires whenever the page changes in a way the session should hear about; returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

export function recognitionSupported() {
  if (typeof window === 'undefined') return false;
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Boolean(SR) && window.isSecureContext;
}

/**
 * The reading most likely to be a sentence about jewellery.
 *
 * Confidence alone picks the engine's favourite, which for Roman Urdu is often an English
 * near-homophone. A small nudge towards any alternative containing a word this shop deals
 * in recovers the real utterance without inventing one: the words are only used to *choose*
 * between readings the engine already produced, never to alter them.
 */
const DOMAIN = /\b(sona|sone|soney|haar|har|set|sett|angoothi|anguthi|kangan|jhumka|jhumke|tikka|nath|karat|karrat|carat|tola|lakh|lakhs|crore|hazaar|hazar|polki|kundan|heera|heere|moti|zewar|zewer|jewellery|jewelry|gold|diamond|bridal|bangle|ring|necklace|earring|earrings|bracelet|pendant|gram|grams)\b/i;

function bestAlternative(result: SpeechRecognitionResultLike): string {
  const first = result[0]?.transcript ?? '';
  let best = first;
  let bestScore = -Infinity;
  for (let i = 0; i < Math.min(result.length, 3); i++) {
    const alt = result[i];
    if (!alt?.transcript) continue;
    // the engine's own ranking leads; a domain word is worth about a tenth of confidence
    const score = (alt.confidence ?? 0) + (DOMAIN.test(alt.transcript) ? 0.1 : 0) - i * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = alt.transcript;
    }
  }
  return best;
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

/** Browser speech recognition (Chrome/Edge/Safari), single utterance, interim results. */
export class WebSpeechAdapter implements VoiceAdapter {
  readonly kind = 'webspeech' as const;
  private rec: SpeechRecognitionLike | null = null;
  private timer: number | null = null;
  private finalText = '';

  isSupported() {
    return recognitionSupported();
  }

  async start(h: VoiceHandlers) {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      h.onError({ code: 'UNSUPPORTED', message: 'no recognition' });
      return;
    }
    this.abort();
    const rec = new SR();
    this.rec = rec;
    this.finalText = '';
    rec.lang = h.lang;
    rec.continuous = false;
    rec.interimResults = true;
    /**
     * Three readings of every utterance, not one.
     *
     * Roman Urdu is where browser recognition actually fails: it is Latin text that is not
     * English, so the engine's first guess is frequently an English word that sounds similar
     * and means nothing here, while the second or third is the word the visitor said. Asking
     * for alternatives costs nothing — the engine has already computed them.
     */
    rec.maxAlternatives = 3;
    let ended = false;
    rec.onstart = () => {
      h.onStart();
      // iOS Safari cannot share the microphone between recognition and an AudioContext
      if (isIOSSafari()) startSyntheticMeter();
      else void startMeter();
    };
    rec.onresult = (ev) => {
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]!;
        const t = bestAlternative(r);
        if (r.isFinal) final += t;
        else interim += t;
      }
      if (final) {
        this.finalText = (this.finalText + ' ' + final).trim();
        h.onInterim(this.finalText);
      } else if (interim) {
        h.onInterim((this.finalText + ' ' + interim).trim());
      }
    };
    rec.onerror = (ev) => {
      const code = ev.error;
      if (code === 'aborted') return;
      const map: Record<string, VoiceErrorCode> = { 'not-allowed': 'MIC_DENIED', 'service-not-allowed': 'MIC_DENIED', 'audio-capture': 'MIC_DENIED', 'no-speech': 'NO_SPEECH', network: 'NETWORK' };
      h.onError({ code: map[code] ?? 'NETWORK', message: code });
    };
    rec.onend = () => {
      if (ended) return;
      ended = true;
      stopMeter();
      if (this.timer) window.clearTimeout(this.timer);
      const text = this.finalText.trim();
      if (text) h.onFinal(text);
      else h.onEnd();
    };
    this.timer = window.setTimeout(() => rec.stop(), 8000);
    try {
      rec.start();
    } catch {
      h.onError({ code: 'NETWORK', message: 'start failed' });
    }
  }

  stop() {
    this.rec?.stop();
  }

  abort() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    stopMeter();
  }
}

/**
 * "Let me show you": types a visitor line through the same handlers, so the whole
 * pipeline — listening, transcript, thinking, action, speaking — runs on any browser.
 */
export class ScriptedExampleAdapter implements VoiceAdapter {
  readonly kind = 'scripted' as const;
  private timers = new Set<number>();
  private line = '';

  constructor(private nextLine: () => string) {}

  isSupported() {
    return true;
  }

  async start(h: VoiceHandlers) {
    this.abort();
    this.line = this.nextLine();
    h.onStart();
    startSyntheticMeter();
    const chars = [...this.line];
    let i = 0;
    const type = () => {
      i += 1;
      h.onInterim(chars.slice(0, i).join(''));
      if (i < chars.length) {
        const id = window.setTimeout(type, 42 + Math.random() * 18);
        this.timers.add(id);
      } else {
        const id = window.setTimeout(() => {
          stopMeter();
          h.onFinal(this.line);
        }, 420);
        this.timers.add(id);
      }
    };
    const first = window.setTimeout(type, 900);
    this.timers.add(first);
  }

  stop() {
    this.abort();
  }

  abort() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.clear();
    stopMeter();
  }
}
