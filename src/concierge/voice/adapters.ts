'use client';

import { startMeter, startSyntheticMeter, stopMeter } from './meter';

export type VoiceErrorCode = 'MIC_DENIED' | 'NO_SPEECH' | 'NETWORK' | 'ABORTED' | 'UNSUPPORTED';

export interface VoiceHandlers {
  lang: string;
  onStart(): void;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onEnd(): void;
  onError(e: { code: VoiceErrorCode; message: string }): void;
}

export interface VoiceAdapter {
  readonly kind: 'webspeech' | 'scripted';
  isSupported(): boolean;
  start(handlers: VoiceHandlers): Promise<void>;
  stop(): void;
  abort(): void;
}

export function recognitionSupported() {
  if (typeof window === 'undefined') return false;
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Boolean(SR) && window.isSecureContext;
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
    rec.maxAlternatives = 1;
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
        const t = r[0]?.transcript ?? '';
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
