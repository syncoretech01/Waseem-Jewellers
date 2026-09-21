'use client';

import { registerVoiceEngine } from './engine';
import { pulseSpeech, startMeter, stopMeter, stopSpeechEnvelope } from './meter';
import { NOISE_REDUCTION, REALTIME_TOOL_ALIASES, TURN_DETECTION, VOICE_INSTRUCTIONS, realtimeTools, renderVoiceContext, withContext } from './realtimePrompt';
import type { VoiceAdapter, VoiceHandlers, VoiceSessionRuntime } from './adapters';
import type { ToolName } from '../types';
import { romaniseDevanagari } from '@/lib/romanise';
import { stripBannedPhrases } from '../register';
import { CONCIERGE } from '../copy';

/**
 * The realtime tier: one model that hears, understands and speaks.
 *
 * Everything the browser holds is a short-lived client secret and a WebRTC call. The
 * microphone track goes up; the voice comes back on a remote track; a data channel carries
 * the events. The permanent credential is minted against on the server and never seen here.
 *
 * It is a *session* adapter: one conversation stays open across turns, so the model keeps
 * its own context, barge-in is the server's voice-activity detector cancelling its own reply,
 * and a typed correction goes into the same conversation as the spoken sentences. The
 * concierge's state machine is driven through the same provider events every other engine
 * emits — the exchange, the tray, the voice stage cannot tell which engine is talking.
 *
 * **The call is opened before the visitor taps.** Measured on the deployment (21 September
 * 2026): minting the secret took 1.0–2.3 s and the WebRTC handshake 3.7–4.4 s, so the first
 * tap waited six seconds for "Listening". The call is now opened with an audio transceiver
 * and no microphone the moment the voice stage is shown — nothing is heard, no permission is
 * asked — and the tap only attaches the microphone track (`replaceTrack`, ~100 ms). The
 * browser's microphone indicator lights on the tap, as a visitor expects.
 *
 * What it validates itself: every function call passes `executeTool`, which refuses an
 * unknown tool or a slug the catalogue does not carry, exactly as it would for the text model.
 * On this path nothing else will, so it is the only gate — and it is enough.
 */

interface TokenResponse {
  token: string;
  model: string;
  voice: string;
  instructions?: string;
  callsUrl: string;
}

interface RealtimeEvent {
  type: string;
  [k: string]: unknown;
}

interface PendingCall {
  callId: string;
  name: string;
  args: string;
  /** The response the call arrived in; its `response.done` releases the continuation. */
  responseId: string;
}

/** The timeline the latency harness reads; cheap enough to keep on. */
export interface TraceEntry {
  t: number;
  type: string;
  detail?: string;
}
const TRACE_MAX = 600;

let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Ended by the visitor's silence: a muted session costs nothing but is torn down after this. */
const IDLE_MS = 4 * 60_000;
/** A call opened for a tap that never came is let go sooner. */
const WARM_IDLE_MS = 3 * 60_000;
/** A call that would not open is not asked for again this soon; the tap steps down the ladder instead. */
const RETRY_AFTER_MS = 30_000;
const CONTEXT_DEBOUNCE_MS = 700;

export function realtimeSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

/** Which script a transcript arrived in, for the browser tier to listen in next time. */
function scriptOf(text: string): 'ur' | 'pa-Guru' | null {
  if (/[਀-੿]/.test(text)) return 'pa-Guru';
  if (/[؀-ۿ]/.test(text)) return 'ur';
  return null;
}

/** The written form of what was said: no markdown, no exclamation, one space. */
const tidy = (s: string) => stripBannedPhrases(s.replace(/[*_#`]+/g, '').replace(/!+/g, '.')).replace(/\s+/g, ' ').trim();

export class RealtimeVoiceAdapter implements VoiceAdapter {
  readonly kind = 'realtime' as const;
  private runtime: VoiceSessionRuntime | null = null;
  private handlers: VoiceHandlers | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private sender: RTCRtpSender | null = null;
  private mic: MediaStream | null = null;
  private remote: HTMLAudioElement | null = null;
  private meterCtx: AudioContext | null = null;
  private meterRaf = 0;
  private live = false;
  /** The microphone track is attached and enabled: the session hears the room. */
  private hearing = false;
  private connecting: Promise<void> | null = null;
  /** Bumped by every teardown; a connect() that was cancelled mid-handshake sees it and lets go. */
  private generation = 0;
  private settleOpen: ((err: Error) => void) | null = null;
  private rounds = 0;
  /** A sentence has been sent and no reply has finished for it yet. */
  private outstanding = false;
  private baseInstructions = VOICE_INSTRUCTIONS;
  private lastContext = '';
  private contextTimer: number | null = null;
  private idleTimer: number | null = null;
  private unsubscribe: (() => void)[] = [];
  private lastError: { code: 'MIC_DENIED' | 'UNSUPPORTED' | 'NETWORK'; message: string } | null = null;
  /** When the last attempt to open the call failed; a tap soon after steps down at once rather than waiting to fail the same way. */
  private failedAt = 0;

  /** The conversation as the store sees it. */
  private turnId: string | null = null;
  private utteranceId: string | null = null;
  /** The buffer item each spoken line became, so a transcript lands on its own line even when two arrive close together. */
  private utterances = new Map<string, string>();
  private interim = '';
  private replyText = '';
  /** A reply continued after an action joins the transcript with a space, not mid-word. */
  private joinReply = false;
  private pending = new Map<string, PendingCall>();
  /** Calls answered whose response has not yet closed; the continuation waits for it. */
  private answeredThisResponse = 0;
  private running = 0;
  /** The response currently open on the server, so a continuation is never asked for while one is. */
  private openResponseId: string | null = null;
  /** Bumped whenever the visitor moves on; an action still running finds it changed and stays out of the room. */
  private epoch = 0;
  private answered = new Set<string>();
  private responseOpen = false;
  private speaking = false;
  private turnHadTool = false;
  readonly trace: TraceEntry[] = [];

  isSupported() {
    return realtimeSupported();
  }

  isLive() {
    return this.live;
  }

  /** The call is open before any tap: the tap only attaches the microphone. */
  isWarm() {
    return this.live;
  }

  /** The microphone is attached and enabled: the session hears the room. */
  isHearing() {
    return this.live && this.hearing;
  }

  bind(runtime: VoiceSessionRuntime) {
    this.runtime = runtime;
  }

  note(type: string, detail?: string) {
    this.trace.push({ t: Date.now(), type, detail });
    if (this.trace.length > TRACE_MAX) this.trace.splice(0, this.trace.length - TRACE_MAX);
  }

  // ── lifecycle ───────────────────────────────────────────────────────────
  /**
   * Open the call before the tap: the secret, the handshake and the data channel — nothing
   * that needs a permission. Resolves true when the session is live. A failure is kept for
   * the tap to report properly (the ladder steps down there), never surfaced from here.
   */
  async warm(): Promise<boolean> {
    if (this.live) return true;
    if (!this.runtime || !realtimeSupported()) return false;
    if (!this.connecting) {
      this.note('warm.start');
      this.connecting = this.connect().finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting;
    return this.live;
  }

  async start(h: VoiceHandlers) {
    this.handlers = h;
    // inside the tap: the phone allows the remote voice to play only when a gesture asks first
    void this.remote?.play().catch(() => undefined);
    if (this.live) {
      await this.attachMic(h);
      return;
    }
    if (!this.connecting && this.lastError && Date.now() - this.failedAt < RETRY_AFTER_MS) {
      h.onError(this.lastError);
      return;
    }
    if (!this.connecting) {
      this.connecting = this.connect().finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting;
    if (!this.live) {
      h.onError(this.lastError ?? { code: 'NETWORK', message: 'connect' });
      return;
    }
    await this.attachMic(h);
  }

  /**
   * A tap while listening, "Write instead", or the panel closing: the microphone is released
   * — the track stopped, its seat on the call left empty, the browser's indicator off — and
   * the conversation stays open for a while, so the next tap is a re-attach, not a handshake.
   */
  stop() {
    if (!this.live) return;
    this.restMic();
    this.armIdle();
    this.handlers?.onEnd();
  }

  abort() {
    this.teardown('abort');
  }

  /** The reply stops here — on the server, which cancels the response, and on the page, which clears the audio. */
  interrupt() {
    if (!this.live) return;
    this.supersede('interrupt');
  }

  /**
   * Whatever was in flight is over. The response is cancelled on the server and its audio
   * cleared on the page; the actions still queued are dropped and one still running answers
   * into the conversation but no longer onto the stage; the turn is closed so the next
   * sentence — spoken, typed, or a tap — opens its own.
   */
  private supersede(reason: string) {
    this.epoch += 1;
    this.pending.clear();
    this.answeredThisResponse = 0;
    // audio still in the buffer after the response completed is cleared alone; a cancel then has nothing to cancel
    if (this.responseOpen || this.speaking) this.send({ type: 'output_audio_buffer.clear' });
    if (this.responseOpen) this.send({ type: 'response.cancel' });
    this.responseOpen = false;
    this.openResponseId = null;
    if (this.speaking) {
      this.speaking = false;
      stopSpeechEnvelope();
      this.runtime?.emit({ type: 'voice.speaking', active: false });
    }
    this.note(reason);
    this.finishTurn();
  }

  sendText(text: string): boolean {
    if (!this.live || !this.dc || this.dc.readyState !== 'open') return false;
    this.interrupt();
    this.armIdle();
    this.outstanding = true;
    this.note('text.sent', text.slice(0, 60));
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    this.send({ type: 'response.create' });
    this.runtime?.emit({ type: 'voice.thinking' });
    return true;
  }

  /** The microphone, attached to the open call. Asked for here, inside the tap, never earlier. */
  private async attachMic(h: VoiceHandlers) {
    const gen = this.generation;
    if (!this.mic) {
      const tap = Date.now();
      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        h.onError({ code: name === 'NotAllowedError' || name === 'SecurityError' ? 'MIC_DENIED' : 'UNSUPPORTED', message: name });
        return;
      }
      if (gen !== this.generation || !this.live) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      this.mic = mic;
      this.note('mic.granted', `${Date.now() - tap} ms`);
      const track = mic.getAudioTracks()[0] ?? null;
      try {
        if (this.sender) await this.sender.replaceTrack(track);
        else if (this.pc && track) this.sender = this.pc.addTrack(track, mic);
      } catch (e) {
        this.note('mic.attach.failed', e instanceof Error ? e.message : 'replaceTrack');
        h.onError({ code: 'NETWORK', message: 'attach' });
        return;
      }
      void startMeter(mic, { own: false });
    }
    this.setMicEnabled(true);
    this.hearing = true;
    this.armIdle();
    this.pushContext(true);
    h.onStart();
  }

  private async connect() {
    if (!this.runtime) {
      this.lastError = { code: 'UNSUPPORTED', message: 'no runtime' };
      return;
    }
    // an abort during the handshake bumps the generation; every step below checks it and lets go
    const gen = ++this.generation;
    const cancelled = () => gen !== this.generation;
    this.lastError = null;
    const started = Date.now();

    let token: TokenResponse;
    try {
      const res = await fetch('/api/concierge/realtime-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context: this.runtime.context() }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`token ${res.status}`);
      token = (await res.json()) as TokenResponse;
    } catch (e) {
      if (cancelled()) return;
      this.lastError = { code: 'UNSUPPORTED', message: e instanceof Error ? e.message : 'token' };
      this.failedAt = Date.now();
      this.note('token.failed', this.lastError.message);
      // why the realtime tier is not answering, on the record before the ladder steps down
      this.runtime.emit({ type: 'turn.trace', turnId: 'voice', trace: { rung: 'realtime', fallback: `token: ${this.lastError.message}` } });
      return;
    }
    if (cancelled()) return;
    // the browser and the server share the module the instructions live in; the local copy is
    // the one refreshed behind the context block, so a harness against an older deployment
    // still speaks the current words
    this.baseInstructions = VOICE_INSTRUCTIONS;
    this.note('token', `${token.model} · ${Date.now() - started} ms`);

    try {
      const pc = new RTCPeerConnection();
      this.pc = pc;
      const remote = document.createElement('audio');
      remote.autoplay = true;
      remote.setAttribute('playsinline', '');
      this.remote = remote;
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!stream) return;
        remote.srcObject = stream;
        void remote.play().catch(() => undefined);
        this.meterRemote(stream);
      };
      // the microphone comes later, inside the tap: the call is opened with an empty seat for it
      const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      this.sender = transceiver.sender;
      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;
      dc.onmessage = (ev) => {
        try {
          this.onEvent(JSON.parse(String(ev.data)) as RealtimeEvent);
        } catch {
          /* a frame that is not JSON is not an event */
        }
      };
      dc.onclose = () => this.teardown('channel');
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.teardown(pc.connectionState);
      };

      const offer = await pc.createOffer();
      if (cancelled()) throw new Error('aborted');
      await pc.setLocalDescription(offer);
      const sdp = await fetch(token.callsUrl, {
        method: 'POST',
        body: offer.sdp,
        headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/sdp' },
        signal: AbortSignal.timeout(12_000),
      });
      if (cancelled()) throw new Error('aborted');
      if (!sdp.ok) throw new Error(`calls ${sdp.status}`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
      if (cancelled()) throw new Error('aborted');

      await new Promise<void>((resolve, reject) => {
        if (dc.readyState === 'open') return resolve();
        const timer = window.setTimeout(() => reject(new Error('channel timeout')), 12_000);
        const settle = (err?: Error) => {
          window.clearTimeout(timer);
          this.settleOpen = null;
          if (err) reject(err);
          else resolve();
        };
        this.settleOpen = settle;
        dc.onopen = () => settle();
        dc.onerror = () => settle(new Error('channel error'));
      });
    } catch (e) {
      if (cancelled() || (e instanceof Error && e.message === 'aborted')) {
        // let go quietly: the visitor moved on, and no error belongs to them
        if (!cancelled()) this.teardown('connect');
        return;
      }
      this.teardown('connect');
      this.lastError = { code: 'NETWORK', message: e instanceof Error ? e.message : 'connect' };
      this.failedAt = Date.now();
      this.note('connect.failed', this.lastError.message);
      this.runtime.emit({ type: 'turn.trace', turnId: 'voice', trace: { rung: 'realtime', fallback: `connect: ${this.lastError.message}` } });
      return;
    }

    this.live = true;
    this.note('live', `${Date.now() - started} ms`);
    this.unsubscribe.push(this.runtime.subscribe(() => this.scheduleContext()));
    this.runtime.emit({ type: 'voice.session', status: 'live' });
    this.tune();
    this.pushContext(true);
    this.armIdle();
  }

  /**
   * The QA hook: a harness against a deployment whose baked session differs pushes this
   * build's own turn detection, tools and noise reduction over the channel, so a change can
   * be timed before it is deployed. Off unless `window.__wjVoiceTune` is set.
   */
  private tune() {
    if (typeof window === 'undefined' || !window.__wjVoiceTune) return;
    this.send({ type: 'session.update', session: { type: 'realtime', tools: realtimeTools(), audio: { input: { turn_detection: TURN_DETECTION, noise_reduction: NOISE_REDUCTION } } } });
    this.note('tune', TURN_DETECTION.type);
  }

  private teardown(reason: string) {
    const wasLive = this.live;
    this.live = false;
    this.hearing = false;
    this.generation += 1;
    this.connecting = null;
    this.settleOpen?.(new Error('aborted'));
    this.settleOpen = null;
    this.note('teardown', reason);
    if (this.contextTimer) window.clearTimeout(this.contextTimer);
    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    this.contextTimer = null;
    this.idleTimer = null;
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    if (this.dc) this.dc.onopen = this.dc.onclose = this.dc.onerror = this.dc.onmessage = null;
    if (this.pc) this.pc.ontrack = this.pc.onconnectionstatechange = null;
    try {
      this.dc?.close();
    } catch {
      /* already closed */
    }
    this.dc = null;
    try {
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.pc = null;
    this.sender = null;
    this.releaseMic();
    stopMeter();
    this.stopRemoteMeter();
    if (this.remote) {
      this.remote.pause();
      this.remote.srcObject = null;
      this.remote = null;
    }
    this.pending.clear();
    this.answered.clear();
    this.answeredThisResponse = 0;
    this.responseOpen = false;
    this.openResponseId = null;
    if (this.speaking) {
      this.speaking = false;
      this.runtime?.emit({ type: 'voice.speaking', active: false });
    }
    // a sentence the session was answering when it ended is failed, not forgotten: the stage
    // must not stay at "A moment." for a reply that is not coming
    const openTurn = this.turnId;
    const lost = this.outstanding;
    this.turnId = null;
    this.replyText = '';
    this.utteranceId = null;
    this.interim = '';
    this.utterances.clear();
    this.callsThisTurn = 0;
    this.rounds = 0;
    this.turnHadTool = false;
    this.outstanding = false;
    this.lastContext = '';
    if (wasLive) {
      if (openTurn || lost) this.runtime?.emit({ type: 'turn.error', turnId: openTurn ?? uid('t'), message: reason, recoverable: true });
      this.runtime?.emit({ type: 'voice.session', status: 'ended', message: reason });
      this.handlers?.onEnd();
    }
  }

  private releaseMic() {
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    this.hearing = false;
  }

  /** The microphone off the call, the call kept. */
  private restMic() {
    if (!this.mic) return;
    this.note('mic.off');
    stopMeter();
    void this.sender?.replaceTrack(null).catch(() => undefined);
    this.releaseMic();
    // whatever half-sentence the buffer holds is not sent on resume
    this.send({ type: 'input_audio_buffer.clear' });
  }

  private setMicEnabled(on: boolean) {
    this.mic?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
    this.hearing = on && Boolean(this.mic);
    this.note(on ? 'mic.on' : 'mic.muted');
  }

  private armIdle() {
    if (!this.live) return;
    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.teardown('idle'), this.mic ? IDLE_MS : WARM_IDLE_MS);
  }

  private send(event: Record<string, unknown>) {
    if (!this.dc || this.dc.readyState !== 'open') return;
    this.dc.send(JSON.stringify(event));
  }

  // ── context ─────────────────────────────────────────────────────────────
  private scheduleContext() {
    if (!this.live) return;
    if (this.contextTimer) window.clearTimeout(this.contextTimer);
    this.contextTimer = window.setTimeout(() => this.pushContext(false), CONTEXT_DEBOUNCE_MS);
  }

  private pushContext(force: boolean) {
    if (!this.live || !this.runtime) return;
    const block = renderVoiceContext(this.runtime.context());
    if (!force && block === this.lastContext) return;
    this.lastContext = block;
    this.send({ type: 'session.update', session: { type: 'realtime', instructions: withContext(this.baseInstructions, block) } });
    this.note('context', block.slice(0, 80));
  }

  // ── the remote voice, metered so the ring breathes with it ──────────────
  private meterRemote(stream: MediaStream) {
    this.stopRemoteMeter();
    try {
      const ctx = new AudioContext();
      this.meterCtx = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (this.speaking) {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128;
            sum += v * v;
          }
          pulseSpeech(Math.min(1, Math.sqrt(sum / buf.length) * 3.4));
        }
        this.meterRaf = requestAnimationFrame(tick);
      };
      this.meterRaf = requestAnimationFrame(tick);
    } catch {
      /* no analyser: the envelope below still lets the ring move */
    }
  }

  private stopRemoteMeter() {
    if (this.meterRaf) cancelAnimationFrame(this.meterRaf);
    this.meterRaf = 0;
    if (this.meterCtx && this.meterCtx.state !== 'closed') void this.meterCtx.close();
    this.meterCtx = null;
    stopSpeechEnvelope();
  }

  // ── events ──────────────────────────────────────────────────────────────
  private onEvent(e: RealtimeEvent) {
    const rt = this.runtime;
    const h = this.handlers;
    if (!rt) return;
    switch (e.type) {
      case 'session.created':
      case 'session.updated':
        break;

      case 'input_audio_buffer.speech_started': {
        this.note('speech.started', typeof e.audio_start_ms === 'number' ? `${e.audio_start_ms}` : undefined);
        this.armIdle();
        // the visitor speaks over the reply, or over an action still running: what was in flight is over
        if (this.speaking || this.responseOpen || this.running > 0 || this.turnId) {
          this.supersede('barge-in');
          rt.emit({ type: 'voice.transcript', text: '', final: false });
          rt.emit({ type: 'voice.listening', active: true });
        }
        this.interim = '';
        break;
      }

      case 'input_audio_buffer.speech_stopped': {
        this.note('speech.stopped', typeof e.audio_end_ms === 'number' ? `${e.audio_end_ms}` : undefined);
        this.outstanding = true;
        this.armIdle();
        this.utteranceId = uid('v');
        if (typeof e.item_id === 'string') this.utterances.set(e.item_id, this.utteranceId);
        if (this.utterances.size > 12) this.utterances.delete(this.utterances.keys().next().value!);
        rt.emit({ type: 'voice.utterance', id: this.utteranceId, text: this.interim || '…', final: false });
        h?.onTranscribing?.();
        rt.emit({ type: 'voice.thinking' });
        break;
      }

      case 'conversation.item.input_audio_transcription.delta': {
        this.interim += String(e.delta ?? '');
        h?.onInterim(romaniseDevanagari(this.interim));
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        // kept for the conversation, the tools and the QA view — never shown to a visitor
        const text = romaniseDevanagari(tidy(String(e.transcript ?? '')) || this.interim);
        this.note('heard', text.slice(0, 80));
        this.interim = '';
        const language = scriptOf(text);
        if (language) rt.onLanguage(language);
        h?.onFinal(text, { language });
        const itemId = typeof e.item_id === 'string' ? e.item_id : '';
        let id = this.utterances.get(itemId) ?? this.utteranceId;
        if (!id) {
          id = uid('v');
          rt.emit({ type: 'voice.utterance', id, text: '…', final: false });
        }
        if (itemId) this.utterances.delete(itemId);
        rt.emit({ type: 'voice.utterance', id, text, final: true });
        break;
      }

      case 'conversation.item.input_audio_transcription.failed': {
        this.note('heard.failed');
        // the words are not coming, though the model heard the sentence and answers it
        const partial = this.interim;
        this.interim = '';
        h?.onFinal(partial, {});
        if (this.utteranceId) rt.emit({ type: 'voice.utterance', id: this.utteranceId, text: partial || CONCIERGE.voice.unheard, final: true, lost: !partial });
        break;
      }

      case 'response.created': {
        this.responseOpen = true;
        const response = (e.response ?? {}) as Record<string, unknown>;
        this.openResponseId = typeof response.id === 'string' ? response.id : null;
        this.answeredThisResponse = 0;
        this.outstanding = false;
        this.armIdle();
        if (!this.turnId) {
          this.turnId = uid('t');
          this.replyText = '';
          this.turnHadTool = false;
          this.callsThisTurn = 0;
          this.rounds = 0;
          rt.emit({ type: 'turn.start', turnId: this.turnId });
        } else this.joinReply = Boolean(this.replyText) && !/\s$/.test(this.replyText);
        this.note('response.created');
        break;
      }

      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        if (!this.turnId) break;
        const delta = (this.joinReply ? ' ' : '') + stripBannedPhrases(String(e.delta ?? ''));
        this.joinReply = false;
        if (!this.replyText) this.note('first.delta');
        this.replyText += delta;
        rt.emit({ type: 'text.delta', turnId: this.turnId, delta });
        break;
      }

      case 'output_audio_buffer.started': {
        this.speaking = true;
        this.note('audio.started');
        rt.emit({ type: 'voice.speaking', active: true });
        break;
      }

      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared': {
        if (this.speaking) {
          this.speaking = false;
          this.note(e.type === 'output_audio_buffer.stopped' ? 'audio.stopped' : 'audio.cleared');
          stopSpeechEnvelope();
          rt.emit({ type: 'voice.speaking', active: false });
        }
        break;
      }

      /**
       * The action starts here — the moment the arguments are complete — not at the end of
       * the response. The output goes back as soon as the page has acted, and the model is
       * asked to continue once its own response has closed.
       */
      case 'response.function_call_arguments.done': {
        this.queueCall(String(e.call_id ?? ''), String(e.name ?? ''), String(e.arguments ?? '{}'), String(e.response_id ?? this.openResponseId ?? ''));
        break;
      }

      case 'response.output_item.done': {
        const item = (e.item ?? {}) as Record<string, unknown>;
        if (item.type === 'function_call') this.queueCall(String(item.call_id ?? ''), String(item.name ?? ''), String(item.arguments ?? '{}'), String(e.response_id ?? this.openResponseId ?? ''));
        break;
      }

      case 'response.done': {
        this.responseOpen = false;
        this.openResponseId = null;
        const response = (e.response ?? {}) as Record<string, unknown>;
        this.note('response.done', String(response.status ?? ''));
        if (response.status === 'failed') {
          // the provider could not answer: said as an error the stage recovers from, never as an empty line
          const details = (response.status_details ?? {}) as Record<string, unknown>;
          this.note('response.failed', JSON.stringify(details).slice(0, 120));
          const turnId = this.turnId ?? uid('t');
          rt.emit({ type: 'turn.trace', turnId, trace: { rung: 'realtime', fallback: `response failed: ${JSON.stringify(details).slice(0, 160)}` } });
          this.turnId = null;
          this.replyText = '';
          this.pending.clear();
          rt.emit({ type: 'turn.error', turnId, message: 'response failed', recoverable: true });
          break;
        }
        // an action still running continues the turn when it lands; otherwise the turn is over
        if (this.running === 0 && this.pending.size === 0) {
          if (this.answeredThisResponse > 0) this.continueTurn();
          else this.finishTurn();
        }
        break;
      }

      case 'error': {
        const err = (e.error ?? {}) as Record<string, unknown>;
        this.note('error', String(err.message ?? err.code ?? ''));
        break;
      }
    }
  }

  /** No more than this many actions answer one sentence — the same budget the text path keeps. */
  private static readonly CALLS_PER_TURN = 4;
  private callsThisTurn = 0;

  private queueCall(callId: string, rawName: string, args: string, responseId: string) {
    const name = REALTIME_TOOL_ALIASES[rawName] ?? rawName;
    if (!callId || !name || this.answered.has(callId) || this.pending.has(callId)) return;
    const call: PendingCall = { callId, name, args, responseId };
    this.pending.set(callId, call);
    this.note('tool.queued', name);
    void this.runCall(call);
  }

  /** One call through the validator and the page, then the output back; the continuation follows the response's close. */
  private async runCall(call: PendingCall) {
    const rt = this.runtime;
    if (!rt) return;
    this.pending.delete(call.callId);
    this.answered.add(call.callId);
    const epoch = this.epoch;
    this.callsThisTurn += 1;
    if (this.callsThisTurn > RealtimeVoiceAdapter.CALLS_PER_TURN) {
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ error: 'TOOL_BUDGET', message: 'no more actions for this sentence; answer with what you have' }) } });
      this.answeredThisResponse += 1;
      this.maybeContinue();
      return;
    }
    this.running += 1;
    this.turnHadTool = true;
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(call.args) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      /* unreadable arguments: the validator will refuse an empty object where fields are required */
    }
    const turnId = this.turnId ?? uid('t');
    this.turnId = turnId;
    this.note('tool.start', call.name);
    rt.emit({ type: 'tool.call', turnId, callId: call.callId, name: call.name as ToolName, args });
    try {
      const outcome = await rt.executeTool(call.name as ToolName, args);
      // an action that finished after the visitor moved on reaches the conversation, not the stage
      const stale = this.epoch !== epoch;
      if (!stale) rt.emit({ type: 'tool.result', turnId, callId: call.callId, outcome });
      this.note(stale ? 'tool.stale' : 'tool.visible', `${call.name}${outcome.label ? ` — ${outcome.label}` : ''}`);
      const output = JSON.stringify(outcome.result ?? {}).slice(0, 4000);
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output } });
    } catch (err) {
      if (this.epoch === epoch) rt.emit({ type: 'tool.error', turnId, callId: call.callId, message: err instanceof Error ? err.message : 'tool' });
      this.note('tool.failed', call.name);
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ error: 'TOOL_FAILED', message: 'the page could not do that; say so in one sentence and offer what the visitor can do instead' }) } });
    } finally {
      this.running -= 1;
    }
    if (this.epoch !== epoch) return;
    this.answeredThisResponse += 1;
    this.maybeContinue();
  }

  /** The model continues only once every call of the closed response is answered. */
  private maybeContinue() {
    if (this.responseOpen || this.running > 0 || this.pending.size > 0) return;
    this.continueTurn();
  }

  private continueTurn() {
    if (!this.live) return;
    this.answeredThisResponse = 0;
    this.rounds += 1;
    this.responseOpen = true;
    // after three rounds of actions the model answers with what it has; it may not act again
    this.send(this.rounds >= 3 || this.callsThisTurn >= RealtimeVoiceAdapter.CALLS_PER_TURN ? { type: 'response.create', response: { tool_choice: 'none' } } : { type: 'response.create' });
    this.note('continue');
    this.pushContext(true);
  }

  private finishTurn() {
    const rt = this.runtime;
    const turnId = this.turnId;
    if (!rt || !turnId || !this.live) return;
    const text = tidy(this.replyText);
    rt.emit({ type: 'turn.trace', turnId, trace: { rung: 'realtime', tool: this.turnHadTool ? 'called' : undefined, note: `${this.callsThisTurn} call(s), ${this.rounds} continuation(s)` } });
    rt.emit({ type: 'text.done', turnId, text });
    rt.emit({ type: 'turn.done', turnId });
    this.note('turn.done', text.slice(0, 80));
    this.turnId = null;
    this.replyText = '';
    this.joinReply = false;
    this.utteranceId = null;
    this.armIdle();
  }
}

let engine: RealtimeVoiceAdapter | null = null;

/** One session per page, reused across turns and routes; registered with the seam on load. */
export function registerRealtimeEngine() {
  registerVoiceEngine(() => {
    if (!engine) engine = new RealtimeVoiceAdapter();
    return engine;
  });
}

export const realtimeTrace = () => engine?.trace ?? [];
/** A mark on the same timeline the adapter keeps, from the controller (the tap, the stage's states). */
export const realtimeMark = (type: string, detail?: string) => engine?.note(type, detail);

declare global {
  interface Window {
    __wjVoiceTrace?: () => TraceEntry[];
    /** QA only: push this build's session settings over the channel — see `RealtimeVoiceAdapter.tune`. */
    __wjVoiceTune?: boolean;
  }
}
