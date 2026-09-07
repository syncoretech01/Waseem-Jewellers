'use client';

import { useConciergeStore, type ConciergeMode, type ConciergeState, type ConciergeTurn, type TurnSource } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { useQualityStore } from '@/state/qualityStore';
import { buildSiteContext } from './context';
import { createProvider } from './createProvider';
import { executeTool } from './tools/executeTool';
import { TOOL_DEFS } from './tools/toolDefs';
import { CONCIERGE } from './copy';
import { ScriptedExampleAdapter, WebSpeechAdapter, recognitionSupported, type VoiceAdapter } from './voice/adapters';
import { cancelSpeech, speak, synthesisSupported } from './voice/speech';
import { voiceMeter } from './voice/meter';
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
    useConciergeStore.getState().setVoice({ recognition: recognitionSupported(), synthesis: synthesisSupported() });
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
    this.clearTimers();
    s.setTrayOpen(false);
    s.setPanel('closed');
    s.setTranscript({ interim: '', final: '', active: false });
    s.setVoice({ sessionLive: false });
    s.transition('IDLE', 'close');
  }

  setMode(mode: ConciergeMode) {
    const s = this.store;
    if (s.mode === mode) return;
    if (s.state === 'LISTENING') this.stopListening();
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
    this.store.forget();
  }

  // ── turns ─────────────────────────────────────────────────────────────────
  submitText(text: string, source: TurnSource = 'text') {
    const trimmed = text.trim();
    if (!trimmed) return;
    const s = this.store;
    if (s.state === 'LISTENING') this.adapter?.abort();
    this.cancelTurn();
    cancelSpeech();
    s.setError(null);
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
    void this.provider.submitText(trimmed, { turnId, source }).catch((e) => {
      this.onEvent({ type: 'turn.error', turnId, message: e instanceof Error ? e.message : 'provider', recoverable: true });
    });
  }

  retry() {
    const last = this.store.lastVisitorText;
    if (last) this.submitText(last, 'text');
  }

  tapCard(slug: string, name: string) {
    this.submitText(`Open the ${name}`, 'card');
    void slug;
  }

  cancelTurn() {
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
          if (o.ui.kind === 'pieces' || o.ui.kind === 'wishlist' || o.ui.kind === 'collections') {
            s.setTrayOpen(o.ui.kind !== 'wishlist' || o.ui.pieces.length > 0);
            s.setPanel('compact');
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
        if (s.mode === 'voice' && s.voice.spokenReplies && synthesisSupported()) {
          this.speaking = true;
          void speak(e.text, { onEnd: () => (this.speaking = false) });
        }
        break;
      }
      case 'text.delta': {
        if (s.state !== 'SPEAKING') s.transition('SPEAKING', 'delta');
        s.appendDelta(e.turnId, e.delta);
        break;
      }
      case 'text.done': {
        s.patchTurn(e.turnId, { streaming: false });
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
        if (this.pendingResult && s.transition('RESULT', 'turn.done')) this.later(hold, finish);
        else finish();
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
    if (s.mode !== 'voice' || !s.voice.sessionLive || s.voice.adapter !== 'webspeech') return;
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

  // ── voice ─────────────────────────────────────────────────────────────────
  private chooseAdapter(forceScripted = false): VoiceAdapter {
    const s = this.store;
    if (!forceScripted && recognitionSupported() && !/Firefox/i.test(navigator.userAgent)) {
      s.setVoice({ adapter: 'webspeech' });
      return new WebSpeechAdapter();
    }
    s.setVoice({ adapter: 'scripted' });
    return new ScriptedExampleAdapter(() => {
      const kind = useSiteStore.getState().routeKind;
      const lines = EXAMPLE_SCRIPTS[kind];
      const line = lines[this.exampleIndex % lines.length]!;
      this.exampleIndex += 1;
      return line;
    });
  }

  startListening(forceScripted = false) {
    const s = this.store;
    if (s.mode !== 'voice') s.setMode('voice');
    if (s.state === 'CHAT' || s.state === 'RESULT' || s.state === 'ERROR' || s.state === 'SPEAKING') s.transition('VOICE_READY', 'listen');
    if (this.store.state !== 'VOICE_READY') return;
    cancelSpeech();
    this.cancelTurn();
    this.adapter?.abort();
    const adapter = this.chooseAdapter(forceScripted);
    this.adapter = adapter;
    s.setError(null);
    s.setTranscript({ interim: '', final: '', active: true });
    s.setVoice({ sessionLive: true });
    if (!s.transition('LISTENING', 'mic')) return;
    const lang = navigator.language && /^(en|ur)/i.test(navigator.language) ? navigator.language : 'en-IN';
    void adapter.start({
      lang,
      onStart: () => undefined,
      onInterim: (text) => this.store.setTranscript({ interim: text, active: true }),
      onFinal: (text) => {
        this.store.setTranscript({ interim: '', final: text, active: false });
        this.submitText(text, adapter.kind === 'scripted' ? 'example' : 'voice');
      },
      onEnd: () => {
        this.store.setTranscript({ active: false });
        if (this.store.state === 'LISTENING') this.store.transition('VOICE_READY', 'end');
      },
      onError: ({ code }) => {
        const st = this.store;
        st.setTranscript({ active: false });
        if (code === 'NO_SPEECH') {
          st.setError({ code: 'NO_SPEECH', message: CONCIERGE.noSpeech });
          st.transition('VOICE_READY', 'no-speech');
          return;
        }
        if (code === 'NETWORK' || code === 'UNSUPPORTED') {
          // first network failure → the scripted example for the rest of the session
          st.transition('VOICE_READY', 'network');
          this.later(200, () => this.startListening(true));
          return;
        }
        st.setError({ code: 'MIC_DENIED', message: CONCIERGE.micDenied });
        st.setVoice({ sessionLive: false });
        st.transition('ERROR', code);
        this.later(3200, () => {
          if (this.store.state === 'ERROR') this.store.transition('VOICE_READY', 'error.auto');
        });
      },
    });
  }

  stopListening() {
    this.adapter?.stop();
    this.store.setVoice({ sessionLive: false });
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
      transcript: state === 'LISTENING' ? { interim: 'Show me bridal necklaces', final: '', active: true } : s.transcript,
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
