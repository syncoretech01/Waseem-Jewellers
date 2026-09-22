'use client';

import { registerVoiceEngine } from './engine';
import { pulseSpeech, startMeter, stopMeter, stopSpeechEnvelope } from './meter';
import { RESULT_PREFACE, languageInstruction, renderVoiceContext } from './livePrompt';
import { routeSentence, runDirect, type Route } from './router';
import { runAstra } from './astra';
import { qaMode } from '../qa';
import { buildSiteContext } from '../context';
import { stripBannedPhrases } from '../register';
import type { VoiceAdapter, VoiceHandlers, VoiceSessionRuntime } from './adapters';
import type { ProviderEvent, SiteContext, ToolName, ToolOutcome } from '../types';

/**
 * The premium voice: microphone → WebRTC → GPT-Live → client delegation → our tools → a
 * short spoken reply. Nothing else in between.
 *
 * GPT-Live hears and speaks, full duplex; it decides when to talk and stops when the visitor
 * does. It holds no tools: when the visitor asks for something the page must do, it
 * *delegates* — an event with an id and no words — and this adapter takes the words from the
 * input transcript, runs them through one router (`router.ts`: the deterministic parser for
 * a plain command, the delegation model for a natural sentence), acts through the one tool
 * registry, and hands the outcome back as a terse English fact. GPT-Live says its one to
 * five words in the visitor's language.
 *
 * The site acts before any speech: a plain command is executed the moment a pause in the
 * transcript lets the parser read it, and the delegation that follows is answered with the
 * same result. A natural sentence waits for the delegation only when the parser has no
 * reading of its own.
 *
 * One session per concierge open — opened when the stage is shown, kept across turns and
 * routes, closed by the visitor or after three minutes of silence, re-established once on a
 * dropped line with the recent transcript seeded. One microphone stream, one peer
 * connection; `window.__wjVoiceAudit` counts them in development and the QA view.
 *
 * SPEAKING is driven by playback — the remote track's level — because the Live API has no
 * end-of-response event; the transcript deltas are the words, the audio is the truth.
 */

interface LiveEvent {
  type: string;
  [k: string]: unknown;
}

/** The timeline the latency harness reads; cheap enough to keep on. */
export interface TraceEntry {
  t: number;
  type: string;
  detail?: string;
}
const TRACE_MAX = 800;

let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Which append carries a result to the voice model: commentary is said aloud (paraphrased), thinking is held as a fact. */
const RESULT_CHANNEL = 'commentary' as 'commentary' | 'thinking';
/** Commentary is paraphrased aloud, so it carries the fact alone; a thinking fact is labelled so the model reads it as one. */
const resultContent = (fact: string) => (RESULT_CHANNEL === 'thinking' ? RESULT_PREFACE + fact : fact);
/** Three minutes of silence end a session; the next tap opens a new one. */
const IDLE_MS = 3 * 60_000;
/**
 * How long a pause in the transcript must be before the words are read without waiting for
 * the voice model's own turn decision. A complete short command — "Gold.", "Wapas.",
 * "Doosra.", "Liberty." with the form open — acts after a short pause; a plain sentence the
 * parser reads whole waits longer, so "Mujhe… bridal mein… kuch elegant dikhao" is not cut at
 * "Mujhe"; a fragment the parser cannot read, or a bare "yeh" / "this", is never acted on at
 * a pause at all — only once the voice model has delegated the finished turn. (The first live
 * run opened a piece on the word "Yeh" of "Yeh bohat heavy hai, kuch halka.")
 */
const PAUSE_SHORT_MS = 700;
const PAUSE_SENTENCE_MS = 1_500;
const SHORT_COMMANDS = new Set(['core_department', 'back', 'ordinal_open', 'close', 'appointment_field', 'core_restart', 'gold_world', 'diamond_world', 'bridal_route']);
const OPEN_COMMANDS = new Set(['core_open', 'deictic_open', 'named_open']);
function pauseFor(text: string, ctx: SiteContext): number | null {
  const t = text.trim();
  if (!t) return null;
  const route = routeSentence(t, ctx);
  const n = route.tokens;
  if (SHORT_COMMANDS.has(route.plan.id) && n <= 3) return PAUSE_SHORT_MS;
  // "open it", "yeh kholo", "is ko kholo": a verb with the deictic; "yeh" alone is the start of a sentence
  if (OPEN_COMMANDS.has(route.plan.id)) return n >= 2 && n <= 4 ? PAUSE_SHORT_MS : null;
  if (route.rung === 'direct' && route.plan.id !== 'unknown' && route.plan.id !== 'clarify' && n >= 2) return PAUSE_SENTENCE_MS;
  return null;
}
/** After a delegation, the transcript is given this long to settle before the words are read. */
const SETTLE_MS = 400;
const SETTLE_QUIET_MS = 220;
/** A sentence the parser could not read waits this long for GPT-Live to delegate it; then it is the model's to answer. */
const DELEGATION_WAIT_MS = 2_600;
/** A turn whose result was handed back but never spoken closes after this. */
const RESULT_SILENCE_MS = 4_000;
/** The remote track: louder than this is speech; quieter for this long is the end of it. */
const SPEECH_LEVEL = 0.018;
const SPEECH_QUIET_MS = 650;
const CONTEXT_DEBOUNCE_MS = 700;
const RECONNECT_WINDOW_MS = 120_000;
const RECONNECTS_PER_WINDOW = 2;
const HISTORY_MAX = 12;

export function liveSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

/** The written form of what was said: no markdown, no exclamation, one space. */
const tidy = (s: string) => stripBannedPhrases(s.replace(/[*_#`]+/g, '').replace(/!+/g, '.')).replace(/\s+/g, ' ').trim();

export interface VoiceAudit {
  /** Microphone streams asked for, ever, and the tracks of them still live now. */
  streams: number;
  liveTracks: () => number;
  /** Peer connections created, ever, and those not yet closed. */
  peerConnections: number;
  openPeerConnections: () => number;
  /** Live sessions created, ever, and whether one is open now. */
  sessions: number;
  sessionOpen: () => boolean;
  /** Whether the page reached for the browser's own speech APIs (it must not). */
  speechApisTouched: number;
}

interface Turn {
  id: string;
  text: string;
  route: Route | null;
  delegationId: string | null;
  /** The fact handed to the voice model, once it exists. */
  fact: string | null;
  factSent: boolean;
  rung: 'direct' | 'astra' | 'live' | 'typed';
  reply: string;
  spoke: boolean;
  tools: string[];
  startedAt: number;
  silenceTimer: number | null;
  /** Set while the delegation model is working, so a second delegation for the same words does not run it twice. */
  working: boolean;
}

export class LiveVoiceAdapter implements VoiceAdapter {
  /** The store's id for the session adapter: the WebRTC transport; the model behind it is GPT-Live. */
  readonly kind = 'realtime' as const;
  private runtime: VoiceSessionRuntime | null = null;
  private handlers: VoiceHandlers | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private sender: RTCRtpSender | null = null;
  private mic: MediaStream | null = null;
  private remote: HTMLAudioElement | null = null;
  private remoteStream: MediaStream | null = null;
  private meterCtx: AudioContext | null = null;
  private meterRaf = 0;
  private live = false;
  private hearing = false;
  /** The session was told to mute its input while the microphone rested; the next attach unmutes it. */
  private muted = false;
  private sessionId: string | null = null;
  private connecting: Promise<void> | null = null;
  /** Bumped by every teardown; a connect() that was cancelled mid-handshake sees it and lets go. */
  private generation = 0;
  private settleOpen: ((err: Error) => void) | null = null;
  private lastError: { code: 'MIC_DENIED' | 'UNSUPPORTED' | 'NETWORK'; message: string } | null = null;
  private unsubscribe: (() => void)[] = [];
  private contextTimer: number | null = null;
  private idleTimer: number | null = null;
  private lastContext = '';
  private languageTold: string | null = null;
  private closing: { resolve: () => void; timer: number } | null = null;
  private reconnects: number[] = [];
  private usageSeconds = 0;

  /** The visitor's words since the last turn was read, and when the last fragment arrived. */
  private input = { text: '', startMs: -1, endMs: -1, lastAt: 0 };
  private pauseTimer: number | null = null;
  private outputQuietTimer: number | null = null;
  private settleTimer: number | null = null;
  private waitTimer: number | null = null;
  /** A delegation whose words have not been read yet. */
  private pendingDelegation: { id: string; at: number } | null = null;
  /** A sentence the parser could not read, held for a delegation that may follow. */
  private held: { text: string; at: number } | null = null;
  private turn: Turn | null = null;
  private history: { role: 'visitor' | 'concierge'; text: string }[] = [];
  private output = { text: '', lastAt: 0 };
  private speaking = false;
  private loudAt = 0;
  private lastLevel = 0;
  private epoch = 0;
  readonly trace: TraceEntry[] = [];
  readonly audit: VoiceAudit = {
    streams: 0,
    liveTracks: () => (this.mic ? this.mic.getTracks().filter((t) => t.readyState === 'live').length : 0),
    peerConnections: 0,
    openPeerConnections: () => (this.pc && this.pc.connectionState !== 'closed' ? 1 : 0),
    sessions: 0,
    sessionOpen: () => this.live,
    speechApisTouched: 0,
  };

  isSupported() {
    return liveSupported();
  }

  isLive() {
    return this.live;
  }

  isWarm() {
    return this.live;
  }

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

  /** The recent spoken exchange, for a reconnection's seed and the delegation model's context. */
  recentHistory() {
    return this.history.slice(-HISTORY_MAX);
  }

  // ── lifecycle ───────────────────────────────────────────────────────────
  /** Open the call before the tap: the offer, the session, the data channel — no permission asked. */
  async warm(): Promise<boolean> {
    if (this.live) return true;
    if (!this.runtime || !liveSupported()) return false;
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
    // inside the tap: a phone allows the remote voice to play, and the meter to run, only after a gesture
    void this.remote?.play().catch(() => undefined);
    if (this.meterCtx && this.meterCtx.state === 'suspended') void this.meterCtx.resume().catch(() => undefined);
    if (!this.live) {
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
    }
    await this.attachMic(h);
  }

  /** "Rest the microphone", "Write instead", the panel closing: the microphone is released; the session stays for a while. */
  stop() {
    if (!this.live) return;
    this.restMic();
    this.armIdle();
    this.handlers?.onEnd();
  }

  abort() {
    this.teardown('abort');
  }

  /** The visitor closes the conversation: the session is closed gracefully and every resource released. */
  async close(): Promise<void> {
    if (!this.live) {
      this.teardown('close');
      return;
    }
    this.restMic();
    await this.requestClose('close');
  }

  /** A tap on the ring over the reply: GPT-Live is told to stop, and the turn is over on this side. */
  interrupt() {
    if (!this.live) return;
    if (this.speaking || this.turn) {
      this.append('session.instructions.append', null, 'Stop speaking now and listen to the visitor.', 'interrupt');
      this.note('interrupt');
    }
    this.supersede('interrupt');
  }

  /** A typed sentence into the same conversation: routed here, its outcome handed to the voice. */
  sendText(text: string): boolean {
    if (!this.live || !this.dc || this.dc.readyState !== 'open') return false;
    this.supersede('typed');
    this.armIdle();
    this.note('text.sent', text.slice(0, 60));
    this.append('session.thinking.append', null, `The visitor typed (not spoken): "${text.slice(0, 240)}". The page is answering it now.`, 'typed');
    void this.startTurn(text, null, 'typed');
    return true;
  }

  private async attachMic(h: VoiceHandlers) {
    const gen = this.generation;
    if (!this.mic) {
      const tap = Date.now();
      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        this.audit.streams += 1;
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
    this.mic.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    this.hearing = true;
    this.note('mic.on');
    if (this.muted) {
      this.send({ type: 'session.input_audio.unmute', event_id: uid('unmute_') });
      this.muted = false;
    }
    this.armIdle();
    this.pushContext(true);
    h.onStart();
  }

  private async connect(seed?: { role: 'visitor' | 'concierge'; text: string }[]) {
    if (!this.runtime) {
      this.lastError = { code: 'UNSUPPORTED', message: 'no runtime' };
      return;
    }
    const gen = ++this.generation;
    const cancelled = () => gen !== this.generation;
    this.lastError = null;
    const started = Date.now();
    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection();
      this.audit.peerConnections += 1;
      this.pc = pc;
      const remote = document.createElement('audio');
      remote.autoplay = true;
      remote.setAttribute('playsinline', '');
      this.remote = remote;
      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        this.remoteStream = stream;
        remote.srcObject = stream;
        void remote.play().catch(() => undefined);
        this.meterRemote(stream);
      };
      // the microphone comes later, inside the tap, or now on a reconnection that kept it
      const track = this.mic?.getAudioTracks()[0] ?? null;
      if (track && this.mic) this.sender = pc.addTrack(track, this.mic);
      else this.sender = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
      // the event channel, registered before the offer so nothing said at the start is missed
      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;
      dc.onmessage = (ev) => {
        try {
          this.onEvent(JSON.parse(String(ev.data)) as LiveEvent);
        } catch {
          /* a frame that is not JSON is not an event */
        }
      };
      dc.onclose = () => this.onTransportLost('channel');
      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) this.onTransportLost(pc.connectionState);
      };

      const offer = await pc.createOffer();
      if (cancelled()) throw new Error('aborted');
      await pc.setLocalDescription(offer);
      await this.gatherIce(pc, 2_500);
      if (cancelled()) throw new Error('aborted');
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error('no offer');

      const res = await fetch('/api/concierge/live-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sdp, context: this.runtime.context(), ...(seed?.length ? { history: seed } : {}) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (cancelled()) throw new Error('aborted');
      if (!res.ok) {
        // the provider's own words, so a quota refusal is on the record verbatim
        let detail = `session ${res.status}`;
        try {
          const j = (await res.json()) as { error?: { code?: string; message?: string } };
          if (j.error?.code) detail = `${j.error.code}${j.error.message ? `: ${j.error.message}` : ''}`;
        } catch {
          /* the status is the message */
        }
        const err = new Error(detail);
        err.name = res.status === 503 ? 'Offline' : 'Upstream';
        throw err;
      }
      const answer = (await res.json()) as { sessionId?: string; sdp?: string; voice?: string; model?: string };
      if (!answer.sdp || !answer.sessionId) throw new Error('no answer');
      this.sessionId = answer.sessionId;
      this.audit.sessions += 1;
      this.note('session.created', `${answer.model ?? ''} · ${answer.voice ?? ''} · ${Date.now() - started} ms`);
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
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
        if (!cancelled()) this.teardown('connect', { keepMic: Boolean(seed) });
        return;
      }
      this.teardown('connect', { keepMic: Boolean(seed) });
      const message = e instanceof Error ? e.message : 'connect';
      this.lastError = { code: e instanceof Error && e.name === 'Offline' ? 'UNSUPPORTED' : 'NETWORK', message };
      this.note('connect.failed', message);
      this.runtime.emit({ type: 'turn.trace', turnId: 'voice', trace: { rung: 'live', fallback: `session: ${message}` } });
      return;
    }
    // `session.started` arrives on the channel and marks the session live; the channel being open is enough to begin
    this.live = true;
    this.note('live', `${Date.now() - started} ms`);
    this.unsubscribe.push(this.runtime.subscribe(() => this.scheduleContext()));
    this.runtime.emit({ type: 'voice.session', status: 'live' });
    this.armIdle();
    if (this.mic) {
      // a reconnection kept the microphone: it is on the new call already, and the ring meters it again
      this.hearing = true;
      this.note('mic.on', 'reconnected');
      void startMeter(this.mic, { own: false });
      this.pushContext(true);
    }
  }

  /** ICE gathering, bounded: a host candidate is enough for OpenAI's relay, and a slow STUN answer must not cost the tap a second. */
  private gatherIce(pc: RTCPeerConnection, maxMs: number) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(done, maxMs);
      function done() {
        window.clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onState);
        resolve();
      }
      function onState() {
        if (pc.iceGatheringState === 'complete') done();
      }
      pc.addEventListener('icegatheringstatechange', onState);
    });
  }

  private onTransportLost(reason: string) {
    if (!this.live) return;
    this.note('transport.lost', reason);
    this.handleClosed('connection_lost');
  }

  /** The close the API asks for: `session.close`, then `session.closed`, then the transports. */
  private requestClose(reason: string): Promise<void> {
    if (!this.live || !this.dc || this.dc.readyState !== 'open') {
      this.teardown(reason);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        this.note('close.timeout');
        this.closing = null;
        this.teardown(reason);
        resolve();
      }, 3_000);
      this.closing = { resolve, timer };
      this.send({ type: 'session.close', event_id: uid('close_') });
      this.note('close.requested', reason);
    });
  }

  private teardown(reason: string, opts: { keepMic?: boolean; quiet?: boolean } = {}) {
    const wasLive = this.live;
    this.live = false;
    this.hearing = false;
    this.generation += 1;
    this.connecting = null;
    this.settleOpen?.(new Error('aborted'));
    this.settleOpen = null;
    this.note('teardown', reason);
    for (const t of [this.contextTimer, this.idleTimer, this.pauseTimer, this.settleTimer, this.waitTimer, this.outputQuietTimer]) if (t) window.clearTimeout(t);
    this.contextTimer = this.idleTimer = this.pauseTimer = this.settleTimer = this.waitTimer = this.outputQuietTimer = null;
    if (this.closing) {
      window.clearTimeout(this.closing.timer);
      this.closing.resolve();
      this.closing = null;
    }
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
    if (!opts.keepMic) this.releaseMic();
    stopMeter();
    this.stopRemoteMeter();
    if (this.remote) {
      this.remote.pause();
      this.remote.srcObject = null;
      this.remote = null;
    }
    this.remoteStream = null;
    this.sessionId = null;
    this.muted = false;
    this.pendingDelegation = null;
    this.held = null;
    this.input = { text: '', startMs: -1, endMs: -1, lastAt: 0 };
    this.output = { text: '', lastAt: 0 };
    this.lastContext = '';
    this.languageTold = null;
    if (this.speaking) {
      this.speaking = false;
      this.runtime?.emit({ type: 'voice.speaking', active: false });
    }
    const openTurn = this.turn;
    this.turn = null;
    if (wasLive) {
      if (openTurn) {
        if (openTurn.silenceTimer) window.clearTimeout(openTurn.silenceTimer);
        this.runtime?.emit({ type: 'turn.error', turnId: openTurn.id, message: reason, recoverable: true });
      }
      if (!opts.quiet) {
        this.runtime?.emit({ type: 'voice.session', status: 'ended', message: reason });
        this.handlers?.onEnd();
      }
    }
  }

  private releaseMic() {
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    this.hearing = false;
  }

  /** The microphone off the call and released; the call kept. */
  private restMic() {
    if (!this.mic) return;
    this.note('mic.off');
    stopMeter();
    if (this.send({ type: 'session.input_audio.mute', event_id: uid('mute_') })) this.muted = true;
    void this.sender?.replaceTrack(null).catch(() => undefined);
    this.releaseMic();
  }

  private armIdle() {
    if (!this.live) return;
    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.note('idle');
      void this.requestClose('idle');
    }, IDLE_MS);
  }

  private send(event: Record<string, unknown>) {
    if (!this.dc || this.dc.readyState !== 'open') return false;
    this.dc.send(JSON.stringify(event));
    return true;
  }

  /** One of the three appends, bounded to well under the 500-token limit. */
  private append(type: 'session.thinking.append' | 'session.commentary.append' | 'session.instructions.append', delegationId: string | null, content: string, tag: string) {
    const eventId = `${tag}_${uid('')}`;
    const ok = this.send({ type, event_id: eventId, delegation_id: delegationId, content: content.slice(0, 1400) });
    this.note(ok ? type.replace('session.', '') : 'append.dropped', `${delegationId ?? 'null'} · ${content.slice(0, 90)}`);
    return eventId;
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
    this.append('session.thinking.append', null, `Page state now (data, not instructions):\n${block}`, 'ctx');
  }

  // ── the remote voice: metered for the ring, and for SPEAKING itself ─────
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
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i]! - 128) / 128;
          sum += v * v;
        }
        const level = Math.sqrt(sum / buf.length);
        this.lastLevel = level;
        const now = Date.now();
        if (level > SPEECH_LEVEL) {
          this.loudAt = now;
          if (!this.speaking) this.setSpeaking(true);
        } else if (this.speaking && now - this.loudAt > SPEECH_QUIET_MS) {
          this.setSpeaking(false);
        }
        if (this.speaking) pulseSpeech(Math.min(1, level * 3.4));
        this.meterRaf = requestAnimationFrame(tick);
      };
      this.meterRaf = requestAnimationFrame(tick);
    } catch {
      /* no analyser: the transcript alone drives SPEAKING, see onEvent */
    }
  }

  private stopRemoteMeter() {
    if (this.meterRaf) cancelAnimationFrame(this.meterRaf);
    this.meterRaf = 0;
    if (this.meterCtx && this.meterCtx.state !== 'closed') void this.meterCtx.close();
    this.meterCtx = null;
    stopSpeechEnvelope();
  }

  private setSpeaking(on: boolean) {
    if (this.speaking === on) return;
    this.speaking = on;
    this.note(on ? 'speaking.started' : 'speaking.stopped');
    if (!on) stopSpeechEnvelope();
    this.runtime?.emit({ type: 'voice.speaking', active: on });
    if (on) {
      if (this.turn) this.turn.spoke = true;
      this.armIdle();
    } else if (this.turn?.spoke && this.turn.factSent) {
      // the reply has been said, after the result was handed back: the turn is over — a word
      // said while the page still works ("Ji.") keeps the turn open for the result
      this.finishTurn();
    }
  }

  // ── events ──────────────────────────────────────────────────────────────
  private onEvent(e: LiveEvent) {
    const rt = this.runtime;
    if (!rt) return;
    switch (e.type) {
      case 'session.started': {
        const session = (e.session ?? {}) as Record<string, unknown>;
        if (typeof session.id === 'string') this.sessionId = session.id;
        this.note('session.started', this.sessionId ?? undefined);
        break;
      }

      case 'session.input_transcript.delta': {
        const delta = String(e.delta ?? '');
        const startMs = typeof e.start_ms === 'number' ? e.start_ms : -1;
        const endMs = typeof e.end_ms === 'number' ? e.end_ms : -1;
        this.armIdle();
        if (!this.input.text) {
          this.input.startMs = startMs;
          this.note('input.started', `${startMs}`);
          // the visitor speaks over the reply, or over an action still running: what was in flight is over
          if (this.speaking || (this.turn && this.turn.factSent)) {
            this.supersede('barge-in');
            rt.emit({ type: 'voice.transcript', text: '', final: false });
            rt.emit({ type: 'voice.listening', active: true });
          }
        }
        this.input.text += delta;
        this.input.endMs = Math.max(this.input.endMs, endMs);
        this.input.lastAt = Date.now();
        this.note('input.delta', `${startMs}-${endMs} ${delta.slice(0, 40)}`);
        rt.emit({ type: 'voice.transcript', text: this.input.text.trim(), final: false });
        if (this.pauseTimer) window.clearTimeout(this.pauseTimer);
        const pause = pauseFor(this.input.text, rt.siteContext());
        if (pause !== null) this.pauseTimer = window.setTimeout(() => this.closeTurn('pause'), pause);
        break;
      }

      case 'session.delegation.created': {
        const d = (e.delegation ?? {}) as Record<string, unknown>;
        const id = String(d.id ?? '');
        this.note('delegation.created', `${id} · ${String(d.target ?? '')} · ${String(e.offset_ms ?? '')} ms`);
        if (!id || d.target !== 'client') break;
        this.armIdle();
        this.pendingDelegation = { id, at: Date.now() };
        if (this.pauseTimer) window.clearTimeout(this.pauseTimer);
        this.pauseTimer = null;
        // the transcript may lag the decision by a few hundred milliseconds: let it settle, then read the words
        const settle = () => {
          const quiet = Date.now() - this.input.lastAt;
          if (this.input.text && quiet < SETTLE_QUIET_MS) {
            this.settleTimer = window.setTimeout(settle, SETTLE_QUIET_MS - quiet);
            return;
          }
          this.settleTimer = null;
          this.closeTurn('delegation');
        };
        if (this.settleTimer) window.clearTimeout(this.settleTimer);
        this.settleTimer = window.setTimeout(settle, this.input.text ? Math.max(0, SETTLE_MS - (Date.now() - this.input.lastAt)) : SETTLE_MS);
        break;
      }

      case 'session.output_transcript.delta': {
        const delta = String(e.delta ?? '');
        this.armIdle();
        if (!this.output.text) this.note('output.started', `${String(e.start_ms ?? '')}`);
        this.output.text += delta;
        this.output.lastAt = Date.now();
        // the model speaks with no turn open — a greeting back, a clarifying question — and the line still belongs in the exchange
        if (!this.turn) this.openVoiceTurn();
        if (this.turn) {
          const clean = stripBannedPhrases(delta);
          this.turn.reply += clean;
          rt.emit({ type: 'text.delta', turnId: this.turn.id, delta: clean });
          if (!this.meterCtx) {
            if (!this.speaking) this.setSpeaking(true);
            if (this.outputQuietTimer) window.clearTimeout(this.outputQuietTimer);
            this.outputQuietTimer = window.setTimeout(() => {
              this.outputQuietTimer = null;
              if (!this.meterCtx) this.setSpeaking(false);
            }, 1_200);
          }
        }
        break;
      }

      case 'session.thinking.appended':
      case 'session.commentary.appended':
      case 'session.instructions.appended':
        this.note('appended', `${String(e.client_event_id ?? '')} · ${String(e.start_ms ?? '')}-${String(e.end_ms ?? '')}`);
        break;

      case 'session.input_audio.muted':
      case 'session.input_audio.unmuted':
        this.note(e.type.replace('session.input_audio.', 'mic.'));
        break;

      case 'session.usage.updated': {
        const usage = (e.usage ?? {}) as Record<string, unknown>;
        if (typeof usage.seconds === 'number') this.usageSeconds = usage.seconds;
        const cw = (e.context_window ?? {}) as Record<string, unknown>;
        this.note('usage', `${this.usageSeconds} s${typeof cw.usage_ratio === 'number' ? ` · context ${Math.round(cw.usage_ratio * 100)}%` : ''}`);
        break;
      }

      case 'session.closed': {
        const reason = String(e.reason ?? 'closed');
        const usage = (e.usage ?? {}) as Record<string, unknown>;
        this.note('session.closed', `${reason} · ${typeof usage.seconds === 'number' ? usage.seconds : this.usageSeconds} s`);
        this.handleClosed(reason);
        break;
      }

      case 'error': {
        const err = (e.error ?? {}) as Record<string, unknown>;
        this.note('error', `${String(err.code ?? err.type ?? '')}: ${String(err.message ?? '')}${err.client_event_id ? ` (${String(err.client_event_id)})` : ''}`);
        break;
      }

      case 'info':
        this.note('info', `${String(e.code ?? '')}: ${String(e.message ?? '')}`);
        break;

      default:
        break;
    }
  }

  private handleClosed(reason: string) {
    const requested = Boolean(this.closing);
    if (requested) {
      this.teardown(reason === 'close_requested' ? 'close' : reason);
      return;
    }
    const lost = reason === 'connection_lost' || reason === 'channel' || reason === 'failed';
    const seed = this.recentHistory();
    const hadMic = Boolean(this.mic);
    const reconnect = lost && hadMic && this.mayReconnect();
    this.teardown(reason, { keepMic: reconnect, quiet: reconnect });
    if (reconnect) {
      this.note('reconnect', `${this.reconnects.length} in window`);
      this.runtime?.emit({ type: 'voice.session', status: 'connecting' });
      this.connecting = this.connect(seed).finally(() => {
        this.connecting = null;
      });
      void this.connecting.then(() => {
        if (this.live) {
          this.append('session.instructions.append', null, 'The line dropped for a moment and is back. Say so in a few words, in the visitor\'s language, and ask them to repeat their last sentence if it was not answered.', 'reconnect');
          this.handlers?.onStart();
        } else {
          this.releaseMic();
          this.runtime?.emit({ type: 'voice.session', status: 'ended', message: 'connection_lost' });
          this.handlers?.onEnd();
        }
      });
    }
  }

  private mayReconnect() {
    const now = Date.now();
    this.reconnects = this.reconnects.filter((t) => now - t < RECONNECT_WINDOW_MS);
    if (this.reconnects.length >= RECONNECTS_PER_WINDOW) return false;
    this.reconnects.push(now);
    return true;
  }

  // ── turns ───────────────────────────────────────────────────────────────
  /** The words since the last turn are read: at a pause, or once a delegation's transcript has settled. */
  private closeTurn(reason: 'pause' | 'delegation') {
    if (this.pauseTimer) window.clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    const text = this.input.text.trim();
    const delegation = this.pendingDelegation;
    if (delegation && Date.now() - delegation.at > 15_000) this.pendingDelegation = null;
    if (!text) {
      if (reason === 'delegation' && delegation) {
        // a delegation for a turn already read at the pause: it gets the same result
        if (this.turn && !this.turn.delegationId && Date.now() - this.turn.startedAt < 12_000) {
          this.turn.delegationId = delegation.id;
          this.pendingDelegation = null;
          this.note('delegation.attached', `${delegation.id} → ${this.turn.id}`);
          if (this.turn.fact && !this.turn.factSent) this.sendFact(this.turn);
          else if (this.turn.fact) this.append(RESULT_CHANNEL === 'commentary' ? 'session.commentary.append' : 'session.thinking.append', delegation.id, resultContent(this.turn.fact), 'res');
          return;
        }
        // a sentence held for exactly this: the parser could not read it, the model wants it answered
        if (this.held && Date.now() - this.held.at < DELEGATION_WAIT_MS + 2_000) {
          const held = this.held.text;
          this.held = null;
          this.pendingDelegation = null;
          void this.startTurn(held, delegation.id, 'spoken');
          return;
        }
        if (this.waitTimer) window.clearTimeout(this.waitTimer);
        // nothing transcribed yet: give the words a moment more
        this.waitTimer = window.setTimeout(() => {
          this.waitTimer = null;
          if (this.input.text.trim()) return this.closeTurn('delegation');
          if (this.pendingDelegation?.id === delegation.id) {
            this.pendingDelegation = null;
            this.append('session.thinking.append', delegation.id, 'No words were transcribed for this request. Ask the visitor to say it once more, briefly.', 'res');
            this.note('delegation.unheard', delegation.id);
          }
        }, 1_200);
      }
      return;
    }
    this.input = { text: '', startMs: -1, endMs: -1, lastAt: 0 };
    this.runtime?.emit({ type: 'voice.transcript', text, final: true });
    this.note('heard', `${text.slice(0, 80)} (${reason})`);
    if (delegation) {
      this.pendingDelegation = null;
      void this.startTurn(text, delegation.id, 'spoken');
      return;
    }
    void this.startTurn(text, null, 'spoken');
  }

  /**
   * One visitor sentence through the router. Direct plans act at once. A sentence the
   * parser cannot read is held for a delegation; a natural sentence it half reads goes to the
   * delegation model without waiting.
   */
  private async startTurn(text: string, delegationId: string | null, how: 'spoken' | 'typed') {
    const rt = this.runtime;
    if (!rt || !this.live) return;
    const ctx = rt.siteContext();
    const route = routeSentence(text, ctx);
    this.note('route', `${route.rung} · ${route.plan.id} · ${route.language} · ${route.why}`);
    this.tellLanguage(route.language);
    if (how === 'spoken') rt.emit({ type: 'voice.utterance', id: uid('v'), text, final: true });
    this.history.push({ role: 'visitor', text });
    if (this.history.length > HISTORY_MAX * 2) this.history.splice(0, this.history.length - HISTORY_MAX * 2);

    if (route.rung === 'astra' && !delegationId && route.plan.id === 'unknown' && how === 'spoken') {
      // the parser has no reading: the model decides whether this needs the page at all
      this.held = { text, at: Date.now() };
      if (this.waitTimer) window.clearTimeout(this.waitTimer);
      this.waitTimer = window.setTimeout(() => {
        this.waitTimer = null;
        if (this.held?.text === text) {
          this.held = null;
          this.note('held.released', text.slice(0, 40));
        }
      }, DELEGATION_WAIT_MS);
      rt.emit({ type: 'turn.trace', turnId: uid('t'), trace: { rung: 'live', language: route.language, intent: route.frame.intent, plan: route.plan.id, note: 'not read; left to the voice model' } });
      return;
    }

    // a fresh turn supersedes whatever was still open
    if (this.turn) this.finishTurn();
    const epoch = ++this.epoch;
    const turn: Turn = { id: uid('t'), text, route, delegationId, fact: null, factSent: false, rung: route.rung, reply: '', spoke: false, tools: [], startedAt: Date.now(), silenceTimer: null, working: true };
    this.turn = turn;
    rt.emit({ type: 'voice.thinking' });
    rt.emit({ type: 'turn.start', turnId: turn.id });
    const deps = {
      executeTool: (name: ToolName, args: Record<string, unknown>): Promise<ToolOutcome> => rt.executeTool(name, args),
      // the tool's start and its visible outcome on the timeline the latency harness reads
      emit: (e: ProviderEvent) => {
        if (e.type === 'tool.call') this.note('tool.start', e.name);
        else if (e.type === 'tool.result') this.note('tool.visible', `${e.outcome.label || 'done'}`);
        else if (e.type === 'tool.error') this.note('tool.failed', e.message);
        rt.emit(e);
      },
      context: () => rt.siteContext(),
      turnId: turn.id,
    };
    let fact: string;
    let note: string | undefined;
    let tools: string[] = [];
    // the backend model takes a second or three: the voice model is told to hold, so it does not
    // answer from the page as it was (it once said "koi ring saamne nahi" a moment before four arrived)
    if (route.rung === 'astra' && delegationId) this.append('session.thinking.append', delegationId, 'Working on this request now; the result follows in a moment. Until it arrives say at most one word and nothing about the page.', 'hold');
    if (route.rung === 'direct') {
      const result = await runDirect(route.plan, deps);
      fact = result.fact;
      tools = result.tools;
    } else {
      const result = await runAstra(text, { ...deps, history: this.recentHistory().slice(0, -1) });
      tools = result.tools;
      note = result.note;
      if (!result.ok) {
        this.note('astra.failed', result.error ?? '');
        fact = 'The backend could not answer just now. Say so in one short sentence and offer the bridal pieces or writing instead.';
        note = `${note ? `${note} · ` : ''}failed: ${result.error ?? ''}`;
      } else fact = result.fact || 'Done.';
    }
    turn.working = false;
    turn.tools = tools;
    if (this.epoch !== epoch || this.turn !== turn) {
      this.note('turn.stale', turn.id);
      return;
    }
    turn.fact = fact;
    rt.emit({ type: 'turn.trace', turnId: turn.id, trace: { rung: route.rung, language: route.language, intent: route.frame.intent, plan: route.plan.id, tool: tools.join(',') || undefined, note: [turn.delegationId ? `delegation ${turn.delegationId}` : 'no delegation', route.why, note].filter(Boolean).join(' · ') } });
    this.sendFact(turn);
  }

  private sendFact(turn: Turn) {
    if (!turn.fact || !this.live) return;
    turn.factSent = true;
    this.note('fact', `${turn.rung} → ${turn.delegationId ?? 'null'} · ${turn.fact.slice(0, 80)}`);
    // the page has changed: the voice model reads what is in view before it is handed the result,
    // so the result is the only thing it has to say
    this.pushContext(true);
    this.append(RESULT_CHANNEL === 'commentary' ? 'session.commentary.append' : 'session.thinking.append', turn.delegationId, resultContent(turn.fact), 'res');
    if (turn.silenceTimer) window.clearTimeout(turn.silenceTimer);
    turn.silenceTimer = window.setTimeout(() => {
      if (this.turn === turn && !this.speaking) {
        this.note('turn.silent', turn.id);
        this.finishTurn();
      }
    }, RESULT_SILENCE_MS);
  }

  /** The model speaks on its own — no delegation, no page action: a line in the exchange, and SPEAKING. */
  private openVoiceTurn() {
    const rt = this.runtime;
    if (!rt) return;
    const turn: Turn = { id: uid('t'), text: '', route: null, delegationId: null, fact: null, factSent: true, rung: 'live', reply: '', spoke: false, tools: [], startedAt: Date.now(), silenceTimer: null, working: false };
    this.turn = turn;
    rt.emit({ type: 'turn.start', turnId: turn.id });
    rt.emit({ type: 'turn.trace', turnId: turn.id, trace: { rung: 'live', note: 'spoken by the voice model alone' } });
  }

  private finishTurn() {
    const rt = this.runtime;
    const turn = this.turn;
    if (!rt || !turn) return;
    if (turn.silenceTimer) window.clearTimeout(turn.silenceTimer);
    this.turn = null;
    const text = tidy(turn.reply);
    if (text) this.history.push({ role: 'concierge', text });
    this.output = { text: '', lastAt: 0 };
    rt.emit({ type: 'text.done', turnId: turn.id, text });
    rt.emit({ type: 'turn.done', turnId: turn.id });
    this.note('turn.done', text.slice(0, 80));
    this.armIdle();
  }

  /** Whatever was in flight is over: a fresh sentence, a tap, a typed line. */
  private supersede(reason: string) {
    this.epoch += 1;
    this.held = null;
    if (this.waitTimer) window.clearTimeout(this.waitTimer);
    this.waitTimer = null;
    if (this.speaking) this.setSpeaking(false);
    if (this.turn) {
      this.note(reason, this.turn.id);
      this.finishTurn();
    }
  }

  private tellLanguage(language: string) {
    if (!this.live || language === this.languageTold) return;
    const first = this.languageTold === null;
    this.languageTold = language;
    if (first && language === 'en') return;
    this.append('session.instructions.append', null, languageInstruction(language), 'lang');
    this.note('language', language);
  }
}

let engine: LiveVoiceAdapter | null = null;

/** One adapter per page, reused across turns and routes; registered with the seam on load. */
export function registerLiveEngine() {
  registerVoiceEngine(() => {
    if (!engine) engine = new LiveVoiceAdapter();
    return engine;
  });
  if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'development' || qaMode())) {
    window.__wjVoiceAudit = () => (engine ? { ...engine.audit, liveTracks: engine.audit.liveTracks(), openPeerConnections: engine.audit.openPeerConnections(), sessionOpen: engine.audit.sessionOpen() } : null);
    // the router's reading of a sentence against the page as it is — which rung, which plan — for the harnesses
    window.__wjVoiceRoute = (text: string) => {
      const r = routeSentence(text, buildSiteContext());
      return { rung: r.rung, plan: r.plan.id, intent: r.frame.intent, language: r.language, tokens: r.tokens, unknown: r.unknown, why: r.why, tools: r.plan.tools.map((t) => t.name) };
    };
  }
}

export const liveTrace = () => engine?.trace ?? [];
/** A mark on the same timeline the adapter keeps, from the controller (the tap, the stage's states). */
export const liveMark = (type: string, detail?: string) => engine?.note(type, detail);

declare global {
  interface Window {
    __wjVoiceTrace?: () => TraceEntry[];
    /** Development and QA: the audio pipeline's counts — streams, live tracks, peer connections, sessions. */
    __wjVoiceAudit?: () => (Omit<VoiceAudit, 'liveTracks' | 'openPeerConnections' | 'sessionOpen'> & { liveTracks: number; openPeerConnections: number; sessionOpen: boolean }) | null;
    /** Development and QA: the router's reading of a sentence — the rung, the plan, the language — without acting. */
    __wjVoiceRoute?: (text: string) => { rung: string; plan: string; intent: string; language: string; tokens: number; unknown: string[]; why: string; tools: string[] };
  }
}
