'use client';

import { registerVoiceEngine } from './engine';
import { pulseSpeech, startMeter, stopMeter, stopSpeechEnvelope } from './meter';
import { isDirectRealtimeTool, withVoiceContext } from './realtimePrompt';
import { loadIndex } from '@/data/clientIndex';
import { stripBannedPhrases } from '../register';
import { fold, languageOf, romanEvidence, scriptsIn, tokenize, type Language } from '../nlu/script';
import { useConciergeStore } from '@/state/conciergeStore';
import type { VoiceAdapter, VoiceHandlers, VoiceSessionRuntime } from './adapters';
import type { ToolName } from '../types';

interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

interface RealtimeSessionAnswer {
  model: string;
  voice: string;
  sdp: string;
}

interface PendingCall {
  callId: string;
  name: string;
  arguments: string;
}

/** A cheap, bounded timeline read only by the QA harness. */
export interface TraceEntry {
  t: number;
  type: string;
  detail?: string;
}

export interface VoiceAudit {
  streams: number;
  liveTracks: () => number;
  peerConnections: number;
  openPeerConnections: () => number;
  sessions: number;
  sessionOpen: () => boolean;
}

const TRACE_MAX = 400;
const IDLE_MS = 60_000;
const CONTEXT_DEBOUNCE_MS = 250;
const RESPONSE_WATCHDOG_MS = 2_200;
const RESPONSE_ACK_TIMEOUT_MS = 5_000;
const TOOL_RESULT_MAX_CHARS = 3_000;
// Simple requests resolve with one action. Keep a small sequential budget for
// a compound request whose next action depends on the grounded first result.
// The session itself disables parallel calls.
const MAX_TOOL_CALLS_PER_TURN = 4;
const CATALOGUE_TOOLS = new Set<ToolName>([
  'searchProducts',
  'openProduct',
  'refineResults',
  'showSimilarPieces',
  'showMatchingPieces',
  'comparePieces',
  'getProductFacts',
]);

let counter = 0;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;
const tidy = (text: string) => stripBannedPhrases(text.replace(/[*_#`]+/g, '').replace(/!+/g, '.')).replace(/\s+/g, ' ').trim();

export function realtimeSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

/**
 * Preserve a substantive language across terse follow-ups without routing the request through
 * the retired multi-stage parser. This is language bookkeeping only; gpt-realtime selects and
 * calls every voice tool itself.
 */
function rememberVoiceLanguage(text: string): Language | null {
  const store = useConciergeStore.getState();
  const prior = store.memory.language;
  const normal = fold(text);
  const tokens = tokenize(normal);
  if (!tokens.length) return prior;
  const evidence = romanEvidence(tokens);
  const scripts = scriptsIn(text);
  const detected = languageOf(
    text,
    { romanUrdu: evidence === 'urdu' || evidence === 'shared', romanPunjabi: evidence === 'punjabi', punjabi: evidence === 'punjabi' },
    scripts,
  );
  let language: Language = detected;
  if (detected === 'mixed') {
    if (scripts.includes('gurmukhi')) language = 'pa-Guru';
    else if (scripts.includes('arabic')) language = prior === 'pa-Arab' || prior === 'pa-Latn' ? 'pa-Arab' : 'ur';
    else language = prior ?? 'ur-Latn';
  } else if (detected === 'ur-Latn' && evidence === 'shared' && prior === 'pa-Latn') {
    language = 'pa-Latn';
  } else if (detected === 'en' && prior && (tokens.length <= 2 || (tokens.length <= 3 && prior !== 'en'))) {
    // “Doosra.” and “Actually MM Alam.” have no independent language of their own.
    language = prior;
  }
  if (language !== prior) store.rememberLanguage(language);
  return language;
}

function serialiseToolResult(value: unknown) {
  try {
    return JSON.stringify(value ?? {}).slice(0, TOOL_RESULT_MAX_CHARS);
  } catch {
    return JSON.stringify({ error: 'TOOL_RESULT_UNSERIALISABLE' });
  }
}

/**
 * The premium path, without a delegation/router/output-drain layer:
 * microphone → WebRTC → gpt-realtime-2.1 → direct Waseem function → same session reply.
 */
export class RealtimeVoiceAdapter implements VoiceAdapter {
  readonly kind = 'realtime' as const;

  private runtime: VoiceSessionRuntime | null = null;
  private handlers: VoiceHandlers | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private remote: HTMLAudioElement | null = null;
  private meterContext: AudioContext | null = null;
  private meterFrame = 0;
  private live = false;
  private connecting: Promise<void> | null = null;
  private generation = 0;
  private idleTimer: number | null = null;
  private contextTimer: number | null = null;
  private lastContext = '';
  private unsubscribe: (() => void)[] = [];

  private turnId: string | null = null;
  private replyText = '';
  private joinReply = false;
  private responseOpen = false;
  /** A client response request sent but not yet acknowledged with response.created. */
  private responseRequested = false;
  private responseWatchdog: number | null = null;
  private responseAckTimer: number | null = null;
  private speaking = false;
  private interim = '';
  private utteranceId: string | null = null;
  private utteranceByItem = new Map<string, string>();
  private pending = new Map<string, PendingCall>();
  private answered = new Set<string>();
  private toolsThisTurn: string[] = [];
  private callsThisTurn = 0;
  private running = 0;
  private epoch = 0;

  private auditCounts = { streams: 0, peerConnections: 0, sessions: 0 };
  readonly trace: TraceEntry[] = [];

  get audit(): VoiceAudit {
    return {
      ...this.auditCounts,
      liveTracks: () => this.mic?.getAudioTracks().filter((track) => track.readyState === 'live').length ?? 0,
      openPeerConnections: () => (this.pc && this.pc.connectionState !== 'closed' ? 1 : 0),
      sessionOpen: () => this.live,
    };
  }

  isSupported() {
    return realtimeSupported();
  }

  isLive() {
    return this.live;
  }

  isHearing() {
    return Boolean(this.live && this.mic?.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled));
  }

  bind(runtime: VoiceSessionRuntime) {
    this.runtime = runtime;
  }

  /** Controller-side timeline mark; it does not create or affect a Realtime session. */
  mark(type: string, detail?: string) {
    this.note(type, detail);
  }

  private note(type: string, detail?: string) {
    this.trace.push({ t: Date.now(), type, detail });
    if (this.trace.length > TRACE_MAX) this.trace.splice(0, this.trace.length - TRACE_MAX);
  }

  async start(handlers: VoiceHandlers) {
    this.handlers = handlers;
    if (this.live) {
      this.setMicEnabled(true);
      this.armIdle();
      handlers.onStart();
      return;
    }
    if (this.connecting) {
      await this.connecting;
      return;
    }
    this.connecting = this.connect(handlers).finally(() => {
      this.connecting = null;
    });
    await this.connecting;
  }

  /** Resting the mic retains the one active conversation until the short idle timeout. */
  stop() {
    if (!this.live) return;
    this.setMicEnabled(false);
    this.handlers?.onEnd();
    this.armIdle();
  }

  abort() {
    this.teardown('abort');
  }

  interrupt() {
    if (!this.live) return;
    this.supersede('interrupt');
  }

  async close() {
    this.teardown('close');
  }

  sendText(text: string): boolean {
    if (!this.live || !this.isChannelOpen()) return false;
    this.supersede('typed-interrupt');
    rememberVoiceLanguage(text);
    this.armIdle();
    this.note('text.sent', text.slice(0, 80));
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    this.requestResponse('typed');
    this.runtime?.emit({ type: 'voice.thinking' });
    return true;
  }

  private async connect(handlers: VoiceHandlers) {
    const runtime = this.runtime;
    if (!runtime) {
      handlers.onError({ code: 'UNSUPPORTED', message: 'no concierge runtime' });
      return;
    }
    const generation = ++this.generation;
    const cancelled = () => generation !== this.generation;

    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (error) {
      if (cancelled()) return;
      const name = error instanceof Error ? error.name : '';
      handlers.onError({ code: name === 'NotAllowedError' || name === 'SecurityError' ? 'MIC_DENIED' : 'UNSUPPORTED', message: name || 'microphone unavailable' });
      return;
    }
    if (cancelled()) {
      mic.getTracks().forEach((track) => track.stop());
      return;
    }
    this.mic = mic;
    this.auditCounts.streams += 1;

    try {
      const pc = new RTCPeerConnection();
      this.pc = pc;
      this.auditCounts.peerConnections += 1;
      const remote = document.createElement('audio');
      remote.autoplay = true;
      remote.setAttribute('playsinline', '');
      this.remote = remote;
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        remote.srcObject = stream;
        void remote.play().catch(() => undefined);
        this.meterRemote(stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.teardown(pc.connectionState);
      };

      const track = mic.getAudioTracks()[0];
      if (track) pc.addTrack(track, mic);
      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;
      dc.onmessage = (event) => {
        try {
          this.onEvent(JSON.parse(String(event.data)) as RealtimeEvent);
        } catch {
          /* A non-JSON data-channel frame is not an application event. */
        }
      };
      dc.onclose = () => this.teardown('channel');

      const offer = await pc.createOffer();
      if (cancelled()) throw new Error('aborted');
      await pc.setLocalDescription(offer);
      if (cancelled()) throw new Error('aborted');
      const response = await fetch('/api/concierge/realtime-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sdp: offer.sdp, context: runtime.context() }),
        signal: AbortSignal.timeout(15_000),
      });
      let answer: RealtimeSessionAnswer | null = null;
      let failure: { error?: { message?: unknown } } | null = null;
      try {
        const payload = (await response.json()) as unknown;
        if (payload && typeof payload === 'object' && typeof (payload as { sdp?: unknown }).sdp === 'string') answer = payload as RealtimeSessionAnswer;
        else if (payload && typeof payload === 'object') failure = payload as { error?: { message?: unknown } };
      } catch {
        /* The status below is still enough to diagnose a bad session answer. */
      }
      if (!response.ok || !answer?.sdp) {
        const message = typeof failure?.error?.message === 'string'
          ? failure.error.message
          : `Realtime session ${response.status}`;
        throw new Error(message);
      }
      if (cancelled()) throw new Error('aborted');
      this.note('session.answer', answer.model);
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      if (cancelled()) throw new Error('aborted');
      await new Promise<void>((resolve, reject) => {
        if (dc.readyState === 'open') return resolve();
        const timer = window.setTimeout(() => reject(new Error('data channel timeout')), 12_000);
        dc.onopen = () => {
          window.clearTimeout(timer);
          resolve();
        };
        dc.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('data channel error'));
        };
      });
    } catch (error) {
      if (cancelled() || (error instanceof Error && error.message === 'aborted')) return;
      this.teardown('connect');
      handlers.onError({ code: 'NETWORK', message: error instanceof Error ? error.message : 'connection failed' });
      return;
    }

    if (cancelled()) {
      this.teardown('abort');
      return;
    }
    this.live = true;
    this.auditCounts.sessions += 1;
    this.note('session.live');
    this.unsubscribe.push(runtime.subscribe(() => this.scheduleContext()));
    void startMeter(mic, { own: false });
    runtime.emit({ type: 'voice.session', status: 'live' });
    this.pushContext(true);
    this.armIdle();
    handlers.onStart();
  }

  private isChannelOpen() {
    return Boolean(this.dc && this.dc.readyState === 'open');
  }

  private send(event: Record<string, unknown>) {
    if (!this.isChannelOpen()) return;
    this.dc!.send(JSON.stringify(event));
  }

  private clearResponseWatchdog() {
    if (this.responseWatchdog !== null) window.clearTimeout(this.responseWatchdog);
    this.responseWatchdog = null;
  }

  private clearResponseAcknowledgement() {
    if (this.responseAckTimer !== null) window.clearTimeout(this.responseAckTimer);
    this.responseAckTimer = null;
  }

  /** One deduplicated same-session response request; it never creates a connection. */
  private requestResponse(reason: string, response?: Record<string, unknown>) {
    if (!this.live || !this.isChannelOpen() || this.responseOpen || this.responseRequested) return false;
    this.responseRequested = true;
    this.note('response.create', reason);
    this.send({ type: 'response.create', ...(response ? { response } : {}) });
    this.clearResponseAcknowledgement();
    const epoch = this.epoch;
    this.responseAckTimer = window.setTimeout(() => {
      this.responseAckTimer = null;
      if (epoch !== this.epoch || !this.live || !this.responseRequested || this.responseOpen) return;
      // Do not retry or reconnect here: one unanswered response request is an actual session
      // failure. Settle the stage so it never remains indefinitely in LISTENING/THINKING.
      this.responseRequested = false;
      const turnId = this.turnId ?? uid('t');
      this.note('response.unacknowledged', reason);
      this.clearTurn();
      this.runtime?.emit({ type: 'turn.error', turnId, message: 'Realtime did not acknowledge the response request', recoverable: true });
    }, RESPONSE_ACK_TIMEOUT_MS);
    return true;
  }

  /**
   * Semantic VAD normally creates a response. If it has committed a real transcript but the
   * session has neither started a response nor a tool, make one guarded request on this same
   * data channel. This is deliberately not a retry, reconnect, or second speech path.
   */
  private armResponseWatchdog() {
    this.clearResponseWatchdog();
    const epoch = this.epoch;
    this.responseWatchdog = window.setTimeout(() => {
      this.responseWatchdog = null;
      if (epoch !== this.epoch || !this.live || this.responseOpen || this.responseRequested || this.running > 0 || this.pending.size > 0 || this.turnId) return;
      if (this.requestResponse('vad-watchdog')) this.note('response.recover', 'committed transcript without response');
    }, RESPONSE_WATCHDOG_MS);
  }

  private setMicEnabled(enabled: boolean) {
    this.mic?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    if (!enabled) this.send({ type: 'input_audio_buffer.clear' });
    this.note(enabled ? 'mic.on' : 'mic.off');
  }

  private armIdle() {
    if (!this.live) return;
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.teardown('idle'), IDLE_MS);
  }

  private scheduleContext() {
    if (!this.live) return;
    if (this.contextTimer !== null) window.clearTimeout(this.contextTimer);
    this.contextTimer = window.setTimeout(() => this.pushContext(false), CONTEXT_DEBOUNCE_MS);
  }

  private pushContext(force: boolean) {
    if (!this.live || !this.runtime) return;
    const instructions = withVoiceContext(this.runtime.context());
    if (!force && instructions === this.lastContext) return;
    this.lastContext = instructions;
    this.send({ type: 'session.update', session: { type: 'realtime', instructions } });
    this.note('context', instructions.slice(-100));
  }

  private meterRemote(stream: MediaStream) {
    this.stopRemoteMeter();
    try {
      const context = new AudioContext();
      this.meterContext = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (this.speaking) {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const value = (samples[index]! - 128) / 128;
            sum += value * value;
          }
          pulseSpeech(Math.min(1, Math.sqrt(sum / samples.length) * 3.4));
        }
        this.meterFrame = requestAnimationFrame(tick);
      };
      this.meterFrame = requestAnimationFrame(tick);
    } catch {
      /* State events still drive the speaking indicator when an analyser is unavailable. */
    }
  }

  private stopRemoteMeter() {
    if (this.meterFrame) cancelAnimationFrame(this.meterFrame);
    this.meterFrame = 0;
    if (this.meterContext && this.meterContext.state !== 'closed') void this.meterContext.close();
    this.meterContext = null;
    stopSpeechEnvelope();
  }

  private onEvent(event: RealtimeEvent) {
    const runtime = this.runtime;
    const handlers = this.handlers;
    if (!runtime || !handlers) return;

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        this.note(event.type);
        break;

      case 'input_audio_buffer.speech_started': {
        this.armIdle();
        this.clearResponseWatchdog();
        if (this.speaking || this.responseOpen || this.responseRequested || this.running > 0 || this.turnId) this.supersede('barge-in');
        this.interim = '';
        this.utteranceId = null;
        runtime.emit({ type: 'voice.listening', active: true });
        this.note('speech.started');
        break;
      }

      case 'input_audio_buffer.speech_stopped': {
        this.armIdle();
        const id = uid('v');
        this.utteranceId = id;
        const itemId = typeof event.item_id === 'string' ? event.item_id : '';
        if (itemId) this.utteranceByItem.set(itemId, id);
        if (this.utteranceByItem.size > 12) this.utteranceByItem.delete(this.utteranceByItem.keys().next().value!);
        runtime.emit({ type: 'voice.utterance', id, text: this.interim || '…', final: false });
        runtime.emit({ type: 'voice.thinking' });
        this.note('speech.stopped');
        // Semantic VAD normally creates the response itself. Start the bounded guard at the
        // committed audio boundary as well as at caption completion: a failed or delayed
        // caption must never strand otherwise valid audio in LISTENING/THINKING.
        this.armResponseWatchdog();
        break;
      }

      case 'conversation.item.input_audio_transcription.delta': {
        this.interim += String(event.delta ?? '');
        handlers.onInterim(this.interim);
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const text = tidy(String(event.transcript ?? '') || this.interim);
        this.interim = '';
        const itemId = typeof event.item_id === 'string' ? event.item_id : '';
        const id = (itemId ? this.utteranceByItem.get(itemId) : undefined) ?? this.utteranceId ?? uid('v');
        if (itemId) this.utteranceByItem.delete(itemId);
        // Captions are observability only. The Realtime model hears the original audio and
        // remains the sole chooser/executor of tools; this text never enters a planner.
        if (text) rememberVoiceLanguage(text);
        handlers.onFinal(text);
        runtime.emit({ type: 'voice.utterance', id, text: text || '…', final: true, ...(text ? {} : { lost: true }) });
        this.note('transcript.completed', text.slice(0, 100));
        if (text) this.armResponseWatchdog();
        break;
      }

      case 'conversation.item.input_audio_transcription.failed': {
        const id = this.utteranceId ?? uid('v');
        handlers.onFinal(this.interim);
        runtime.emit({ type: 'voice.utterance', id, text: this.interim || '…', final: true, lost: !this.interim });
        this.interim = '';
        this.note('heard.failed');
        break;
      }

      case 'response.created':
        this.responseOpen = true;
        this.responseRequested = false;
        this.clearResponseAcknowledgement();
        this.clearResponseWatchdog();
        this.armIdle();
        if (!this.turnId) {
          this.turnId = uid('t');
          this.replyText = '';
          this.joinReply = false;
          this.callsThisTurn = 0;
          this.toolsThisTurn = [];
          runtime.emit({ type: 'turn.start', turnId: this.turnId });
          runtime.emit({ type: 'turn.trace', turnId: this.turnId, trace: { rung: 'realtime', note: 'gpt-realtime-2.1 direct tools' } });
        } else {
          this.joinReply = Boolean(this.replyText) && !/\s$/.test(this.replyText);
        }
        this.note('response.created');
        break;

      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        if (!this.turnId) break;
        const delta = `${this.joinReply ? ' ' : ''}${stripBannedPhrases(String(event.delta ?? ''))}`;
        this.joinReply = false;
        if (!this.replyText) this.note('first.reply');
        this.replyText += delta;
        runtime.emit({ type: 'text.delta', turnId: this.turnId, delta });
        break;
      }

      case 'output_audio_buffer.started':
        if (!this.speaking) {
          this.speaking = true;
          runtime.emit({ type: 'voice.speaking', active: true });
          this.note('audio.started');
        }
        break;

      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        if (this.speaking) {
          this.speaking = false;
          stopSpeechEnvelope();
          runtime.emit({ type: 'voice.speaking', active: false });
          this.note(event.type);
        }
        break;

      case 'response.function_call_arguments.done':
        this.note('function.arguments.completed', String(event.name ?? 'unknown'));
        this.queueCall(String(event.call_id ?? ''), String(event.name ?? ''), String(event.arguments ?? '{}'));
        break;

      case 'response.output_item.done': {
        const item = event.item && typeof event.item === 'object' ? (event.item as Record<string, unknown>) : null;
        if (item?.type === 'function_call') {
          this.note('function.call.completed', String(item.name ?? 'unknown'));
          this.queueCall(String(item.call_id ?? ''), String(item.name ?? ''), String(item.arguments ?? '{}'));
        }
        break;
      }

      case 'response.done': {
        this.responseOpen = false;
        this.responseRequested = false;
        this.clearResponseAcknowledgement();
        const response = event.response && typeof event.response === 'object' ? (event.response as Record<string, unknown>) : {};
        const output = Array.isArray(response.output) ? response.output : [];
        for (const item of output) {
          if (!item || typeof item !== 'object') continue;
          const call = item as Record<string, unknown>;
          if (call.type === 'function_call') {
            this.note('function.call.completed', String(call.name ?? 'unknown'));
            this.queueCall(String(call.call_id ?? ''), String(call.name ?? ''), String(call.arguments ?? '{}'));
          }
        }
        this.note('response.done', String(response.status ?? 'completed'));
        if (response.status === 'failed') {
          const turnId = this.turnId;
          this.clearTurn();
          if (turnId) runtime.emit({ type: 'turn.error', turnId, message: 'Realtime response failed', recoverable: true });
          break;
        }
        if (this.pending.size) void this.drainCalls();
        else if (this.running === 0) this.finishTurn();
        break;
      }

      case 'error': {
        const error = event.error && typeof event.error === 'object' ? (event.error as Record<string, unknown>) : {};
        this.responseRequested = false;
        this.clearResponseAcknowledgement();
        this.clearResponseWatchdog();
        this.note('realtime.error', `${String(error.code ?? event.type)}: ${String(error.message ?? 'Realtime error')}`.slice(0, 220));
        break;
      }
    }
  }

  private queueCall(callId: string, name: string, argumentsText: string) {
    if (!callId || this.answered.has(callId) || this.pending.has(callId)) return;
    this.pending.set(callId, { callId, name, arguments: argumentsText });
    this.note('function.call.created', name);
  }

  /** Every function call receives one observable same-session output, including validation failures. */
  private sendFunctionOutput(callId: string, output: unknown, detail: string) {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output: serialiseToolResult(output) },
    });
    this.note('function.output.sent', detail);
  }

  /** Send each grounded result to its exact Realtime call id, then let the session continue or reply. */
  private async drainCalls() {
    const runtime = this.runtime;
    if (!runtime || !this.pending.size) return;
    const epoch = this.epoch;
    const calls = [...this.pending.values()];
    this.pending.clear();
    let answeredAny = false;

    for (const call of calls) {
      this.answered.add(call.callId);
      if (!isDirectRealtimeTool(call.name)) {
        this.sendFunctionOutput(call.callId, { error: 'TOOL_UNKNOWN' }, call.name);
        answeredAny = true;
        continue;
      }
      this.callsThisTurn += 1;
      if (this.callsThisTurn > MAX_TOOL_CALLS_PER_TURN) {
        this.sendFunctionOutput(call.callId, { error: 'TOOL_BUDGET', message: 'No more actions for this request; give the visitor the result so far.' }, call.name);
        answeredAny = true;
        continue;
      }
      if (epoch !== this.epoch) {
        this.sendFunctionOutput(call.callId, { error: 'CANCELLED', message: 'The visitor has moved on.' }, call.name);
        continue;
      }

      let args: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(call.arguments) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
      } catch {
        /* The authoritative validator will refuse missing required arguments. */
      }
      const turnId = this.turnId ?? uid('t');
      if (!this.turnId) {
        this.turnId = turnId;
        runtime.emit({ type: 'turn.start', turnId });
      }
      this.running += 1;
      this.toolsThisTurn.push(call.name);
      this.note('tool.start', call.name);
      runtime.emit({ type: 'tool.call', turnId, callId: call.callId, name: call.name as ToolName, args });
      try {
        // open() begins this fetch in the background. A visitor can nevertheless speak
        // before it lands; catalogue tools wait for the same cached index rather than
        // producing a false empty result or rejecting a real ordinal slug.
        if (CATALOGUE_TOOLS.has(call.name as ToolName)) await loadIndex();
        // A new utterance can arrive during that asynchronous index fetch. Do not let the
        // abandoned request act on the page after the visitor has barged in.
        if (epoch !== this.epoch) {
          this.sendFunctionOutput(call.callId, { error: 'CANCELLED', message: 'The visitor has moved on.' }, call.name);
          continue;
        }
        const outcome = await runtime.executeTool(call.name as ToolName, args);
        const stale = epoch !== this.epoch;
        if (!stale) runtime.emit({ type: 'tool.result', turnId, callId: call.callId, outcome });
        if (!stale) this.pushContext(true);
        this.sendFunctionOutput(call.callId, stale ? { error: 'CANCELLED', message: 'The visitor has moved on.' } : outcome.result, call.name);
        this.note(stale ? 'tool.stale' : 'tool.result', call.name);
        answeredAny = true;
      } catch (error) {
        if (epoch === this.epoch) runtime.emit({ type: 'tool.error', turnId, callId: call.callId, message: error instanceof Error ? error.message : 'tool failed' });
        this.sendFunctionOutput(call.callId, { error: 'TOOL_FAILED' }, call.name);
        answeredAny = true;
      } finally {
        this.running -= 1;
      }
    }

    if (epoch !== this.epoch || !this.live) return;
    if (answeredAny) {
      // The page action is grounded. This continuation may issue one needed next action,
      // otherwise it owns the sole spoken result for the completed sequence.
      this.pushContext(true);
      this.requestResponse('tool-result', { tool_choice: 'auto' });
      this.armIdle();
    } else if (this.running === 0) {
      this.finishTurn();
    }
  }

  /** Stop stale output on native interruption; no mute/drain or second speech layer exists. */
  private supersede(reason: string) {
    this.epoch += 1;
    this.clearResponseWatchdog();
    this.clearResponseAcknowledgement();
    this.pending.clear();
    if (this.responseOpen || this.responseRequested) this.send({ type: 'response.cancel' });
    if (this.responseOpen || this.responseRequested || this.speaking) this.send({ type: 'output_audio_buffer.clear' });
    this.responseOpen = false;
    this.responseRequested = false;
    if (this.speaking) {
      this.speaking = false;
      stopSpeechEnvelope();
      this.runtime?.emit({ type: 'voice.speaking', active: false });
    }
    this.finishTurn({ discardReply: true });
    this.note(reason);
  }

  private finishTurn(options: { discardReply?: boolean } = {}) {
    const runtime = this.runtime;
    const turnId = this.turnId;
    if (!runtime || !turnId) return;
    const text = options.discardReply ? '' : tidy(this.replyText);
    runtime.emit({ type: 'text.done', turnId, text });
    runtime.emit({ type: 'turn.trace', turnId, trace: { rung: 'realtime', tool: this.toolsThisTurn.join(',') || undefined, note: 'gpt-realtime-2.1 direct tools' } });
    runtime.emit({ type: 'turn.done', turnId });
    this.note('turn.done', text.slice(0, 100));
    this.clearTurn();
    this.armIdle();
  }

  private clearTurn() {
    this.clearResponseWatchdog();
    this.clearResponseAcknowledgement();
    this.turnId = null;
    this.replyText = '';
    this.joinReply = false;
    this.utteranceId = null;
    this.pending.clear();
    this.answered.clear();
    this.toolsThisTurn = [];
    this.callsThisTurn = 0;
  }

  private releaseMic() {
    this.mic?.getTracks().forEach((track) => track.stop());
    this.mic = null;
  }

  private teardown(reason: string) {
    const wasLive = this.live;
    const openTurn = this.turnId;
    this.live = false;
    this.generation += 1;
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    if (this.contextTimer !== null) window.clearTimeout(this.contextTimer);
    this.idleTimer = null;
    this.contextTimer = null;
    this.clearResponseWatchdog();
    this.clearResponseAcknowledgement();
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.unsubscribe = [];
    if (this.dc) this.dc.onopen = this.dc.onclose = this.dc.onerror = this.dc.onmessage = null;
    if (this.pc) this.pc.ontrack = this.pc.onconnectionstatechange = null;
    try {
      this.dc?.close();
    } catch {
      /* Already closed. */
    }
    this.dc = null;
    try {
      this.pc?.close();
    } catch {
      /* Already closed. */
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
    const wasSpeaking = this.speaking;
    this.speaking = false;
    this.responseOpen = false;
    this.running = 0;
    this.clearTurn();
    this.lastContext = '';
    if (wasSpeaking) this.runtime?.emit({ type: 'voice.speaking', active: false });
    this.note('teardown', reason);
    if (wasLive) {
      if (openTurn) this.runtime?.emit({ type: 'turn.error', turnId: openTurn, message: reason, recoverable: true });
      this.runtime?.emit({ type: 'voice.session', status: 'ended', message: reason });
      this.handlers?.onEnd();
    }
  }
}

let engine: RealtimeVoiceAdapter | null = null;

/** One session adapter per page; it is idle until the visitor explicitly starts voice. */
export function registerRealtimeEngine() {
  registerVoiceEngine(() => {
    if (!engine) engine = new RealtimeVoiceAdapter();
    return engine;
  });
  if (typeof window !== 'undefined') {
    window.__wjVoiceAudit = () =>
      engine
        ? {
            streams: engine.audit.streams,
            liveTracks: engine.audit.liveTracks(),
            peerConnections: engine.audit.peerConnections,
            openPeerConnections: engine.audit.openPeerConnections(),
            sessions: engine.audit.sessions,
            sessionOpen: engine.audit.sessionOpen(),
            speechApisTouched: 0,
          }
        : null;
  }
}

export const realtimeTrace = () => engine?.trace ?? [];
export const realtimeMark = (type: string, detail?: string) => engine?.mark(type, detail);

declare global {
  interface Window {
    __wjVoiceTrace?: () => TraceEntry[];
    __wjVoiceAudit?: () => {
      streams: number;
      liveTracks: number;
      peerConnections: number;
      openPeerConnections: number;
      sessions: number;
      sessionOpen: boolean;
      speechApisTouched: number;
    } | null;
  }
}
