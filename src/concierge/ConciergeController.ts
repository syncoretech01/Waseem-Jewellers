'use client';

import { useConciergeStore, OPEN_STATES, type ConciergeMode, type ConciergeState, type ConciergeTurn, type TurnSource } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { useQualityStore } from '@/state/qualityStore';
import { buildSiteContext } from './context';
import { getRow, loadIndex, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { canonicalCategory } from '@/data/vocabulary';
import { CATEGORY_PLURAL } from '@/data/labels';
import type { Category } from '@/data/types';
import { chooseVoiceEngine, hearingAvailable, type VoiceTier } from './voice/engine';
import { liveMark, liveTrace, registerLiveEngine, type TraceEntry } from './voice/live';
import { topicLine } from './memory';
import { probeCapabilities } from './capabilities';
import { createProvider } from './createProvider';
import { executeTool } from './tools/executeTool';
import { TOOL_DEFS } from './tools/toolDefs';
import { summariseDraft } from './tools/appointment';
import { asReplyLanguage, replies, subjectIn } from './replies';
import { qaTrace, recordTrace, type QaEntry } from './qa';
import type { VoiceAdapter } from './voice/adapters';
import { EXAMPLE_SCRIPTS } from './voice/scripts';
import type { ConciergeProvider, ProviderEvent, ProviderRuntime, ToolName, ToolOutcome, TurnTrace } from './types';

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
 * Owns the provider, the voice adapter and every timer.
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
  /** The session's voice is playing: the state follows the audio, and nothing settles under it. */
  private speaking = false;
  /** Runs when the voice finishes, if a turn ended while the reply was still being said. */
  private afterSpeech: (() => void) | null = null;
  /** The element that had focus when the salon opened. */
  private opener: HTMLElement | null = null;
  private afterOpen: (() => void) | null = null;
  private draftListeners = new Set<(draft: string) => void>();
  /** Words for a composer that has not mounted yet — "Correct it" switches to chat and the field arrives a render later. */
  private pendingDraft: string | null = null;
  /** The visitor rested the microphone of a live session; it does not reopen by itself. */
  private micPaused = false;
  /** The visitor has spoken to the live session, so a typed sentence continues that conversation. */
  private voiceUsed = false;
  /** The session could not be opened: said once, and not asked for again for half a minute, or until "Try again". */
  private voiceRefused = false;
  private refusedAt = 0;
  /** The deployment has answered what it offers; before that, the asked-for mode stands. */
  private probed = false;
  /** The controller's own marks on the voice timeline: the tap, the stage's states. Read by scripts/dev/voice-latency.mjs. */
  private marks: TraceEntry[] = [];
  /** What each turn reported about itself — the rung, the plan — read back when the turn ends. */
  private traces = new Map<string, TurnTrace>();

  constructor() {
    this.provider = createProvider();
    const runtime: ProviderRuntime = {
      getCurrentContext: buildSiteContext,
      executeTool: (name, args) => executeTool(name, args),
      emit: (e) => this.onEvent(e),
      toolDefs: TOOL_DEFS,
    };
    this.provider.attach(runtime);
    registerLiveEngine();
    this.refreshVoiceSupport();
    if (typeof window !== 'undefined') window.__wjVoiceTrace = liveTrace;
    useConciergeStore.subscribe((s, prev) => {
      if (s.state !== prev.state) this.mark(`state:${s.state}`, s.reason);
    });
  }

  /** One entry on the voice timeline, from this side of the seam. */
  private mark(type: string, detail?: string) {
    const entry = { t: Date.now(), type, detail };
    this.marks.push(entry);
    if (this.marks.length > 400) this.marks.splice(0, this.marks.length - 400);
    liveMark(type, detail);
  }

  /** The timeline the latency harness reads: the controller's marks; the adapter's trace is `window.__wjVoiceTrace()`. */
  timeline(): TraceEntry[] {
    return this.marks;
  }

  /** Which engine answered each turn, and why — the QA record. Never shown to a visitor. */
  qaTrace(): readonly QaEntry[] {
    return qaTrace();
  }

  /** The reply table for the language the visitor has been using. */
  private get R() {
    return replies(this.store.memory.language);
  }

  /**
   * What the live session is told about the page: the piece in view with what Waseem
   * publishes about it, the pieces just shown with their ordinals, the standing request,
   * the language so far, the state of the appointment form. Small, and every fact in it
   * published — the same rule as the text path's grounding, rendered for a model that hears
   * "the second one".
   */
  private voiceContext() {
    const site = useSiteStore.getState();
    const c = this.store;
    const inView = site.currentProduct ?? site.focusedProduct;
    const row = inView ? getRow(inView) : undefined;
    const factsOf = (slug: string, fallback: string) => {
      const r = getRow(slug);
      return r ? specLineOf(r) || priceLabelOf(r) : fallback;
    };
    const gallery = row && site.gallery?.slug === row.s ? site.gallery : null;
    return {
      route: site.pathname || '/',
      pieceInView: row ? { slug: row.s, name: row.t, facts: specLineOf(row) || priceLabelOf(row) } : null,
      recent: c.recentResults.slice(0, 6).map((p, i) => ({ ordinal: i + 1, slug: p.slug, name: p.name, facts: factsOf(p.slug, p.priceLabel) })),
      standing: topicLine(c.memory.standingSlots),
      language: c.memory.language ?? undefined,
      frames: gallery?.count,
      // the form's state, never the visitor's details: those travel only when a tool is asked for them
      appointment: site.consultation.open || site.consultation.draft ? `${site.consultation.open ? 'open' : 'closed'} — ${summariseDraft(site.consultation.draft)}` : undefined,
    };
  }

  /** What this device can hear with, by what the deployment offers. The session speaks for itself. */
  private refreshVoiceSupport() {
    this.store.setVoice({ recognition: hearingAvailable(), synthesis: hearingAvailable() });
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

  private get session(): VoiceAdapter | null {
    return this.adapter?.kind === 'realtime' && this.adapter.isLive?.() ? this.adapter : null;
  }

  onDraft(fn: (draft: string) => void) {
    this.draftListeners.add(fn);
    const held = this.pendingDraft;
    if (held) {
      this.pendingDraft = null;
      fn(held);
    }
    return () => {
      this.draftListeners.delete(fn);
    };
  }

  private draft(text: string) {
    if (this.draftListeners.size === 0) this.pendingDraft = text;
    else this.draftListeners.forEach((fn) => fn(text));
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
     * The catalogue index arrives with the concierge, not with the page. Every lookup below
     * it — search, similar, the name of a piece, and above all whether a slug is real — reads
     * the index, so it is fetched the moment the panel opens rather than on a visitor's first
     * sentence. A visitor who never asks never pays for it.
     */
    void loadIndex();
    /**
     * A voice stage with nothing to hear with is an apology; the composer is the honest
     * opening. Until the deployment has answered what it offers, the asked-for mode stands
     * — the probe is a round trip, and a stage that opened in writing because the answer was
     * a hundred milliseconds away would be the wrong door.
     */
    const wanted = opts.mode ?? s.mode;
    const mode = wanted === 'voice' && this.probed && !hearingAvailable() ? 'chat' : wanted;
    s.setMode(mode);
    // what this deployment is allowed to be: model or keyless, and whether it hears — and once
    // that is known, the stage that is about to show has its session opened, so the tap only
    // attaches the microphone; a deployment with no voice moves the stage to the composer
    void probeCapabilities().then(() => {
      this.probed = true;
      this.refreshVoiceSupport();
      if (!OPEN_STATES.includes(this.store.state)) return;
      if (this.store.mode === 'voice' && !hearingAvailable()) {
        this.store.setMode('chat');
        if (this.store.state === 'VOICE_READY') this.store.transition('CHAT', 'no-voice');
        return;
      }
      if (this.store.mode === 'voice') this.warmVoice();
    });
    if (s.state === 'IDLE' || s.state === 'HOVER') {
      s.transition('OPENING', 'open');
      s.setPanel('full');
    } else {
      s.setPanel('full');
    }
    if (!s.greeted) {
      const hour = new Date().getHours();
      // the greeting follows the language the visitor used earlier in this tab, if any
      s.appendTurn({ id: uid('c'), role: 'concierge', text: this.R.greeting(hour), source: 'system', createdAt: Date.now() });
      s.setGreeted(true);
    }
    const after = () => {
      if (opts.prefill) this.draft(opts.prefill);
      if (opts.submit) this.submitText(opts.submit, 'text');
      else if (opts.example) this.runExample();
      else if (opts.autoListen && this.store.mode === 'voice') this.startListening();
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
    // the conversation ends with the panel: the session is closed gracefully and released
    const session = this.session;
    if (session?.close) void session.close();
    else this.adapter?.abort();
    this.afterSpeech = null;
    this.speaking = false;
    this.clearTimers();
    s.setTrayOpen(false);
    s.setPanel('closed');
    s.setTranscript({ interim: '', final: '', active: false });
    s.setVoice({ sessionLive: false, preparing: false });
    this.micPaused = false;
    this.voiceUsed = false;
    this.voiceRefused = false;
    s.transition('IDLE', 'close');
    // back to the orb, or the ENQUIRE button, or wherever it was — not to <body>
    const opener = this.opener;
    this.opener = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  setMode(mode: ConciergeMode) {
    const s = this.store;
    if (s.mode === mode) return;
    // "Write" mid-sentence: a live session rests its microphone rather than ending — the typed
    // sentence joins the same conversation
    const session = this.session;
    if (s.state === 'LISTENING' || s.voice.preparing) {
      if (session) {
        session.stop();
        this.micPaused = true;
      } else this.adapter?.abort();
      s.setVoice({ preparing: false, sessionLive: session ? s.voice.sessionLive : false });
      s.setTranscript({ interim: '', final: '', active: false });
      if (this.store.state === 'LISTENING') s.transition('VOICE_READY', 'mode');
    } else if (session && mode === 'chat') {
      // the keyboard has the floor in every state, not only mid-sentence: a microphone the
      // visitor cannot see must not keep hearing the room from behind the composer
      session.stop();
      this.micPaused = true;
    }
    s.setMode(mode);
    const cur = this.store.state;
    if (cur === 'CHAT' || cur === 'VOICE_READY' || cur === 'RESULT' || cur === 'ERROR') s.transition(mode === 'voice' ? 'VOICE_READY' : 'CHAT', 'mode');
    if (mode === 'voice') void probeCapabilities().then(() => this.warmVoice());
  }

  /**
   * The session before the tap: opened the moment the stage is shown, or a pointer reaches
   * the microphone, with no permission asked — the tap only attaches the microphone. A
   * failure here is silent; the tap reports it, once, and the written concierge answers.
   */
  warmVoice() {
    if (this.store.voice.denied || (this.voiceRefused && Date.now() - this.refusedAt < ConciergeController.REFUSAL_MS)) return;
    if (this.session) return;
    const adapter = this.chooseAdapter('auto');
    if (adapter.kind !== 'realtime' || !adapter.warm) return;
    this.adapter = adapter;
    this.mark('warm');
    void adapter.warm().then((live) => this.mark(live ? 'warm.live' : 'warm.failed'));
  }

  /**
   * "Show nearby pieces": the same request with its conditions set aside — the kind alone,
   * or the material alone — dispatched directly, exactly as a tap on a card is.
   */
  nearby() {
    const slots = this.store.memory.standingSlots;
    const category = canonicalCategory(slots.category);
    const material = category ? undefined : slots.material;
    const args: Record<string, unknown> = { limit: 6 };
    if (category) args.category = category;
    else if (material) args.material = material;
    const what = category ? (CATEGORY_PLURAL[category as Category] ?? category).toLowerCase() : material ? `${material} pieces` : 'pieces';
    const language = asReplyLanguage(this.store.memory.language) ?? 'en';
    this.store.forgetTopic();
    this.cancelTurn();
    const turnId = uid('t');
    const callId = uid('c');
    this.activeTurn = turnId;
    this.pendingResult = false;
    this.store.setError(null);
    this.store.setLastVisitorText(`Nearby ${what}`);
    this.onEvent({ type: 'turn.start', turnId });
    this.onEvent({ type: 'tool.call', turnId, callId, name: 'searchProducts', args });
    void executeTool('searchProducts', args)
      .then((outcome) => {
        this.onEvent({ type: 'tool.result', turnId, callId, outcome });
        const found = outcome.ui?.kind === 'pieces' ? outcome.ui.pieces.length : 0;
        this.onEvent({ type: 'text.done', turnId, text: found ? this.R.nearby(found, subjectIn(language, { category: category ?? undefined, material }, found)) : this.R.nearbyNothing });
        this.onEvent({ type: 'turn.done', turnId });
      })
      .catch(() => {
        this.onEvent({ type: 'turn.error', turnId, message: this.R.error, recoverable: false });
      });
  }

  /** "The bridal pieces": the standing offer behind every empty answer. */
  bridalPieces() {
    this.submitText('Show me bridal pieces', 'card');
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
    const session = this.session;
    if (session?.close) void session.close();
    else this.adapter?.abort();
    this.micPaused = false;
    this.voiceUsed = false;
    this.voiceRefused = false;
    this.store.setVoice({ sessionLive: false, denied: false });
    this.store.forget();
    // begun again: the standing topic goes with the conversation; the visitor's language stays
    this.store.forgetTopic();
    // a fresh conversation, and the session for it opened now rather than on the next tap
    if (this.store.mode === 'voice') void probeCapabilities().then(() => this.warmVoice());
  }

  // ── turns ─────────────────────────────────────────────────────────────────
  submitText(text: string, source: TurnSource = 'text') {
    const trimmed = text.trim();
    if (!trimmed) return;
    const s = this.store;
    /**
     * A live session takes a typed sentence only when it is the visitor's conversation: the
     * stage is up, or they rested its microphone to write ("Write instead"). A session that
     * was merely opened early — a pointer over the microphone, say — is not yet a
     * conversation, and a typed sentence goes to the text engine, which does not speak unasked.
     */
    const session = this.session && (s.mode === 'voice' || this.voiceUsed) ? this.session : null;
    if ((s.state === 'LISTENING' || s.voice.preparing) && !session) {
      this.adapter?.abort();
      s.setVoice({ preparing: false, sessionLive: false });
    }
    this.cancelTurn();
    this.clearTimers(); // a previous result's hold must not settle this turn
    s.setError(null);
    // only a spoken turn leaves its words on the voice stage as "heard —"
    if (source !== 'voice' && source !== 'example') s.setTranscript({ interim: '', final: '', active: false });
    s.setTrayOpen(false);
    s.setLastVisitorText(trimmed);
    if (source !== 'card') s.appendTurn({ id: uid('v'), role: 'visitor', text: trimmed, source, createdAt: Date.now() });
    /**
     * A typed sentence into a live voice session goes to the same conversation the visitor
     * has been speaking to — "second wala kholo" written after it was misheard still means
     * the second piece the session just brought. The session routes it and emits the turn's
     * events itself; the voice says the outcome.
     */
    if (session && session.sendText?.(trimmed)) {
      this.pendingResult = false;
      if (!s.transition('THINKING', 'submit')) {
        s.transition(this.restState(), 'submit');
        s.transition('THINKING', 'submit');
      }
      return;
    }
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
     * overtook it had each of its tool calls refused as an invented piece. Awaiting it here
     * costs nothing once it has arrived, which is every sentence after the first.
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
   * A click on a piece is not a sentence: the tool is dispatched directly. It still passes
   * the validator inside `executeTool`, and the events are the ones every provider emits.
   */
  tapCard(slug: string, name: string) {
    // a tap has the floor: a reply still being said, spoken or streamed, stops here
    this.cancelTurn();
    const turnId = uid('t');
    const callId = uid('c');
    this.activeTurn = turnId;
    this.pendingResult = false;
    this.store.setError(null);
    this.onEvent({ type: 'turn.start', turnId });
    this.onEvent({ type: 'tool.call', turnId, callId, name: 'openProduct', args: { slug } });
    void executeTool('openProduct', { slug })
      .then((outcome) => {
        this.onEvent({ type: 'tool.result', turnId, callId, outcome });
        this.onEvent({ type: 'text.done', turnId, text: this.R.opened(name) });
        this.onEvent({ type: 'turn.done', turnId });
      })
      .catch(() => {
        this.onEvent({ type: 'turn.error', turnId, message: this.R.error, recoverable: false });
      });
  }

  /** Two or three pieces side by side — dispatched directly, exactly as a tap on a card is. */
  comparePieces(slugs: string[]) {
    this.cancelTurn();
    const turnId = uid('t');
    const callId = uid('c');
    this.activeTurn = turnId;
    this.pendingResult = false;
    this.store.setError(null);
    this.onEvent({ type: 'turn.start', turnId });
    this.onEvent({ type: 'tool.call', turnId, callId, name: 'comparePieces', args: { slugs } });
    void executeTool('comparePieces', { slugs })
      .then((outcome) => {
        this.onEvent({ type: 'tool.result', turnId, callId, outcome });
        const ui = outcome.ui;
        this.onEvent({ type: 'text.done', turnId, text: ui?.kind === 'compare' ? this.R.compared(ui.pieces.map((p) => p.name)) : this.R.whichToCompare });
        this.onEvent({ type: 'turn.done', turnId });
      })
      .catch(() => {
        this.onEvent({ type: 'turn.error', turnId, message: this.R.error, recoverable: false });
      });
  }

  /**
   * One tool, run exactly as a provider would run it: the same validator, the same events,
   * the same store transitions — so the harness (`npm run operator:check`) exercises the
   * path a model's call takes rather than a shortcut beside it. Everything it can do the
   * visitor's own hands can do, and every call still passes `validateToolCall`.
   */
  runTool(name: ToolName, args: Record<string, unknown> = {}): Promise<ToolOutcome> {
    const turnId = uid('t');
    const callId = uid('c');
    this.cancelTurn();
    this.activeTurn = turnId;
    this.pendingResult = false;
    this.store.setError(null);
    this.onEvent({ type: 'turn.start', turnId });
    this.onEvent({ type: 'tool.call', turnId, callId, name, args });
    return executeTool(name, args)
      .then((outcome) => {
        this.onEvent({ type: 'tool.result', turnId, callId, outcome });
        this.onEvent({ type: 'text.done', turnId, text: outcome.label });
        this.onEvent({ type: 'turn.done', turnId });
        return outcome;
      })
      .catch((err: unknown) => {
        this.onEvent({ type: 'turn.error', turnId, message: this.R.error, recoverable: false });
        throw err;
      });
  }

  cancelTurn() {
    this.pendingResult = false;
    // a live session's reply is cut on both ends; a text turn is cancelled at the provider
    this.adapter?.interrupt?.();
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
          // results go to the vitrine; the associate stays in the room — only an action that
          // takes over the stage collapses the rail, and each of those says so with `compact`
          if (o.ui.kind === 'pieces' || o.ui.kind === 'collections' || o.ui.kind === 'compare') s.setTrayOpen(true);
        }
        if (o.compact) s.setPanel('compact');
        break;
      }
      case 'tool.error': {
        s.upsertTool(e.turnId, { id: e.callId, name: 'tool', label: this.R.error, status: 'error', startedAt: Date.now(), finishedAt: Date.now() });
        break;
      }
      case 'turn.trace': {
        // a fallback's reason arrives first and the answering engine's reading after it: kept together
        const prior = this.traces.get(e.turnId);
        const merged = prior ? { ...prior, ...e.trace, fallback: e.trace.fallback ?? prior.fallback } : e.trace;
        this.traces.set(e.turnId, merged);
        if (this.traces.size > 60) this.traces.delete(this.traces.keys().next().value!);
        recordTrace(e.turnId, merged);
        break;
      }
      case 'text.ready':
        // the session speaks for itself; the typed concierge writes — nothing here reads a reply aloud
        break;
      case 'text.delta': {
        // a reply that arrives while the stage still says "Listening" (or holds a result) passes through THINKING first
        if (s.state === 'LISTENING' || s.state === 'VOICE_READY' || s.state === 'CHAT' || s.state === 'RESULT') s.transition('THINKING', 'delta');
        if (this.store.state !== 'SPEAKING') this.store.transition('SPEAKING', 'delta');
        s.appendDelta(e.turnId, e.delta);
        break;
      }
      case 'text.done': {
        /**
         * The finished reply, not merely the end of one: this frame carries the text the
         * engine settled on, so it is the authority; deltas are the preview of it.
         */
        s.patchTurn(e.turnId, e.text ? { text: e.text, streaming: false } : { streaming: false });
        break;
      }
      case 'turn.done': {
        s.setActiveTurn(null);
        this.activeTurn = null;
        const tier = useQualityStore.getState().tier;
        const hold = tier === 'REDUCED' ? 600 : buildSiteContext().viewport === 'mobile' ? 1000 : 1400;
        const trace = this.traces.get(e.turnId);
        /**
         * The second sentence in a row the keyless engine could not read: the stage offers
         * writing instead, as the next thing to press, and the microphone does not reopen
         * on its own to ask a third time.
         */
        const offerWrite = trace?.plan === 'unknown.again' && s.mode === 'voice';
        const finish = () => {
          const rest = this.restState();
          const cur = this.store.state;
          if (cur === 'RESULT' || cur === 'SPEAKING' || cur === 'EXECUTING_ACTION' || cur === 'THINKING') this.store.transition(rest, 'turn.done');
          if (offerWrite) {
            this.store.setError({ code: 'NO_SPEECH', message: this.R.writeInstead });
            return;
          }
          this.maybeResumeListening();
        };
        // nothing settles to rest while the reply is still being said
        const settle = () => {
          if (this.speaking) this.afterSpeech = finish;
          else finish();
        };
        // the result belongs to this turn alone; the next one earns its own hold
        const showResult = this.pendingResult;
        this.pendingResult = false;
        if (showResult && s.transition('RESULT', 'turn.done')) this.later(hold, settle);
        else settle();
        // the goodbye, in whichever language it was said: the panel closes after it
        if (trace?.plan === 'close' && trace.rung === 'keyless') this.later(900, () => this.close());
        break;
      }
      case 'turn.error': {
        if (e.turnId === 'attach') return;
        s.setActiveTurn(null);
        this.activeTurn = null;
        if (s.activeTurnId) s.patchTurn(s.activeTurnId, { streaming: false });
        // a session that ended mid-turn says so through voice.session; a text turn's failure is its own
        if (this.session || e.message === 'connection_lost' || e.message === 'idle' || e.message === 'close' || e.message === 'abort') {
          const cur = this.store.state;
          if (cur === 'THINKING' || cur === 'EXECUTING_ACTION' || cur === 'SPEAKING' || cur === 'RESULT') this.store.transition(this.restState(), 'turn.error');
          break;
        }
        s.setError({ code: 'PROVIDER', message: this.R.error });
        s.transition('ERROR', e.message);
        this.later(3200, () => {
          if (this.store.state === 'ERROR') this.store.transition(this.restState(), 'error.auto');
        });
        break;
      }
      case 'voice.session':
        s.setVoice({ sessionLive: e.status === 'live' });
        if (e.status === 'connecting') {
          // the line dropped and is being re-established: the stage waits, and does not say "Listening"
          s.setVoice({ preparing: true });
          break;
        }
        if (e.status === 'live') {
          s.setVoice({ preparing: this.store.voice.preparing && !this.adapter?.isHearing?.() });
          break;
        }
        if (e.status === 'ended') {
          // a session that ended mid-conversation leaves the stage at rest, not listening — and says
          // so when it was not the visitor's doing, with the next thing to press
          const wasListening = this.store.state === 'LISTENING' || this.store.voice.preparing;
          s.setVoice({ preparing: false });
          s.setTranscript({ active: false });
          if (wasListening) {
            const cur = this.store.state;
            if (cur === 'LISTENING' || cur === 'THINKING' || cur === 'EXECUTING_ACTION' || cur === 'SPEAKING' || cur === 'RESULT') s.transition('VOICE_READY', 'session.ended');
            if (e.message && e.message !== 'abort' && e.message !== 'idle' && e.message !== 'close') {
              s.setError({ code: 'NETWORK', message: this.R.lineDropped });
              recordTrace('voice', { rung: 'live', fallback: `session ended: ${e.message}` });
            }
          }
        }
        break;
      case 'voice.utterance':
        if (!e.final) s.appendTurn({ id: e.id, role: 'visitor', text: e.text, source: 'voice', createdAt: Date.now() });
        else if (s.turns.some((t) => t.id === e.id)) s.patchTurn(e.id, { text: e.text });
        else s.appendTurn({ id: e.id, role: 'visitor', text: e.text, source: 'voice', createdAt: Date.now() });
        // a line the transcript could not write is not a sentence to retry or correct
        if (e.final && !e.lost) s.setLastVisitorText(e.text);
        break;
      case 'voice.thinking': {
        this.clearTimers();
        this.pendingResult = false;
        s.setError(null);
        s.setTrayOpen(false);
        const cur = this.store.state;
        if (cur === 'LISTENING' || cur === 'VOICE_READY' || cur === 'RESULT' || cur === 'CHAT') s.transition('THINKING', 'heard');
        else if (cur === 'ERROR') {
          s.transition(this.restState(), 'heard');
          s.transition('THINKING', 'heard');
        }
        break;
      }
      case 'voice.listening':
        if (e.active) {
          if (s.state !== 'LISTENING') s.transition('LISTENING', 'native');
        } else if (s.state === 'LISTENING') s.transition('VOICE_READY', 'native');
        break;
      case 'voice.transcript':
        s.setTranscript({ interim: e.final ? '' : e.text, final: e.final ? e.text : s.transcript.final, active: !e.final });
        break;
      case 'voice.speaking': {
        this.speaking = e.active;
        if (e.active) {
          const st = this.store.state;
          // a result on hold, or the stage at rest, passes through THINKING: the machine has no other door to SPEAKING
          if (st === 'LISTENING' || st === 'VOICE_READY' || st === 'RESULT') this.store.transition('THINKING', 'audio');
          const now = this.store.state;
          if (now === 'THINKING' || now === 'EXECUTING_ACTION') this.store.transition('SPEAKING', 'audio');
        } else {
          // a turn that ended while the voice was still speaking settles now
          const after = this.afterSpeech;
          this.afterSpeech = null;
          if (after) after();
          else if (this.store.state === 'SPEAKING' && !this.activeTurn && !this.store.activeTurnId) {
            this.store.transition(this.restState(), 'audio.end');
            this.maybeResumeListening();
          }
        }
        break;
      }
    }
  }

  /** The microphone never closed; the stage simply says so again — unless the visitor rested it. */
  private maybeResumeListening() {
    const s = this.store;
    if (s.mode !== 'voice' || !s.voice.sessionLive) return;
    if (!this.micPaused && this.adapter?.isHearing?.() && this.store.state === 'VOICE_READY') this.store.transition('LISTENING', 'native');
  }

  // ── voice ─────────────────────────────────────────────────────────────────
  /**
   * Which engine listens is decided by the capabilities probe, not here: the Live session
   * when the deployment offers it, the scripted example on request, nothing else.
   */
  private chooseAdapter(tier: VoiceTier = 'auto'): VoiceAdapter {
    const { adapter, kind } = chooseVoiceEngine({
      tier,
      exampleLine: () => {
        const routeKind = useSiteStore.getState().routeKind;
        const lines = EXAMPLE_SCRIPTS[routeKind];
        const line = lines[this.exampleIndex % lines.length]!;
        this.exampleIndex += 1;
        return line;
      },
    });
    this.store.setVoice({ adapter: kind });
    adapter.bind?.({
      emit: (e) => this.onEvent(e),
      executeTool: (name, args) => executeTool(name, args),
      context: () => this.voiceContext(),
      siteContext: buildSiteContext,
      subscribe: (onChange) => {
        const offSite = useSiteStore.subscribe(onChange);
        const offConcierge = useConciergeStore.subscribe(onChange);
        return () => {
          offSite();
          offConcierge();
        };
      },
    });
    return adapter;
  }

  startListening(tier: VoiceTier = 'auto') {
    const s = this.store;
    this.mark('tap');
    this.micPaused = false;
    // a mic opened over the concierge's own sentence is an interruption, and the stage says so
    const interrupted = s.state === 'SPEAKING' || this.speaking;
    if (s.mode !== 'voice') s.setMode('voice');
    if (s.state === 'CHAT' || s.state === 'RESULT' || s.state === 'ERROR' || s.state === 'SPEAKING') s.transition('VOICE_READY', 'listen');
    if (this.store.state !== 'VOICE_READY' || this.store.voice.preparing) return;
    // a deployment with no voice: the stage is not offered, and the composer is the door
    if (tier === 'auto' && this.probed && !hearingAvailable()) {
      this.setMode('chat');
      return;
    }
    // a session just refused is not asked for again by a tap alone: half a minute, or "Try again", clears the refusal
    if (this.voiceRefused && tier === 'auto') {
      if (Date.now() - this.refusedAt < ConciergeController.REFUSAL_MS) {
        this.voiceUnavailable(null);
        return;
      }
      this.voiceRefused = false;
    }
    const adapter = this.chooseAdapter(tier);
    // the session keeps its conversation; the scripted example starts from nothing
    if (this.adapter !== adapter || adapter.kind !== 'realtime') {
      this.cancelTurn();
      this.adapter?.abort();
    } else if (interrupted) {
      // "Tap to interrupt" over the session's own sentence: the reply is cut, and the
      // conversation goes on from the visitor's next words
      this.cancelTurn();
    }
    this.adapter = adapter;
    s.setError(null);
    s.setTranscript({ interim: '', final: '', active: false, interrupted });
    // the machine holds at VOICE_READY until the microphone is truly open: "Listening."
    // must never be shown while the browser is still asking the visitor for permission
    s.setVoice({ sessionLive: true, preparing: true });
    // a session has a handshake to complete after the permission; it is given longer
    this.later(adapter.kind === 'realtime' ? 16000 : 7000, () => {
      if (!this.store.voice.preparing || this.adapter !== adapter) return;
      adapter.abort();
      this.store.setVoice({ preparing: false, sessionLive: false });
      recordTrace('voice', { rung: 'live', fallback: `the session did not open in time (${adapter.kind})` });
      this.voiceUnavailable('timeout');
    });
    void adapter.start({
      onStart: () => {
        if (adapter.kind === 'realtime') this.voiceUsed = true;
        this.store.setVoice({ preparing: false, denied: false });
        this.store.setTranscript({ active: true });
        if (this.store.state !== 'LISTENING') this.store.transition('LISTENING', 'mic');
      },
      onInterim: (text) => this.store.setTranscript({ interim: text, active: true }),
      onFinal: (text) => {
        this.store.setTranscript({ interim: '', final: text, active: false });
        // the session answers its own sentences; only the scripted example is submitted as text
        if (adapter.kind !== 'realtime') this.submitText(text, 'example');
      },
      onEnd: () => {
        this.store.setTranscript({ active: false });
        this.store.setVoice({ preparing: false });
        if (this.store.state === 'LISTENING') this.store.transition('VOICE_READY', 'end');
      },
      onError: ({ code, message }) => {
        // an adapter that has been replaced or aborted has no say over the stage any more
        if (this.adapter !== adapter) return;
        const st = this.store;
        st.setTranscript({ active: false });
        st.setVoice({ preparing: false });
        if (code === 'MIC_DENIED') {
          // a refused microphone is a different message from a session that would not open
          recordTrace('voice', { rung: 'live', fallback: `microphone: ${code} ${message}` });
          st.setError({ code: 'MIC_DENIED', message: this.R.micDenied });
          st.setVoice({ sessionLive: false, denied: true });
          st.transition('ERROR', code);
          this.later(3200, () => {
            if (this.store.state === 'ERROR') this.store.transition('VOICE_READY', 'error.auto');
          });
          return;
        }
        // the session could not be opened, or the microphone could not be attached to it: said once, the provider's reason on the record
        recordTrace('voice', { rung: 'live', fallback: `${code} ${message}` });
        st.transition('VOICE_READY', 'refused');
        this.voiceUnavailable(message);
      },
    });
  }

  /**
   * The one failure message of the voice: the session cannot be established. Written once
   * on the stage — never spoken by anything in its place — and the written concierge is
   * presented, in the visitor's language.
   */
  private static readonly REFUSAL_MS = 30_000;

  private voiceUnavailable(reason: string | null) {
    const s = this.store;
    if (!this.voiceRefused) this.refusedAt = Date.now();
    this.voiceRefused = true;
    this.mark('voice.unavailable', reason ?? undefined);
    s.setVoice({ sessionLive: false, preparing: false });
    s.setTranscript({ interim: '', final: '', active: false });
    const message = this.R.voiceUnavailable;
    // said once in the exchange, where the composer is; the stage carries it too until the mode changes
    if (![...s.turns].reverse().find((t) => t.role === 'concierge')?.text.startsWith(message)) {
      s.appendTurn({ id: uid('c'), role: 'concierge', text: message, source: 'system', createdAt: Date.now() });
    }
    s.setError({ code: 'NETWORK', message });
    if (s.state === 'LISTENING' || s.state === 'THINKING') s.transition('VOICE_READY', 'unavailable');
    this.setMode('chat');
  }

  /**
   * "Rest the microphone." A tap on the ring while it listens rests the session's
   * microphone; the conversation stays live, so the next tap re-attaches rather than
   * reconnects. Only the scripted example ends here — it was never a conversation.
   */
  stopListening() {
    const scripted = this.adapter?.kind === 'scripted';
    if (this.adapter?.kind === 'realtime') this.micPaused = true;
    this.adapter?.stop();
    this.store.setVoice({ sessionLive: scripted ? false : this.store.voice.sessionLive, preparing: false });
  }

  runExample() {
    this.startListening('scripted');
  }

  /** "Try again": the last words are cleared, a refusal is forgotten, and the microphone is asked for again. */
  retryHearing() {
    const s = this.store;
    this.cancelTurn();
    s.setError(null);
    s.setTranscript({ interim: '', final: '', active: false, interrupted: false });
    this.voiceRefused = false;
    const cur = this.store.state;
    if (cur !== 'VOICE_READY' && cur !== 'LISTENING') s.transition('VOICE_READY', 'retry');
    this.startListening();
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
      transcript: state === 'LISTENING' ? { interim: '', final: '', active: true, interrupted: false } : s.transcript,
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
