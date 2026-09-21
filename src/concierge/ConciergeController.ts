'use client';

import { useConciergeStore, OPEN_STATES, type ConciergeMode, type ConciergeState, type ConciergeTurn, type TurnSource } from '@/state/conciergeStore';
import { useSiteStore } from '@/state/siteStore';
import { useQualityStore } from '@/state/qualityStore';
import { buildSiteContext } from './context';
import { getRow, loadIndex, priceLabelOf, specLineOf } from '@/data/clientIndex';
import { canonicalCategory } from '@/data/vocabulary';
import { CATEGORY_PLURAL } from '@/data/labels';
import type { Category } from '@/data/types';
import { recognitionLang } from './voice/languages';
import { chooseVoiceEngine, hearingAvailable, type VoiceTier } from './voice/engine';
import { realtimeMark, realtimeTrace, registerRealtimeEngine, type TraceEntry } from './voice/realtime';
import { topicLine } from './memory';
import { probeCapabilities } from './capabilities';
import { createProvider } from './createProvider';
import { executeTool } from './tools/executeTool';
import { TOOL_DEFS } from './tools/toolDefs';
import { summariseDraft } from './tools/appointment';
import { asReplyLanguage, replies, subjectIn } from './replies';
import { qaTrace, recordTrace, type QaEntry } from './qa';
import { recognitionSupported, type VoiceAdapter } from './voice/adapters';
import { cancelSpeech, planSpeech, speak, speechAvailable, speechEngine } from './voice/speech';
import { primeAudio, registerServerSpeech } from './voice/serverSpeech';
import { startMeter, stopMeter, voiceMeter } from './voice/meter';
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
  /** Words for a composer that has not mounted yet — "Correct it" switches to chat and the field arrives a render later. */
  private pendingDraft: string | null = null;
  /** The visitor rested the microphone of a live session; it does not reopen by itself. */
  private micPaused = false;
  /** The visitor has spoken to the live session, so a typed sentence continues that conversation. */
  private voiceUsed = false;
  /** The rung the ladder settled on for this session, so a reply's resume does not climb back and wait again. */
  private rung: VoiceTier = 'auto';
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
    registerServerSpeech();
    registerRealtimeEngine();
    this.refreshVoiceSupport();
    if (typeof window !== 'undefined') window.__wjVoiceTrace = realtimeTrace;
    useConciergeStore.subscribe((s, prev) => {
      if (s.state !== prev.state) this.mark(`state:${s.state}`, s.reason);
    });
  }

  /** One entry on the voice timeline, from this side of the seam. */
  private mark(type: string, detail?: string) {
    const entry = { t: Date.now(), type, detail };
    this.marks.push(entry);
    if (this.marks.length > 400) this.marks.splice(0, this.marks.length - 400);
    realtimeMark(type, detail);
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
   * What a live voice session is told about the page: the piece in view with what Waseem
   * publishes about it, the pieces just shown with their ordinals, the standing request and
   * the size of the selection. Small, and every fact in it published — the same rule as the
   * text path's grounding, rendered for a model that hears "the second one".
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
     * The catalogue index arrives with the concierge, not with the page.
     *
     * Every lookup below it — search, similar, the name of a piece, and above all whether a
     * slug is real — reads the index, so it is fetched the moment the panel opens rather
     * than on a visitor's first sentence. A visitor who never asks never pays for it.
     */
    void loadIndex();
    // a voice stage with nothing to hear with is an apology; the composer is the honest opening
    const wanted = opts.mode ?? s.mode;
    const mode = wanted === 'voice' && !hearingAvailable() ? 'chat' : wanted;
    s.setMode(mode);
    // what this deployment is allowed to be: model or keyless, and which engine hears — and once
    // that is known, the stage that is about to show has its call opened, so the tap only
    // attaches the microphone
    void probeCapabilities().then(() => {
      this.refreshVoiceSupport();
      if (this.store.mode === 'voice' && OPEN_STATES.includes(this.store.state)) this.warmVoice();
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
    // a live session rests its microphone and keeps the call for a while; every other adapter ends
    if (this.adapter?.kind === 'realtime' && this.adapter.isLive?.()) this.adapter.stop();
    else this.adapter?.abort();
    cancelSpeech();
    this.disarmBargeIn();
    this.afterSpeech = null;
    this.clearTimers();
    s.setTrayOpen(false);
    s.setPanel('closed');
    s.setTranscript({ interim: '', final: '', active: false });
    s.setVoice({ sessionLive: false, preparing: false, fallback: null });
    this.micPaused = false;
    this.voiceUsed = false;
    this.rung = 'auto';
    s.transition('IDLE', 'close');
    // back to the orb, or the ENQUIRE button, or wherever it was — not to <body>
    const opener = this.opener;
    this.opener = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  setMode(mode: ConciergeMode) {
    const s = this.store;
    if (s.mode === mode) return;
    // "Write" mid-sentence discards the half sentence rather than sending it — and a live
    // session rests its microphone rather than ending: the typed sentence joins the same conversation
    const session = Boolean(this.adapter?.kind === 'realtime' && this.adapter.isLive?.());
    if (s.state === 'LISTENING' || s.voice.preparing) {
      if (session) {
        this.adapter?.stop();
        this.micPaused = true;
      } else this.adapter?.abort();
      s.setVoice({ preparing: false, transcribing: false, sessionLive: session ? s.voice.sessionLive : false });
      s.setTranscript({ interim: '', final: '', active: false });
      if (this.store.state === 'LISTENING') s.transition('VOICE_READY', 'mode');
    } else if (session && mode === 'chat') {
      // the keyboard has the floor in every state, not only mid-sentence: a microphone the
      // visitor cannot see must not keep hearing the room from behind the composer
      this.adapter?.stop();
      this.micPaused = true;
    }
    s.setMode(mode);
    const cur = this.store.state;
    if (cur === 'CHAT' || cur === 'VOICE_READY' || cur === 'RESULT' || cur === 'ERROR') s.transition(mode === 'voice' ? 'VOICE_READY' : 'CHAT', 'mode');
    if (mode === 'voice') void probeCapabilities().then(() => this.warmVoice());
  }

  /**
   * The call before the tap. Chosen by the same ladder a tap would use; only the native
   * engine has anything to warm, and it asks no permission — the microphone is attached in
   * the tap itself. A failure here is silent: the tap reports it, and steps down a rung.
   */
  warmVoice() {
    if (this.store.voice.denied) return;
    if (this.adapter?.kind === 'realtime' && this.adapter.isLive?.()) return;
    const adapter = this.chooseAdapter('auto');
    if (adapter.kind !== 'realtime' || !adapter.warm) return;
    this.adapter = adapter;
    this.mark('warm');
    void adapter.warm().then((live) => this.mark(live ? 'warm.live' : 'warm.failed'));
  }

  /**
   * "Show nearby pieces": the same request with its conditions set aside — the kind alone,
   * or the material alone — dispatched directly, exactly as a tap on a card is. The answer
   * to an empty tray is another tray, never a shrug.
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
    cancelSpeech();
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
    this.adapter?.abort();
    this.saidNoVoice = false;
    this.micPaused = false;
    this.voiceUsed = false;
    this.rung = 'auto';
    this.store.setVoice({ sessionLive: false, fallback: null, denied: false });
    this.store.forget();
    // begun again: the standing topic goes with the conversation; the visitor's language stays
    this.store.forgetTopic();
    // a fresh conversation, and the call for it opened now rather than on the next tap
    if (this.store.mode === 'voice') void probeCapabilities().then(() => this.warmVoice());
  }

  // ── turns ─────────────────────────────────────────────────────────────────
  submitText(text: string, source: TurnSource = 'text') {
    const trimmed = text.trim();
    if (!trimmed) return;
    const s = this.store;
    /**
     * A live session takes a typed sentence only when it is the visitor's conversation: the
     * stage is up, or they rested its microphone to write ("Write instead"). A call that was
     * merely opened early — a pointer over the microphone, say — is not yet a conversation,
     * and a typed sentence goes to the text engine, which does not speak unasked.
     */
    const session = this.adapter?.kind === 'realtime' && this.adapter.isLive?.() && (s.mode === 'voice' || this.voiceUsed) ? this.adapter : null;
    if ((s.state === 'LISTENING' || s.voice.preparing) && !session) {
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
    /**
     * A typed sentence into a live voice session goes to the same conversation the visitor
     * has been speaking to — "second wala kholo" written after it was misheard still means
     * the second piece the session just brought. The session emits the turn's events itself.
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
    // a tap has the floor: a reply still being said, spoken or streamed, stops here
    this.cancelTurn();
    cancelSpeech();
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
    cancelSpeech();
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
   * path a model's call takes rather than a shortcut beside it.
   *
   * It is not gated to development, deliberately. Everything it can do the visitor's own
   * hands can do — navigate, open a piece, fill the form they are looking at — and every
   * call still passes `validateToolCall`, so a slug that does not exist or a path off the
   * site is refused here as anywhere. It is the same surface `tapCard` already exposes;
   * the security boundary is what a *model* may do, and that boundary is unchanged.
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
    this.spokenText = '';
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
      case 'text.ready': {
        // a session speaks for itself; nothing here reads its words aloud a second time
        if (s.mode === 'voice' && s.voice.spokenReplies && speechAvailable() && !(this.adapter?.kind === 'realtime' && this.adapter.isLive?.())) {
          /**
           * "No voice for this language" is a modifier on SPEAKING, not a tenth state — the
           * nine states are unchanged. The concierge still answers; it simply says once that
           * the answer will be written rather than spoken, and never reads Urdu aloud in an
           * English voice to avoid the admission.
           */
          if (planSpeech(e.text).missingAVoice && !this.saidNoVoice) {
            this.saidNoVoice = true;
            s.appendTurn({ id: uid('c'), role: 'concierge', text: this.R.noVoiceForLanguage, source: 'system', createdAt: Date.now() });
          }
          this.spokenText = e.text;
          this.say(e.text);
        }
        break;
      }
      case 'text.delta': {
        // a reply that arrives while the stage still says "Listening" passes through THINKING first
        if (s.state === 'LISTENING' || s.state === 'VOICE_READY' || s.state === 'CHAT') s.transition('THINKING', 'delta');
        if (this.store.state !== 'SPEAKING') this.store.transition('SPEAKING', 'delta');
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
        if (s.mode === 'voice' && s.voice.spokenReplies && speechAvailable() && e.text && !(this.adapter?.kind === 'realtime' && this.adapter.isLive?.())) {
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
        const trace = this.traces.get(e.turnId);
        /**
         * The second sentence in a row the keyless engine could not read: the stage offers
         * writing instead, as the next thing to press, and the microphone does not reopen
         * on its own to ask a third time. "Try again" and "Write instead" are both beneath
         * the ring; the visitor chooses.
         */
        const offerWrite = trace?.plan === 'unknown.again' && s.mode === 'voice';
        const finish = () => {
          const rest = this.restState();
          const cur = this.store.state;
          if (cur === 'RESULT' || cur === 'SPEAKING' || cur === 'EXECUTING_ACTION' || cur === 'THINKING') this.store.transition(rest, 'turn.done');
          if (offerWrite) {
            this.store.setVoice({ sessionLive: this.store.voice.adapter === 'realtime' ? this.store.voice.sessionLive : false });
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
        if (trace?.plan === 'close') this.later(900, () => this.close());
        break;
      }
      case 'turn.error': {
        if (e.turnId === 'attach') return;
        s.setActiveTurn(null);
        this.activeTurn = null;
        if (s.activeTurnId) s.patchTurn(s.activeTurnId, { streaming: false });
        s.setError({ code: 'PROVIDER', message: this.R.error });
        s.transition('ERROR', e.message);
        this.later(3200, () => {
          if (this.store.state === 'ERROR') this.store.transition(this.restState(), 'error.auto');
        });
        break;
      }
      case 'voice.session':
        s.setVoice({ sessionLive: e.status === 'live' });
        if (e.status === 'ended') {
          // a session that ended mid-sentence leaves the stage at rest, not listening — and says
          // so when it was not the visitor's doing, with the next thing to press
          const wasListening = this.store.state === 'LISTENING';
          s.setVoice({ preparing: false, transcribing: false });
          s.setTranscript({ active: false });
          if (wasListening) {
            s.transition('VOICE_READY', 'session.ended');
            if (e.message && e.message !== 'abort' && e.message !== 'idle') s.setError({ code: 'NETWORK', message: this.R.sessionEnded });
          }
        }
        break;
      case 'voice.utterance':
        if (!e.final) s.appendTurn({ id: e.id, role: 'visitor', text: e.text, source: 'voice', createdAt: Date.now() });
        else s.patchTurn(e.id, { text: e.text });
        // a line the transcript could not write is not a sentence to retry or correct
        if (e.final && !e.lost) s.setLastVisitorText(e.text);
        break;
      case 'voice.thinking': {
        this.clearTimers();
        this.pendingResult = false;
        this.spokenText = '';
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
        }
        else if (s.state === 'LISTENING') s.transition('VOICE_READY', 'native');
        break;
      case 'voice.transcript':
        s.setTranscript({ interim: e.final ? '' : e.text, final: e.final ? e.text : s.transcript.final, active: !e.final });
        break;
      case 'voice.speaking': {
        this.speaking = e.active;
        if (e.active) {
          const st = this.store.state;
          if (st === 'THINKING' || st === 'EXECUTING_ACTION') this.store.transition('SPEAKING', 'audio');
        } else {
          // a turn that ended while the voice was still speaking settles now
          const after = this.afterSpeech;
          this.afterSpeech = null;
          after?.();
        }
        break;
      }
    }
  }

  private maybeResumeListening() {
    const s = this.store;
    if (s.mode !== 'voice' || !s.voice.sessionLive) return;
    if (s.voice.adapter === 'realtime') {
      // the microphone never closed; the stage simply says so again — unless the visitor rested it
      if (!this.micPaused && this.adapter?.isHearing?.() && this.store.state === 'VOICE_READY') this.store.transition('LISTENING', 'native');
      return;
    }
    // the rung this session settled on, not the top of the ladder again
    const resume = () => this.startListening(this.rung);
    // only after the visitor actually spoke through the microphone — never after a scripted example
    if (s.voice.adapter !== 'webspeech' && s.voice.adapter !== 'server') return;
    const check = () => {
      if (this.store.state !== 'VOICE_READY') return;
      if (this.speaking || voiceMeter.speech > 0.05) {
        this.later(300, check);
        return;
      }
      resume();
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
  private chooseAdapter(tier: VoiceTier = 'auto'): VoiceAdapter {
    const { adapter, kind } = chooseVoiceEngine({
      tier,
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
    adapter.bind?.({
      emit: (e) => this.onEvent(e),
      executeTool: (name, args) => executeTool(name, args),
      context: () => this.voiceContext(),
      onLanguage: (language) => this.store.rememberLanguage(language),
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
    // a tap on the ring returns to the rung the session settled on; only a fresh session climbs again
    if (tier === 'auto' && this.rung !== 'auto') tier = this.rung;
    // a mic opened over the concierge's own sentence is an interruption, and the stage says so
    const interrupted = s.state === 'SPEAKING' || this.speaking;
    if (s.mode !== 'voice') s.setMode('voice');
    if (s.state === 'CHAT' || s.state === 'RESULT' || s.state === 'ERROR' || s.state === 'SPEAKING') s.transition('VOICE_READY', 'listen');
    if (this.store.state !== 'VOICE_READY' || this.store.voice.preparing) return;
    // a tap is the moment a phone will let a later reply play aloud
    primeAudio();
    cancelSpeech();
    const adapter = this.chooseAdapter(tier);
    // a session adapter keeps its conversation; every other adapter starts from nothing
    if (this.adapter !== adapter || adapter.kind !== 'realtime') {
      this.cancelTurn();
      this.adapter?.abort();
    } else if (interrupted) {
      // "Tap to interrupt" over the session's own sentence: the reply is cut on the server and
      // in the room, and the conversation goes on from the visitor's next words
      this.cancelTurn();
    }
    this.adapter = adapter;
    if (tier === 'auto') s.setVoice({ fallback: null });
    s.setError(null);
    s.setTranscript({ interim: '', final: '', active: false, interrupted });
    // the machine holds at VOICE_READY until the microphone is truly open: "Listening."
    // must never be shown while the browser is still asking the visitor for permission
    s.setVoice({ sessionLive: true, preparing: true, transcribing: false });
    // a realtime session has a handshake to complete after the permission; it is given longer
    this.later(adapter.kind === 'realtime' ? 14000 : 7000, () => {
      if (!this.store.voice.preparing || this.adapter !== adapter) return;
      adapter.abort();
      this.store.setVoice({ preparing: false, sessionLive: false });
      this.store.setError({ code: 'MIC_DENIED', message: this.R.micFailed });
      recordTrace('voice', { rung: 'browser-voice', fallback: `microphone did not open (${adapter.kind})` });
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
        if (adapter.kind === 'realtime') this.voiceUsed = true;
        this.store.setVoice({ preparing: false, denied: false });
        this.store.setTranscript({ active: true });
        if (this.store.state !== 'LISTENING') this.store.transition('LISTENING', 'mic');
      },
      onInterim: (text) => this.store.setTranscript({ interim: text, active: true }),
      onTranscribing: () => this.store.setVoice({ transcribing: true }),
      onFinal: (text, meta) => {
        this.store.setVoice({ transcribing: false });
        // the server tier can tell which script it heard; the browser tier listens in it next time
        if (meta?.language === 'ur' || meta?.language === 'pa-Guru') this.store.rememberLanguage(meta.language);
        this.store.setTranscript({ interim: '', final: text, active: false });
        // a session adapter has already answered the sentence itself; only an utterance is submitted
        if (adapter.kind !== 'realtime') this.submitText(text, adapter.kind === 'scripted' ? 'example' : 'voice');
      },
      onEnd: () => {
        this.store.setTranscript({ active: false });
        this.store.setVoice({ preparing: false, transcribing: false });
        if (this.store.state === 'LISTENING') this.store.transition('VOICE_READY', 'end');
      },
      onError: ({ code, message }) => {
        // an adapter that has been replaced or aborted has no say over the stage any more
        if (this.adapter !== adapter) return;
        const st = this.store;
        const sentenceLost = st.voice.transcribing;
        st.setTranscript({ active: false });
        st.setVoice({ preparing: false, transcribing: false });
        if (code === 'NO_SPEECH') {
          st.setError({ code: 'NO_SPEECH', message: this.R.noSpeech });
          st.transition('VOICE_READY', 'no-speech');
          return;
        }
        if (code === 'NETWORK' || code === 'UNSUPPORTED') {
          st.transition('VOICE_READY', 'network');
          /**
           * One rung down, never silently. A realtime session that could not open falls to
           * the transcription tier; a transcription that failed falls to the browser's own
           * hearing. The stage says which — in the visitor's words, not the engine's.
           */
          if (adapter.kind === 'realtime' && tier === 'auto') {
            this.rung = 'server';
            st.setVoice({ fallback: 'server' });
            // why the realtime session was not the one to answer, verbatim, for the QA view
            recordTrace('voice', { rung: 'browser-voice', fallback: `realtime refused: ${code} ${message}`, note: 'stepped down to the transcription tier' });
            this.later(150, () => this.startListening('server'));
            return;
          }
          if (adapter.kind === 'server' && tier !== 'browser' && recognitionSupported()) {
            this.rung = 'browser';
            st.setVoice({ fallback: 'browser' });
            recordTrace('voice', { rung: 'browser-voice', fallback: `transcription refused: ${code} ${message}`, note: "stepped down to the browser's own hearing" });
            this.later(150, () => {
              this.startListening('browser');
              // a sentence already spoken is lost with the rung; the visitor is asked again, on the
              // open microphone, rather than left to wonder — set after the rung opens, which clears errors
              if (sentenceLost) this.store.setError({ code: 'NO_SPEECH', message: this.R.couldNotHear });
            });
            return;
          }
          // never a silent example in the visitor's name: say so, and leave the offer standing
          recordTrace('voice', { rung: 'browser-voice', fallback: `hearing unavailable: ${code} ${message}` });
          st.setError({ code: 'NETWORK', message: this.R.hearingUnavailable });
          return;
        }
        recordTrace('voice', { rung: 'browser-voice', fallback: `microphone: ${code} ${message}` });
        st.setError({ code: 'MIC_DENIED', message: this.R.micDenied });
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
    if (this.adapter?.kind === 'realtime') this.micPaused = true;
    this.adapter?.stop();
    this.store.setVoice({ sessionLive: scripted ? false : this.store.voice.sessionLive, preparing: false });
  }

  runExample() {
    this.startListening('scripted');
  }

  /** "Try again": the last words are cleared and the microphone is open again. */
  retryHearing() {
    const s = this.store;
    this.cancelTurn();
    cancelSpeech();
    s.setError(null);
    s.setTranscript({ interim: '', final: '', active: false, interrupted: false });
    if (this.adapter?.kind === 'realtime' && this.adapter.isLive?.()) {
      const cur = this.store.state;
      if (cur !== 'VOICE_READY' && cur !== 'LISTENING') s.transition('VOICE_READY', 'retry');
      this.startListening();
      return;
    }
    if (this.store.state !== 'VOICE_READY') s.transition('VOICE_READY', 'retry');
    this.startListening();
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
