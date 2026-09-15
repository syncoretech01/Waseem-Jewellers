'use client';

import { useConciergeStore, OPEN_STATES, type ConciergeMode, type ConciergeState, type ConciergeTurn, type TurnSource } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { useQualityStore } from '@/state/qualityStore';
import { buildSiteContext } from './context';
import { loadIndex } from '@/data/clientIndex';
import { recognitionLang } from './voice/languages';
import { chooseVoiceEngine, hearingAvailable } from './voice/engine';
import { probeCapabilities } from './capabilities';
import { createProvider } from './createProvider';
import { executeTool } from './tools/executeTool';
import { TOOL_DEFS } from './tools/toolDefs';
import { CONCIERGE } from './copy';
import { recognitionSupported, type VoiceAdapter } from './voice/adapters';
import { cancelSpeech, planSpeech, speak, speechAvailable, speechEngine } from './voice/speech';
import { primeAudio, registerServerSpeech } from './voice/serverSpeech';
import { startMeter, stopMeter, voiceMeter } from './voice/meter';
import { EXAMPLE_SCRIPTS } from './voice/scripts';
import type { ConciergeProvider, ProviderEvent, ProviderRuntime } from './types';

let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface OpenOptions {
  mode?: ConciergeMode;
  autoListen?: boolean;
  submit?: string;
  prefill?: string;
  example?: boolean;
}

/**
 * Owns the provider, the voice adapter, speech output and every timer.
 * Reduces provider events into store transitions; the UI reads only the store.
 */
export class ConciergeController {
  private provider: ConciergeProvider;
  private adapter: VoiceAdapter | null = null;
  private timers = new Set<number>();
  private epoch = 0;
  private exampleIndex = 0;
  private activeTurn: string | null = null;
  private pendingResult = false;
  private speaking = false;
  /** What has already been voiced of the current reply, so text.done speaks only the rest. */
  private spokenText = '';
  private speechQueue: Promise<void> = Promise.resolve();
  /** Runs when the voice finishes, if a turn ended while the reply was still being said. */
  private afterSpeech: (() => void) | null = null;
  private bargeTimer: number | null = null;
  /** The element that had focus when the salon opened. See . */
  private opener: HTMLElement | null = null;
  /** The browser has no voice for a language the visitor used. Said once a session. */
  private saidNoVoice = false;
  private afterOpen: (() => void) | null = null;
  private draftListeners = new Set<(draft: string) => void>();

  constructor() {
    this.provider = createProvider();
    const runtime: ProviderRuntime = {
      getCurrentContext: buildSiteContext,
      executeTool: (name, args) => executeTool(name, args),
      emit: (e) => this.onEvent(e),
      toolDefs: TOOL_DEFS,
    };
    this.provider.attach(runtime);
    registerServerSpeech();
    this.refreshVoiceSupport();
  }

  /** What this device can hear and speak with, by whichever tier the deployment offers. */
  private refreshVoiceSupport() {
    this.store.setVoice({ recognition: hearingAvailable(), synthesis: speechAvailable() });
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private get store() {
    return useConciergeStore.getState();
  }

  private later(ms: number, fn: () => void) {
    const epoch = this.epoch;
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (this.epoch === epoch) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  private clearTimers() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.clear();
    this.epoch += 1;
  }

  private restState(): ConciergeState {
    return this.store.mode === 'voice' ? 'VOICE_READY' : 'CHAT';
  }

  onDraft(fn: (draft: string) => void) {
    this.draftListeners.add(fn);
    return () => {
      this.draftListeners.delete(fn);
    };
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  hover(on: boolean) {
    const s = this.store;
    if (on && s.state === 'IDLE') s.transition('HOVER', 'pointer');
    else if (!on && s.state === 'HOVER') s.transition('IDLE', 'pointer');
  }

  open(opts: OpenOptions = {}) {
    const s = this.store;
    // whoever had focus when the salon was asked for gets it back when the salon closes;
    // captured here, before the composer autofocuses and takes it
    if (!OPEN_STATES.includes(s.state)) this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /**
     * The catalogue index arrives with the concierge, not with the page.
     *
     * Every lookup below it — search, similar, the name of a piece, and above all whether a
     * slug is real — reads the index, so it is fetched the moment the panel opens rather
     * than on a visitor's first sentence. A visitor who never asks never pays for it.
     */
    void loadIndex();
    // what this deployment is allowed to be: model or keyless, and which engine hears
    void probeCapabilities().then(() => this.refreshVoiceSupport());
    const mode = opts.mode ?? s.mode;
    s.setMode(mode);
    if (s.state === 'IDLE' || s.state === 'HOVER') {
      s.transition('OPENING', 'open');
      s.setPanel('full');
    } else {
      s.setPanel('full');
    }
    if (!s.greeted) {
      const hour = new Date().getHours();
      s.appendTurn({ id: uid('c'), role: 'concierge', text: CONCIERGE.greeting(hour), source: 'system', createdAt: Date.now() });
      s.setGreeted(true);
    }
    const after = () => {
      if (opts.prefill) this.draftListeners.forEach((fn) => fn(opts.prefill!));
      if (opts.submit) this.submitText(opts.submit, 'text');
      else if (opts.example) this.runExample();
      else if (opts.autoListen && mode === 'voice') this.startListening();
    };
    if (this.store.state === 'OPENING') {
      // the panel reports the end of its unfold; a fallback covers a missed animation event
      this.afterOpen = after;
      this.later(900, () => this.opened());
    } else after();
  }

  /** Called by the panel when its unfold completes (or immediately under reduced motion). */
  opened() {
    const s = this.store;
    if (s.state === 'OPENING') s.transition(this.restState(), 'opened');
    if (this.store.state === 'OPENING') return;
    const fn = this.afterOpen;
    this.afterOpen = null;
    fn?.();
  }

  close() {
    const s = this.store;
    this.cancelTurn();
    this.adapter?.abort();
    cancelSpeech();
    this.disarmBargeIn();
    this.afterSpeech = null;
    this.clearTimers();
    s.setTrayOpen(false);
    s.setPanel('closed');
    s.setTranscript({ interim: '', final: '', active: false });
    s.setVoice({ sessionLive: false, preparing: false });
    s.transition('IDLE', 'close');
    // back to the orb, or the ENQUIRE button, or wherever it was — not to <body>
    const opener = this.opener;
    this.opener = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  setMode(mode: ConciergeMode) {
    const s = this.store;
    if (s.mode === mode) return;
    // "Write" mid-sentence discards the half sentence rather than sending it
    if (s.state === 'LISTENING' || s.voice.preparing) {
      this.adapter?.abort();
      s.setVoice({ preparing: false, transcribing: false, sessionLive: false });
      s.setTranscript({ interim: '', final: '', active: false });
      if (this.store.state === 'LISTENING') s.transition('VOICE_READY', 'mode');
    }
    s.setMode(mode);
    const cur = this.store.state;
    if (cur === 'CHAT' || cur === 'VOICE_READY' || cur === 'RESULT' || cur === 'ERROR') s.transition(mode === 'voice' ? 'VOICE_READY' : 'CHAT', 'mode');
  }

  expand() {
    const s = this.store;
    if (s.panel === 'compact') s.setPanel('full');
  }

  dismissTray() {
    this.store.setTrayOpen(false);
  }

  forget() {
    this.cancelTurn();
    this.saidNoVoice = false;
    this.store.forget();
  }

  // ── turns ─────────────────────────────────────────────────────────────────
  submitText(text: string, source: TurnSource = 'text') {
    const trimmed = text.trim();
    if (!trimmed) return;
    const s = this.store;
    if (s.state === 'LISTENING' || s.voice.preparing) {
      this.adapter?.abort();
      // a spoken turn keeps the session live so the microphone reopens after the reply; a
      // written or scripted one ends it — the visitor has moved to the keyboard
      s.setVoice({ preparing: false, transcribing: false, sessionLive: source === 'voice' && s.voice.sessionLive });
    }
    this.cancelTurn();
    this.clearTimers(); // a previous result's hold must not settle this turn
    cancelSpeech();
    s.setError(null);
    // only a spoken turn leaves its words on the voice stage as "heard —"
    if (source !== 'voice' && source !== 'example') s.setTranscript({ interim: '', final: '', active: false });
    s.setTrayOpen(false);
    s.setLastVisitorText(trimmed);
    if (source !== 'card') s.appendTurn({ id: uid('v'), role: 'visitor', text: trimmed, source, createdAt: Date.now() });
    const turnId = uid('t');
    this.activeTurn = turnId;
    this.pendingResult = false;
    if (!s.transition('THINKING', 'submit')) {
      // from RESULT/ERROR etc. go through the rest state first
      s.transition(this.restState(), 'submit');
      s.transition('THINKING', 'submit');
    }
    s.setActiveTurn(turnId);
    /**
     * The index is fetched when the panel opens, but a visitor can type faster than a
     * network round trip. Every slug check fails closed until it lands, so a sentence that
     * overtook it had each of its tool calls refused as an invented piece — the concierge
     * appeared not to recognise the very piece the visitor was standing on. Awaiting it
     * here costs nothing once it has arrived, which is every sentence after the first.
     */
    void loadIndex()
      .catch(() => undefined)
      .then(() => this.provider.submitText(trimmed, { turnId, source }))
      .catch((e) => {
        this.onEvent({ type: 'turn.error', turnId, message: e instanceof Error ? e.message : 'provider', recoverable: true });
      });
  }

  /** Drops one standing condition — see `ContextRibbon`. */
  dropTerm(key: Parameters<typeof this.store.dropTerm>[0]) {
    this.store.dropTerm(key);
  }

  retry() {
    const last = this.store.lastVisitorText;
    if (last) this.submitText(last, 'text');
  }

  /**
   * A click on a piece is not a sentence.
   *
   * It used to synthesise "Open the {name}" and push it through the whole engine — the
   * parser, the planner, and with a key configured a model turn — to rediscover the slug
   * that was in the caller's hand the entire time. That cost a round trip and a little
   * money for a certainty, and could get it wrong: two pieces are both called "Gold
   * Pendant", and only the item code tells them apart.
   *
   * So the tool is dispatched directly. It still passes the validator inside `executeTool`,
   * so a slug the catalogue does not carry is refused here exactly as it would be anywhere
   * else, and the events are the ones every provider emits — the UI cannot tell the
   * difference, which is the point.
   */
  tapCard(slug: string, name: string) {
    const turnId = uid('t');
    const callId = uid('c');
    this.activeTurn = turnId;
    this.pendingResult = false;
    this.spokenText = '';
    this.store.setError(null);
    this.onEvent({ type: 'turn.start', turnId });
    this.onEvent({ type: 'tool.call', turnId, callId, name: 'openProduct', args: { slug } });
    void executeTool('openProduct', { slug })
      .then((outcome) => {
        this.onEvent({ type: 'tool.result', turnId, callId, outcome });
        this.onEvent({ type: 'text.done', turnId, text: CONCIERGE.opened(name) });
        this.onEvent({ type: 'turn.done', turnId });
      })
      .catch(() => {
        this.onEvent({ type: 'turn.error', turnId, message: CONCIERGE.error, recoverable: false });
      });
  }

  /** Two or three pieces side by side — dispatched directly, exactly as a tap on a card is. */
  comparePieces(slugs: string[]) {
    const turnId = uid('t');
    const callId = uid('c');
    this.activeTurn = turnId;
    this.pendingResult = false;
    this.spokenText = '';
    this.store.setError(null);
    this.onEvent({ type: 'turn.start', turnId });
    this.onEvent({ type: 'tool.call', turnId, callId, name: 'comparePieces', args: { slugs } });
    void executeTool('comparePieces', { slugs })
      .then((outcome) => {
        this.onEvent({ type: 'tool.result', turnId, callId, outcome });
        const ui = outcome.ui;
        this.onEvent({ type: 'text.done', turnId, text: ui?.kind === 'compare' ? CONCIERGE.compared(ui.pieces.map((p) => p.name)) : CONCIERGE.whichToCompare });
        this.onEvent({ type: 'turn.done', turnId });
      })
      .catch(() => {
        this.onEvent({ type: 'turn.error', turnId, message: CONCIERGE.error, recoverable: false });
      });
  }

  cancelTurn() {
    this.spokenText = '';
    if (this.activeTurn) this.provider.cancelTurn(this.activeTurn);
    const s = this.store;
    if (s.activeTurnId) {
      s.patchTurn(s.activeTurnId, { streaming: false });
      s.setActiveTurn(null);
    }
    this.activeTurn = null;
  }

  private onEvent(e: ProviderEvent) {
    const s = this.store;
    switch (e.type) {
      case 'turn.start': {
        const turn: ConciergeTurn = { id: e.turnId, role: 'concierge', text: '', streaming: true, source: 'system', createdAt: Date.now() };
        s.appendTurn(turn);
        s.setActiveTurn(e.turnId);
        break;
      }
      case 'tool.call': {
        s.transition('EXECUTING_ACTION', e.name);
        s.upsertTool(e.turnId, { id: e.callId, name: e.name, label: '', status: 'running', startedAt: Date.now() });
        break;
      }
      case 'tool.result': {
        const o = e.outcome;
        s.upsertTool(e.turnId, { id: e.callId, name: 'tool', label: o.label, status: 'done', startedAt: Date.now(), finishedAt: Date.now() });
        if (o.ui) {
          s.setResult(e.turnId, o.ui);
          this.pendingResult = true;
          /**
           * Results go to the vitrine; the associate stays in the room.
           *
           * Collapsing the rail here took the composer away with it, so after any search there
           * was no way to say the next thing without first clicking the ticket to bring the
           * panel back. "Show me 21K gold rings under 15 grams" and then "Now bracelets" — the
           * follow-up the standing topic exists to serve — cost an extra click every time, and
           * the ribbon explaining that topic disappeared at the same moment.
           *
           * The three zones are the answer, and the tray already knew it: it pads its cards
           * clear of the rail whenever the panel is full. Only an action that takes over the
           * *stage* — opening a piece, navigating, the consultation — collapses the rail, and
           * each of those says so with `compact` on its own outcome.
           */
          if (o.ui.kind === 'pieces' || o.ui.kind === 'wishlist' || o.ui.kind === 'collections' || o.ui.kind === 'compare') {
            s.setTrayOpen(o.ui.kind !== 'wishlist' || o.ui.pieces.length > 0);
          }
        }
        if (o.compact) s.setPanel('compact');
        break;
      }
      case 'tool.error': {
        s.upsertTool(e.turnId, { id: e.callId, name: 'tool', label: CONCIERGE.error, status: 'error', startedAt: Date.now(), finishedAt: Date.now() });
        break;
      }
      case 'text.ready': {
        if (s.mode === 'voice' && s.voice.spokenReplies && speechAvailable()) {
          /**
           * "No voice for this language" is a modifier on SPEAKING, not a tenth state — the
           * nine states are unchanged. The concierge still answers; it simply says once that
           * the answer will be written rather than spoken, and never reads Urdu aloud in an
           * English voice to avoid the admission.
           */
          if (planSpeech(e.text).missingAVoice && !this.saidNoVoice) {
            this.saidNoVoice = true;
            s.appendTurn({ id: uid('c'), role: 'concierge', text: CONCIERGE.noVoiceForLanguage, source: 'system', createdAt: Date.now() });
          }
          this.spokenText = e.text;
          this.say(e.text);
        }
        break;
      }
      case 'text.delta': {
        if (s.state !== 'SPEAKING') s.transition('SPEAKING', 'delta');
        s.appendDelta(e.turnId, e.delta);
        break;
      }
      case 'text.done': {
        /**
         * The finished reply, not merely the end of one. A turn's text was assembled purely
         * from deltas, so any reply the streaming path could not break into sentences —
         * every Urdu one, before the terminators above — reached the visitor as an empty
         * bubble. This frame carries the filtered text the server settled on, so it is the
         * authority; deltas are the preview of it.
         */
        s.patchTurn(e.turnId, e.text ? { text: e.text, streaming: false } : { streaming: false });
        /**
         * The rest of the reply, once it is known. The model path voices its first sentence
         * from text.ready and used to stop there — a two-sentence answer, the register's whole
         * allowance, was written in full and voiced in half. The remainder is said from here.
         */
        if (s.mode === 'voice' && s.voice.spokenReplies && speechAvailable() && e.text) {
          const rest = this.spokenText && e.text.startsWith(this.spokenText) ? e.text.slice(this.spokenText.length).trim() : this.spokenText ? '' : e.text;
          if (rest) {
            this.spokenText = e.text;
            this.say(rest);
          }
        }
        break;
      }
      case 'turn.done': {
        s.setActiveTurn(null);
        this.activeTurn = null;
        const tier = useQualityStore.getState().tier;
        const hold = tier === 'REDUCED' ? 600 : buildSiteContext().viewport === 'mobile' ? 1000 : 1400;
        const finish = () => {
          const rest = this.restState();
          const cur = this.store.state;
          if (cur === 'RESULT' || cur === 'SPEAKING' || cur === 'EXECUTING_ACTION' || cur === 'THINKING') this.store.transition(rest, 'turn.done');
          this.maybeResumeListening();
        };
        // nothing settles to rest while the reply is still being said
        const settle = () => {
          if (this.speaking) this.afterSpeech = finish;
          else finish();
        };
        if (this.pendingResult && s.transition('RESULT', 'turn.done')) this.later(hold, settle);
        else settle();
        if (s.turns.length && s.turns[s.turns.length - 1]?.text === CONCIERGE.close) this.later(900, () => this.close());
        break;
      }
      case 'turn.error': {
        if (e.turnId === 'attach') return;
        s.setActiveTurn(null);
        this.activeTurn = null;
        if (s.activeTurnId) s.patchTurn(s.activeTurnId, { streaming: false });
        s.setError({ code: 'PROVIDER', message: CONCIERGE.error });
        s.transition('ERROR', e.message);
        this.later(3200, () => {
          if (this.store.state === 'ERROR') this.store.transition(this.restState(), 'error.auto');
        });
        break;
      }
      case 'voice.session':
        s.setVoice({ sessionLive: e.status === 'live' });
        break;
      case 'voice.listening':
        if (e.active) s.transition('LISTENING', 'native');
        else if (s.state === 'LISTENING') s.transition('VOICE_READY', 'native');
        break;
      case 'voice.transcript':
        s.setTranscript({ interim: e.final ? '' : e.text, final: e.final ? e.text : s.transcript.final, active: !e.final });
        break;
      case 'voice.speaking':
        this.speaking = e.active;
        break;
    }
  }

  private maybeResumeListening() {
    const s = this.store;
    // only after the visitor actually spoke through the microphone — never after a scripted example
    if (s.mode !== 'voice' || !s.voice.sessionLive || (s.voice.adapter !== 'webspeech' && s.voice.adapter !== 'server')) return;
    const check = () => {
      if (this.store.state !== 'VOICE_READY') return;
      if (this.speaking || voiceMeter.speech > 0.05) {
        this.later(300, check);
        return;
      }
      this.startListening();
    };
    this.later(400, check);
  }

  /** One reply through the speaking seam; the state follows the audio, not the text stream. */
  private say(text: string) {
    this.speaking = true;
    this.speechQueue = this.speechQueue
      .then(() =>
        speak(text, {
          onStart: () => {
            const st = this.store.state;
            if (st === 'THINKING' || st === 'EXECUTING_ACTION') this.store.transition('SPEAKING', 'audio');
            this.armBargeIn();
          },
          onEnd: () => {
            this.speaking = false;
            this.disarmBargeIn();
            const after = this.afterSpeech;
            this.afterSpeech = null;
            after?.();
          },
        }),
      )
      .catch(() => {
        this.speaking = false;
      });
  }

  /**
   * Barge-in. While the server voice is speaking the microphone stays lightly open, and a
   * visitor who starts talking is heard rather than made to wait. The browser's own
   * synthesis cannot share the microphone with recognition, so there the tap on the ring
   * remains the interruption — and the stage says so.
   */
  private armBargeIn() {
    if (this.bargeTimer || speechEngine().kind !== 'server' || this.store.voice.adapter !== 'server' || this.store.voice.denied) return;
    void startMeter().then((ok) => {
      if (!ok || !this.speaking || this.bargeTimer) {
        if (!this.speaking) stopMeter();
        return;
      }
      let hot = 0;
      this.bargeTimer = window.setInterval(() => {
        if (!this.speaking) return this.disarmBargeIn();
        hot = voiceMeter.level > 0.35 ? hot + 100 : 0;
        if (hot >= 300) {
          this.disarmBargeIn();
          this.startListening();
        }
      }, 100);
    });
  }

  private disarmBargeIn() {
    if (this.bargeTimer) window.clearInterval(this.bargeTimer);
    this.bargeTimer = null;
    stopMeter();
  }

  // ── voice ─────────────────────────────────────────────────────────────────
  /**
   * Which engine listens is not this class's decision any more — it belongs with the
   * capabilities probe that also chooses the text model, so that adding a realtime voice
   * to a deployment changes one server variable and nothing in the UI.
   */
  private chooseAdapter(forceScripted = false, preferBrowser = false): VoiceAdapter {
    const { adapter, kind } = chooseVoiceEngine({
      forceScripted,
      preferBrowser,
      language: this.store.memory.language,
      exampleLine: () => {
        const routeKind = useSiteStore.getState().routeKind;
        const lines = EXAMPLE_SCRIPTS[routeKind];
        const line = lines[this.exampleIndex % lines.length]!;
        this.exampleIndex += 1;
        return line;
      },
    });
    this.store.setVoice({ adapter: kind });
    return adapter;
  }

  startListening(forceScripted = false, preferBrowser = false) {
    const s = this.store;
    // a mic opened over the concierge's own sentence is an interruption, and the stage says so
    const interrupted = s.state === 'SPEAKING' || this.speaking;
    if (s.mode !== 'voice') s.setMode('voice');
    if (s.state === 'CHAT' || s.state === 'RESULT' || s.state === 'ERROR' || s.state === 'SPEAKING') s.transition('VOICE_READY', 'listen');
    if (this.store.state !== 'VOICE_READY' || this.store.voice.preparing) return;
    // a tap is the moment a phone will let a later reply play aloud
    primeAudio();
    cancelSpeech();
    this.cancelTurn();
    this.adapter?.abort();
    const adapter = this.chooseAdapter(forceScripted, preferBrowser);
    this.adapter = adapter;
    s.setError(null);
    s.setTranscript({ interim: '', final: '', active: false, interrupted });
    // the machine holds at VOICE_READY until the microphone is truly open: "Listening."
    // must never be shown while the browser is still asking the visitor for permission
    s.setVoice({ sessionLive: true, preparing: true, transcribing: false });
    this.later(7000, () => {
      if (!this.store.voice.preparing || this.adapter !== adapter) return;
      adapter.abort();
      this.store.setVoice({ preparing: false, sessionLive: false });
      this.store.setError({ code: 'MIC_DENIED', message: CONCIERGE.micNoAnswer });
    });
    /**
     * The language the visitor has been *speaking*, not the one their browser ships in.
     *
     * `navigator.language` is a property of the device. A Lahore customer on an en-US phone
     * asking in Urdu was transcribed as English and understood as nonsense — and the old gate
     * fell back to en-IN for every language but English and Urdu, so Punjabi never had a
     * chance. `lang` is per-instance and a fresh instance is built for every utterance, so
     * this follows the conversation for free.
     */
    const lang = recognitionLang(this.store.memory.language);
    void adapter.start({
      lang,
      onStart: () => {
        this.store.setVoice({ preparing: false, denied: false });
        this.store.setTranscript({ active: true });
        this.store.transition('LISTENING', 'mic');
      },
      onInterim: (text) => this.store.setTranscript({ interim: text, active: true }),
      onTranscribing: () => this.store.setVoice({ transcribing: true }),
      onFinal: (text, meta) => {
        this.store.setVoice({ transcribing: false });
        // the server tier can tell which script it heard; the browser tier listens in it next time
        if (meta?.language === 'ur' || meta?.language === 'pa-Guru') this.store.rememberLanguage(meta.language);
        this.store.setTranscript({ interim: '', final: text, active: false });
        this.submitText(text, adapter.kind === 'scripted' ? 'example' : 'voice');
      },
      onEnd: () => {
        this.store.setTranscript({ active: false });
        this.store.setVoice({ preparing: false, transcribing: false });
        if (this.store.state === 'LISTENING') this.store.transition('VOICE_READY', 'end');
      },
      onError: ({ code }) => {
        const st = this.store;
        st.setTranscript({ active: false });
        st.setVoice({ preparing: false, transcribing: false });
        if (code === 'NO_SPEECH') {
          st.setError({ code: 'NO_SPEECH', message: CONCIERGE.noSpeech });
          st.transition('VOICE_READY', 'no-speech');
          return;
        }
        if (code === 'NETWORK' || code === 'UNSUPPORTED') {
          st.transition('VOICE_READY', 'network');
          // the server tier could not hear this utterance: the browser's own hearing takes it
          if (adapter.kind === 'server' && !preferBrowser && recognitionSupported()) {
            this.later(150, () => this.startListening(false, true));
            return;
          }
          // never a silent example in the visitor's name: say so, and leave the offer standing
          st.setError({ code: 'NETWORK', message: CONCIERGE.voice.hearingUnavailable });
          return;
        }
        st.setError({ code: 'MIC_DENIED', message: CONCIERGE.micDenied });
        st.setVoice({ sessionLive: false, denied: true });
        st.transition('ERROR', code);
        this.later(3200, () => {
          if (this.store.state === 'ERROR') this.store.transition('VOICE_READY', 'error.auto');
        });
      },
    });
  }

  /**
   * "Send now." A tap on the ring while it listens finalises what was heard; the conversation
   * stays live, so the microphone reopens after the reply exactly as it does when a pause
   * ended the sentence. Only the scripted example ends its session here — it was never a
   * conversation.
   */
  stopListening() {
    const scripted = this.adapter?.kind === 'scripted';
    this.adapter?.stop();
    this.store.setVoice({ sessionLive: scripted ? false : this.store.voice.sessionLive, preparing: false });
  }

  runExample() {
    this.startListening(true);
  }

  toggleSpokenReplies() {
    const s = this.store;
    s.setVoice({ spokenReplies: !s.voice.spokenReplies });
    if (s.voice.spokenReplies) cancelSpeech();
  }

  /** Development only: force a state so every visual can be polished without the intelligence. */
  devPreview(state: ConciergeState) {
    if (process.env.NODE_ENV !== 'development') return;
    const s = this.store;
    this.clearTimers();
    const voice = ['VOICE_READY', 'LISTENING', 'SPEAKING'].includes(state);
    useConciergeStore.setState({
      state,
      panel: state === 'IDLE' || state === 'HOVER' ? 'closed' : 'full',
      mode: voice ? 'voice' : s.mode,
      error: state === 'ERROR' ? { code: 'PROVIDER', message: 'Forgive me — shall we try that once more?' } : null,
      transcript: state === 'LISTENING' ? { interim: 'Show me bridal necklaces', final: '', active: true, interrupted: false } : s.transcript,
    });
  }
}

declare global {
  interface Window {
    __wjConcierge?: ConciergeController;
  }
}

/** Lazily constructed on the client; HMR-safe via globalThis. */
export function getController(): ConciergeController {
  if (typeof window === 'undefined') throw new Error('ConciergeController is client-only');
  if (!window.__wjConcierge) window.__wjConcierge = new ConciergeController();
  return window.__wjConcierge;
}
