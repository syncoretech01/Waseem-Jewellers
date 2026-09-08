import { create } from 'zustand';

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
  THINKING: ['EXECUTING_ACTION', 'SPEAKING', 'RESULT', 'ERROR', 'CHAT', 'VOICE_READY', 'IDLE'],
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
  image: string;
  ordinal: number;
}

export interface CollectionCard {
  slug: string;
  name: string;
  image: string;
  href: string;
  ordinal: number;
}

export type TurnResult =
  | { kind: 'pieces'; title: string; pieces: PieceCard[] }
  | { kind: 'wishlist'; pieces: PieceCard[] }
  | { kind: 'piece'; piece: PieceCard; verb: 'opened' | 'focused' | 'saved' | 'removed' }
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
  adapter: 'webspeech' | 'scripted' | null;
  recognition: boolean;
  synthesis: boolean;
  spokenReplies: boolean;
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
  transcript: { interim: string; final: string; active: boolean };
  recentResults: PieceCard[];
  recentCollections: CollectionCard[];
  lastVisitorText: string | null;
  providerId: 'mock' | 'openai-realtime';
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
  transcript: { interim: '', final: '', active: false },
  recentResults: [],
  recentCollections: [],
  lastVisitorText: null,
  providerId: 'mock',
  voice: { adapter: null, recognition: false, synthesis: false, spokenReplies: true, sessionLive: false, preparing: false, denied: false },
  error: null,
  greeted: false,
  trayOpen: false,

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
    if (result?.kind === 'pieces' || result?.kind === 'wishlist') patch.recentResults = result.pieces;
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
      transcript: { interim: '', final: '', active: false },
    }),
}));

export const useConciergeState = () => useConciergeStore((s) => s.state);
export const useConciergeOpen = () => useConciergeStore((s) => OPEN_STATES.includes(s.state));
export const useConciergeBusy = () => useConciergeStore((s) => BUSY_STATES.includes(s.state));
