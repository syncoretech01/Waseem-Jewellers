'use client';

import { startMeter, stopMeter, voiceMeter } from './meter';
import type { VoiceAdapter, VoiceHandlers } from './adapters';

/**
 * Hearing through the server's transcription model.
 *
 * The microphone opens, the visitor speaks, the meter watches for the pause that ends a
 * sentence, and the recording goes to /api/concierge/transcribe — which returns the words
 * in whichever of the five languages they were said in. Those words then enter the same
 * turn a typed sentence does. The browser's own recognition stays the fallback for any
 * utterance this cannot hear (no credential, a network fault, an unsupported recorder).
 *
 * One capture: the meter is fed the recorder's own stream, so the ring breathes with the
 * visitor's real voice and no second microphone is asked for.
 */

const SILENCE_AFTER_SPEECH_MS = 900;
const MAX_UTTERANCE_MS = 15_000;
const MIN_UTTERANCE_MS = 500;
const SPEECH_LEVEL = 0.08;
const SILENCE_LEVEL = 0.045;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function serverVoiceSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export class ServerTranscriptionAdapter implements VoiceAdapter {
  readonly kind = 'server' as const;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private watcher: number | null = null;
  private cap: number | null = null;
  private chunks: Blob[] = [];
  private handlers: VoiceHandlers | null = null;
  private startedAt = 0;
  private aborted = false;

  constructor(private language: string | null) {}

  isSupported() {
    return serverVoiceSupported();
  }

  async start(h: VoiceHandlers) {
    this.abort();
    this.aborted = false;
    this.handlers = h;
    this.chunks = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      h.onError({ code: name === 'NotAllowedError' || name === 'SecurityError' ? 'MIC_DENIED' : 'NETWORK', message: name || 'microphone' });
      return;
    }
    if (this.aborted) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const mimeType = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      h.onError({ code: 'UNSUPPORTED', message: 'recorder' });
      return;
    }
    this.recorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    recorder.onstop = () => void this.deliver();
    recorder.start(250);
    this.startedAt = performance.now();
    h.onStart();
    void startMeter(stream);

    // the pause that ends a sentence, read from the same stream the recorder is on
    let spoke = false;
    let quietSince = 0;
    this.watcher = window.setInterval(() => {
      const now = performance.now();
      const level = voiceMeter.level;
      if (level > SPEECH_LEVEL) {
        spoke = true;
        quietSince = 0;
      } else if (spoke && level < SILENCE_LEVEL) {
        if (!quietSince) quietSince = now;
        else if (now - quietSince >= SILENCE_AFTER_SPEECH_MS && now - this.startedAt >= MIN_UTTERANCE_MS) this.stop();
      }
    }, 80);
    this.cap = window.setTimeout(() => this.stop(), MAX_UTTERANCE_MS);
  }

  /** Ends the recording and sends it; the handlers hear the words when they come back. */
  stop() {
    this.clearWatch();
    const rec = this.recorder;
    if (rec && rec.state !== 'inactive') rec.stop();
  }

  abort() {
    this.aborted = true;
    this.clearWatch();
    const rec = this.recorder;
    this.recorder = null;
    if (rec) {
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* already stopped */
      }
    }
    this.releaseStream();
    this.chunks = [];
    this.handlers = null;
    stopMeter();
  }

  private clearWatch() {
    if (this.watcher) window.clearInterval(this.watcher);
    if (this.cap) window.clearTimeout(this.cap);
    this.watcher = null;
    this.cap = null;
  }

  private releaseStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private async deliver() {
    const h = this.handlers;
    this.recorder = null;
    this.releaseStream();
    stopMeter();
    if (!h || this.aborted) return;
    const blob = new Blob(this.chunks, { type: this.chunks[0]?.type || pickMime() || 'audio/webm' });
    this.chunks = [];
    if (blob.size < 1_500 || performance.now() - this.startedAt < MIN_UTTERANCE_MS) {
      h.onError({ code: 'NO_SPEECH', message: 'nothing heard' });
      return;
    }
    h.onTranscribing?.();
    const form = new FormData();
    form.append('audio', blob, 'utterance');
    if (this.language) form.append('language', this.language);
    let res: Response;
    try {
      res = await fetch('/api/concierge/transcribe', { method: 'POST', body: form, signal: AbortSignal.timeout(25_000) });
    } catch {
      if (!this.aborted) h.onError({ code: 'NETWORK', message: 'transcribe' });
      return;
    }
    if (this.aborted) return;
    if (res.status === 503 || res.status === 401 || res.status === 403) {
      // the tier is not there for this visitor; the browser's own hearing takes this utterance
      h.onError({ code: 'UNSUPPORTED', message: `transcribe ${res.status}` });
      return;
    }
    if (!res.ok) {
      h.onError({ code: 'NETWORK', message: `transcribe ${res.status}` });
      return;
    }
    let text = '';
    let language: string | null = null;
    try {
      const json = (await res.json()) as { text?: unknown; language?: unknown };
      text = typeof json.text === 'string' ? json.text.trim() : '';
      language = typeof json.language === 'string' ? json.language : null;
    } catch {
      h.onError({ code: 'NETWORK', message: 'unreadable' });
      return;
    }
    if (!text) {
      h.onError({ code: 'NO_SPEECH', message: 'nothing heard' });
      return;
    }
    h.onInterim(text);
    h.onFinal(text, { language });
  }
}
