'use client';

import { registerVoiceEngine } from './engine';
import { pulseSpeech, startMeter, stopMeter, stopSpeechEnvelope } from './meter';
import { renderVoiceContext, withContext } from './realtimePrompt';
import type { VoiceAdapter, VoiceHandlers, VoiceSessionRuntime } from './adapters';
import type { ToolName } from '../types';
import { romaniseDevanagari } from '@/lib/romanise';
import { stripBannedPhrases } from '../register';
import { REALTIME_TOOL_ALIASES } from './realtimePrompt';
import { CONCIERGE } from '../copy';

/**
 * The realtime tier: one model that hears, understands and speaks.
 *
 * Everything the browser holds is a ten-minute client secret and a WebRTC call. The
 * microphone track goes up; the voice comes back on a remote track; a data channel carries
 * the events. The permanent credential is minted against on the server and never seen here.
 *
 * It is a *session* adapter: one conversation stays open across turns, so the model keeps
 * its own context, barge-in is the server's voice-activity detector cancelling its own reply,
 * and a typed correction goes into the same conversation as the spoken sentences. The
 * concierge's state machine is driven through the same provider events every other engine
 * emits — the exchange, the tray, the voice stage cannot tell which engine is talking.
 *
 * What it validates itself: every function call passes `executeTool`, which refuses an
 * unknown tool or a slug the catalogue does not carry, exactly as it would for the text model.
 * On this path nothing else will, so it is the only gate — and it is enough.
 */

interface TokenResponse {
  token: string;
  model: string;
  voice: string;
  instructions: string;
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
}

/** A small trace the QA harness reads; cheap enough to keep on. */
export interface TraceEntry {
  t: number;
  type: string;
  detail?: string;
}
const TRACE_MAX = 400;

let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Ended by the visitor's silence: a muted session costs nothing but is torn down after this. */
const IDLE_MS = 4 * 60_000;
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
  private mic: MediaStream | null = null;
  private remote: HTMLAudioElement | null = null;
  private meterCtx: AudioContext | null = null;
  private meterRaf = 0;
  private live = false;
  private connecting: Promise<void> | null = null;
  /** Bumped by every teardown; a connect() that was cancelled mid-handshake sees it and lets go. */
  private generation = 0;
  private settleOpen: ((err: Error) => void) | null = null;
  private rounds = 0;
  /** A sentence has been sent and no reply has finished for it yet. */
  private outstanding = false;
  private baseInstructions = '';
  private lastContext = '';
  private contextTimer: number | null = null;
  private idleTimer: number | null = null;
  private unsubscribe: (() => void)[] = [];

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
  private running = 0;
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

  bind(runtime: VoiceSessionRuntime) {
    this.runtime = runtime;
  }

  private note(type: string, detail?: string) {
    this.trace.push({ t: Date.now(), type, detail });
    if (this.trace.length > TRACE_MAX) this.trace.splice(0, this.trace.length - TRACE_MAX);
  }

  // ── lifecycle ───────────────────────────────────────────────────────────
  async start(h: VoiceHandlers) {
    this.handlers = h;
    if (this.live) {
      // a paused conversation resumes: same session, same context
      this.setMicEnabled(true);
      this.armIdle();
      h.onStart();
      return;
    }
    if (this.connecting) {
      await this.connecting;
      return;
    }
    this.connecting = this.connect(h).finally(() => {
      this.connecting = null;
    });
    await this.connecting;
  }

  /** A tap while listening: the microphone rests, the conversation stays. */
  stop() {
    if (!this.live) return;
    this.setMicEnabled(false);
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
    if (this.responseOpen || this.speaking) {
      this.send({ type: 'output_audio_buffer.clear' });
      this.send({ type: 'response.cancel' });
    }
    this.responseOpen = false;
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

  private async connect(h: VoiceHandlers) {
    if (!this.runtime) {
      h.onError({ code: 'UNSUPPORTED', message: 'no runtime' });
      return;
    }
    // an abort during the handshake bumps the generation; every step below checks it and lets go
    const gen = ++this.generation;
    const cancelled = () => gen !== this.generation;
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      if (cancelled()) return;
      const name = e instanceof Error ? e.name : '';
      h.onError({ code: name === 'NotAllowedError' || name === 'SecurityError' ? 'MIC_DENIED' : 'UNSUPPORTED', message: name });
      return;
    }
    if (cancelled()) {
      mic.getTracks().forEach((t) => t.stop());
      return;
    }
    this.mic = mic;

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
      this.releaseMic();
      h.onError({ code: 'UNSUPPORTED', message: e instanceof Error ? e.message : 'token' });
      return;
    }
    if (cancelled()) {
      this.releaseMic();
      return;
    }
    this.baseInstructions = token.instructions;
    this.note('token', token.model);

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
      const track = mic.getAudioTracks()[0];
      if (track) pc.addTrack(track, mic);
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
      h.onError({ code: 'NETWORK', message: e instanceof Error ? e.message : 'connect' });
      return;
    }

    this.live = true;
    this.note('live');
    this.unsubscribe.push(this.runtime.subscribe(() => this.scheduleContext()));
    void startMeter(mic, { own: false });
    this.runtime.emit({ type: 'voice.session', status: 'live' });
    this.pushContext(true);
    this.armIdle();
    h.onStart();
  }

  private teardown(reason: string) {
    const wasLive = this.live;
    this.live = false;
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
    this.responseOpen = false;
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
      this.runtime?.emit({ type: 'voice.session', status: 'ended' });
      this.handlers?.onEnd();
    }
  }

  private releaseMic() {
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  private setMicEnabled(on: boolean) {
    this.mic?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
    if (on) this.note('mic.on');
    else {
      this.note('mic.off');
      // whatever half-sentence the buffer holds is not sent on resume
      this.send({ type: 'input_audio_buffer.clear' });
    }
  }

  private armIdle() {
    if (!this.live) return;
    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.teardown('idle'), IDLE_MS);
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
    if (!rt || !h) return;
    switch (e.type) {
      case 'session.created':
      case 'session.updated':
        break;

      case 'input_audio_buffer.speech_started': {
        this.note('speech.started');
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
        this.note('speech.stopped');
        this.outstanding = true;
        this.armIdle();
        this.utteranceId = uid('v');
        if (typeof e.item_id === 'string') this.utterances.set(e.item_id, this.utteranceId);
        if (this.utterances.size > 12) this.utterances.delete(this.utterances.keys().next().value!);
        rt.emit({ type: 'voice.utterance', id: this.utteranceId, text: this.interim || '…', final: false });
        h.onTranscribing?.();
        rt.emit({ type: 'voice.thinking' });
        break;
      }

      case 'conversation.item.input_audio_transcription.delta': {
        this.interim += String(e.delta ?? '');
        h.onInterim(romaniseDevanagari(this.interim));
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        // what is shown is Roman where the model wrote Devanagari; Urdu script and English stay as they are
        const text = romaniseDevanagari(tidy(String(e.transcript ?? '')) || this.interim);
        this.note('heard', text.slice(0, 80));
        this.interim = '';
        const language = scriptOf(text);
        if (language) rt.onLanguage(language);
        h.onFinal(text, { language });
        // the words usually land after the sentence ended; if they land first, the line is written now
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
        // the words are not coming, though the model heard the sentence and answers it: the stage
        // stops waiting, and the visitor's line says so rather than standing as three dots to "correct"
        const partial = this.interim;
        this.interim = '';
        h.onFinal(partial, {});
        if (this.utteranceId) rt.emit({ type: 'voice.utterance', id: this.utteranceId, text: partial || CONCIERGE.voice.unheard, final: true, lost: !partial });
        break;
      }

      case 'response.created': {
        this.responseOpen = true;
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

      case 'response.function_call_arguments.done': {
        this.queueCall(String(e.call_id ?? ''), String(e.name ?? ''), String(e.arguments ?? '{}'));
        break;
      }

      case 'response.output_item.done': {
        const item = (e.item ?? {}) as Record<string, unknown>;
        if (item.type === 'function_call') this.queueCall(String(item.call_id ?? ''), String(item.name ?? ''), String(item.arguments ?? '{}'));
        break;
      }

      case 'response.done': {
        this.responseOpen = false;
        const response = (e.response ?? {}) as Record<string, unknown>;
        this.note('response.done', String(response.status ?? ''));
        if (response.status === 'failed') {
          // the provider could not answer: said as an error the stage recovers from, never as an empty line
          const details = (response.status_details ?? {}) as Record<string, unknown>;
          this.note('response.failed', JSON.stringify(details).slice(0, 120));
          const turnId = this.turnId ?? uid('t');
          this.turnId = null;
          this.replyText = '';
          this.pending.clear();
          rt.emit({ type: 'turn.error', turnId, message: 'response failed', recoverable: true });
          break;
        }
        // calls queued from this response are answered first; the next response continues the turn
        void this.drainCalls().then(() => {
          if (this.pending.size === 0 && this.running === 0 && !this.responseOpen) this.finishTurn();
        });
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

  private queueCall(callId: string, rawName: string, args: string) {
    const name = REALTIME_TOOL_ALIASES[rawName] ?? rawName;
    if (!callId || !name || this.answered.has(callId) || this.pending.has(callId)) return;
    this.pending.set(callId, { callId, name, args });
    this.note('tool.queued', name);
  }

  /** Runs the queued calls through the validator and the page, then asks the model to continue. */
  private async drainCalls() {
    const rt = this.runtime;
    if (!rt || this.pending.size === 0) return;
    const epoch = this.epoch;
    const calls = [...this.pending.values()];
    this.pending.clear();
    let answered = false;
    for (const call of calls) {
      this.answered.add(call.callId);
      this.callsThisTurn += 1;
      if (this.callsThisTurn > RealtimeVoiceAdapter.CALLS_PER_TURN) {
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ error: 'TOOL_BUDGET', message: 'no more actions for this sentence; answer with what you have' }) } });
        answered = true;
        continue;
      }
      // the visitor moved on while an earlier action ran: this one never touches the page
      if (this.epoch !== epoch) {
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ error: 'CANCELLED', message: 'the visitor moved on before this ran' }) } });
        continue;
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
      rt.emit({ type: 'tool.call', turnId, callId: call.callId, name: call.name as ToolName, args });
      try {
        const outcome = await rt.executeTool(call.name as ToolName, args);
        // an action that finished after the visitor moved on reaches the conversation, not the stage
        const stale = this.epoch !== epoch;
        if (!stale) rt.emit({ type: 'tool.result', turnId, callId: call.callId, outcome });
        this.note(stale ? 'tool.stale' : 'tool.done', `${call.name}${outcome.label ? ` — ${outcome.label}` : ''}`);
        const output = JSON.stringify(outcome.result ?? {}).slice(0, 4000);
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output } });
        answered = true;
      } catch (err) {
        if (this.epoch === epoch) rt.emit({ type: 'tool.error', turnId, callId: call.callId, message: err instanceof Error ? err.message : 'tool' });
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ error: 'TOOL_FAILED' }) } });
        answered = true;
      } finally {
        this.running -= 1;
      }
    }
    // the sentence these answered is over; the next one has the floor and asks for its own reply
    if (this.epoch !== epoch) return;
    if (answered && this.live) {
      this.rounds += 1;
      this.responseOpen = true;
      // after three rounds of actions the model answers with what it has; it may not act again
      this.send(this.rounds >= 3 || this.callsThisTurn >= RealtimeVoiceAdapter.CALLS_PER_TURN ? { type: 'response.create', response: { tool_choice: 'none' } } : { type: 'response.create' });
      this.pushContext(true);
    }
  }

  private finishTurn() {
    const rt = this.runtime;
    const turnId = this.turnId;
    if (!rt || !turnId || !this.live) return;
    const text = tidy(this.replyText);
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

declare global {
  interface Window {
    __wjVoiceTrace?: () => TraceEntry[];
  }
}
