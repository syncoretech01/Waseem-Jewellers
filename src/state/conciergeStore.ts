import { create } from 'zustand';
import type { ImageRef } from '@/data/types';
import type { ProviderId } from '@/concierge/types';
import { EMPTY_MEMORY, DISCUSSED_MAX, type ConversationMemory } from '@/concierge/memory';

export type ConciergeState =
  | 'IDLE'
  | 'HOVER'
  | 'OPENING'
  | 'CHAT'
  | 'VOICE_READY'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EXECUTING_ACTION'
  | 'RESULT'
  | 'ERROR';

export type ConciergeMode = 'chat' | 'voice';
export type PanelMode = 'closed' | 'full' | 'compact';
export type TurnSource = 'text' | 'voice' | 'example' | 'card' | 'system';

export const TRANSITIONS: Record<ConciergeState, readonly ConciergeState[]> = {
  IDLE: ['HOVER', 'OPENING'],
  HOVER: ['IDLE', 'OPENING'],
  OPENING: ['CHAT', 'VOICE_READY', 'IDLE'],
  CHAT: ['THINKING', 'VOICE_READY', 'ERROR', 'IDLE'],
  VOICE_READY: ['LISTENING', 'CHAT', 'THINKING', 'ERROR', 'IDLE'],
  LISTENING: ['THINKING', 'VOICE_READY', 'ERROR', 'IDLE'],
  // LISTENING: a live session's visitor can speak over the concierge before it has said a word
  THINKING: ['EXECUTING_ACTION', 'SPEAKING', 'RESULT', 'LISTENING', 'ERROR', 'CHAT', 'VOICE_READY', 'IDLE'],
  EXECUTING_ACTION: [
    'EXECUTING_ACTION',
    'THINKING',
    'SPEAKING',
    'RESULT',
    'CHAT',
    'VOICE_READY',
    'LISTENING',
    'ERROR',
    'IDLE',
  ],
  SPEAKING: ['EXECUTING_ACTION', 'RESULT', 'LISTENING', 'CHAT', 'VOICE_READY', 'ERROR', 'IDLE'],
  RESULT: ['CHAT', 'VOICE_READY', 'LISTENING', 'THINKING', 'ERROR', 'IDLE'],
  ERROR: ['CHAT', 'VOICE_READY', 'IDLE'],
};

export const OPEN_STATES: readonly ConciergeState[] = [
  'OPENING',
  'CHAT',
  'VOICE_READY',
  'LISTENING',
  'THINKING',
  'SPEAKING',
  'EXECUTING_ACTION',
  'RESULT',
  'ERROR',
];

export const BUSY_STATES: readonly ConciergeState[] = ['THINKING', 'EXECUTING_ACTION', 'SPEAKING'];

export interface ToolActivity {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'done' | 'error';
  startedAt: number;
  finishedAt?: number;
}

export interface PieceCard {
  slug: string;
  name: string;
  collection: string;
  priceLabel: string;
  /**
   * A reference, not a source url. The tray, the recap and the panel render it through the
   * optimiser: 589 of 599 pieces are photographed on the shop's CDN at 2286 px and up, and a
   * raw `src` put a multi-megabyte original inside a 72-pixel thumbnail.
   */
  image: ImageRef;
  ordinal: number;
}

export interface CollectionCard {
  slug: string;
  name: string;
  image: ImageRef;
  href: string;
  ordinal: number;
}

/** One published axis across two or three pieces; `null` is "not published", never a guess. */
export interface CompareRow {
  axis: string;
  values: (string | null)[];
}

export type TurnResult =
  | { kind: 'pieces'; title: string; pieces: PieceCard[] }
  | { kind: 'compare'; title: string; pieces: PieceCard[]; rows: CompareRow[] }
  | { kind: 'piece'; piece: PieceCard; verb: 'opened' | 'focused' }
  | { kind: 'collection'; collection: CollectionCard }
  | { kind: 'collections'; collections: CollectionCard[] }
  | { kind: 'navigation'; label: string; href: string }
  | { kind: 'consultation'; topic?: string }
  | { kind: 'house' };

export interface ConciergeTurn {
  id: string;
  role: 'visitor' | 'concierge';
  text: string;
  streaming?: boolean;
  source: TurnSource;
  tools?: ToolActivity[];
  result?: TurnResult;
  error?: string;
  createdAt: number;
}

export interface ConciergeError {
  code: 'MIC_DENIED' | 'NO_SPEECH' | 'NETWORK' | 'PROVIDER' | 'TOOL' | 'UNSUPPORTED';
  message: string;
}

export interface VoiceFlags {
  adapter: 'scripted' | 'realtime' | null;
  recognition: boolean;
  synthesis: boolean;
  sessionLive: boolean;
  /** The microphone has been asked for and has not opened yet — the browser may be asking the visitor. */
  preparing: boolean;
  /** The microphone was refused, or is blocked for this site; latched for the session. */
  denied: boolean;
}

interface ConciergeStoreState {
  state: ConciergeState;
  reason: string;
  mode: ConciergeMode;
  panel: PanelMode;
  turns: ConciergeTurn[];
  activeTurnId: string | null;
  activeTool: ToolActivity | null;
  /** `interrupted`: the visitor spoke over the concierge — said so, once, on the stage. */
  transcript: { interim: string; final: string; active: boolean; interrupted: boolean };
  recentResults: PieceCard[];
  recentCollections: CollectionCard[];
  lastVisitorText: string | null;
  providerId: ProviderId;
  voice: VoiceFlags;
  error: ConciergeError | null;
  greeted: boolean;
  trayOpen: boolean;

  transition: (next: ConciergeState, reason?: string) => boolean;
  setMode: (mode: ConciergeMode) => void;
  setPanel: (panel: PanelMode) => void;
  appendTurn: (turn: ConciergeTurn) => void;
  patchTurn: (id: string, patch: Partial<ConciergeTurn>) => void;
  appendDelta: (id: string, delta: string) => void;
  upsertTool: (turnId: string, activity: ToolActivity) => void;
  setResult: (turnId: string, result: TurnResult | undefined) => void;
  setActiveTurn: (id: string | null) => void;
  setTranscript: (t: Partial<ConciergeStoreState['transcript']>) => void;
  setError: (error: ConciergeError | null) => void;
  setVoice: (v: Partial<VoiceFlags>) => void;
  setGreeted: (v: boolean) => void;
  setLastVisitorText: (t: string | null) => void;
  setTrayOpen: (open: boolean) => void;
  setRecentCollections: (cards: CollectionCard[]) => void;
  /** Session-scoped, bounded, and never persisted — see src/concierge/memory.ts. */
  memory: ConversationMemory;
  /** How many visitor turns have passed; the unit the topic and the anchor decay in. */
  turnCount: number;
  countTurn: () => void;
  rememberTopic: (slots: ConversationMemory['standingSlots']) => void;
  rememberAnchor: (slug: string | null) => void;
  rememberLanguage: (language: ConversationMemory['language']) => void;
  dropTerm: (key: 'department' | 'category' | 'material' | 'purity' | 'occasion' | 'weight' | 'piece') => void;
  noteDiscussed: (slugs: string[]) => void;
  forgetTopic: () => void;
  forget: () => void;
}

const MAX_TURNS = 40;

export const useConciergeStore = create<ConciergeStoreState>()((set, get) => ({
  state: 'IDLE',
  reason: 'init',
  mode: 'chat',
  panel: 'closed',
  turns: [],
  activeTurnId: null,
  activeTool: null,
  transcript: { interim: '', final: '', active: false, interrupted: false },
  recentResults: [],
  recentCollections: [],
  lastVisitorText: null,
  providerId: 'keyless',
  voice: { adapter: null, recognition: false, synthesis: false, sessionLive: false, preparing: false, denied: false },
  error: null,
  greeted: false,
  trayOpen: false,
  memory: EMPTY_MEMORY,
  turnCount: 0,

  countTurn: () => set({ turnCount: get().turnCount + 1 }),
  rememberTopic: (standingSlots) => set({ memory: { ...get().memory, standingSlots, topicTurn: get().turnCount, topicAt: Date.now() } }),
  rememberAnchor: (anchor) => set({ memory: { ...get().memory, anchor, anchorTurn: get().turnCount } }),
  rememberLanguage: (language) => set({ memory: { ...get().memory, language } }),
  noteDiscussed: (slugs) => {
    const seen = [...new Set([...slugs, ...get().memory.discussed])].slice(0, DISCUSSED_MAX);
    set({ memory: { ...get().memory, discussed: seen } });
  },
  // begun again: the subject goes, the visitor's language stays — they did not change that
  forgetTopic: () => set({ memory: { ...EMPTY_MEMORY, language: get().memory.language } }),
  /**
   * One condition, not the whole topic.
   *
   * "Begin again" was the only way to drop anything, which made a visitor who wanted the
   * same search without the weight limit start the conversation over. Dropping the anchor
   * deliberately leaves the standing topic alone, for the same reason a route change does:
   * ceasing to talk about one piece is not ceasing to look for its kind.
   */
  dropTerm: (key) =>
    set((s) => {
      if (key === 'piece') return { memory: { ...s.memory, anchor: null, anchorTurn: -1 } };
      const slots = { ...s.memory.standingSlots };
      if (key === 'purity') delete slots.karat;
      else if (key === 'weight') {
        delete slots.maxWeightGrams;
        delete slots.minWeightGrams;
      } else delete slots[key];
      return { memory: { ...s.memory, standingSlots: slots } };
    }),

  transition: (next, reason = '') => {
    const current = get().state;
    if (current === next) return true;
    if (!TRANSITIONS[current].includes(next)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[concierge] illegal transition ${current} → ${next} (${reason})`);
      }
      return false;
    }
    set({ state: next, reason });
    return true;
  },
  setMode: (mode) => set({ mode }),
  setPanel: (panel) => set({ panel }),
  appendTurn: (turn) => {
    /**
     * A turn id appears once. `patchTurn` and `appendDelta` both map over every turn
     * carrying the id, so a second turn with the same one receives every delta the first
     * does — the fallback re-runs a failed sentence under the original id, and the reply
     * was written into the room twice.
     */
    if (get().turns.some((t) => t.id === turn.id)) return;
    const turns = [...get().turns, turn];
    set({ turns: turns.length > MAX_TURNS ? turns.slice(turns.length - MAX_TURNS) : turns });
  },
  patchTurn: (id, patch) => set({ turns: get().turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
  appendDelta: (id, delta) =>
    set({ turns: get().turns.map((t) => (t.id === id ? { ...t, text: t.text + delta } : t)) }),
  upsertTool: (turnId, activity) => {
    const active = get().activeTool;
    set({
      activeTool:
        activity.status === 'running' ? activity : active?.id === activity.id ? activity : active,
      turns: get().turns.map((t) => {
        if (t.id !== turnId) return t;
        const tools = t.tools ? [...t.tools] : [];
        const idx = tools.findIndex((a) => a.id === activity.id);
        if (idx >= 0) tools[idx] = activity;
        else tools.push(activity);
        return { ...t, tools };
      }),
    });
  },
  setResult: (turnId, result) => {
    const patch: Partial<ConciergeStoreState> = {
      turns: get().turns.map((t) => (t.id === turnId ? { ...t, result } : t)),
    };
    if (result?.kind === 'pieces') patch.recentResults = result.pieces;
    if (result?.kind === 'collections') patch.recentCollections = result.collections;
    set(patch);
  },
  setActiveTurn: (id) => set({ activeTurnId: id }),
  setTranscript: (t) => set({ transcript: { ...get().transcript, ...t } }),
  setError: (error) => set({ error }),
  setVoice: (v) => set({ voice: { ...get().voice, ...v } }),
  setGreeted: (v) => set({ greeted: v }),
  setLastVisitorText: (t) => set({ lastVisitorText: t }),
  setTrayOpen: (open) => set({ trayOpen: open }),
  setRecentCollections: (cards) => set({ recentCollections: cards }),
  forget: () =>
    set({
      turns: [],
      activeTurnId: null,
      activeTool: null,
      recentResults: [],
      recentCollections: [],
      lastVisitorText: null,
      error: null,
      greeted: false,
      trayOpen: false,
      transcript: { interim: '', final: '', active: false, interrupted: false },
    }),
}));

export const useConciergeState = () => useConciergeStore((s) => s.state);
export const useConciergeOpen = () => useConciergeStore((s) => OPEN_STATES.includes(s.state));
export const useConciergeBusy = () => useConciergeStore((s) => BUSY_STATES.includes(s.state));
