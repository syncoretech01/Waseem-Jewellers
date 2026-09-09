import type { ConciergeMode, ConciergeState, TurnResult, TurnSource } from '@/state/conciergeStore';
import type { RouteKind, SectionId } from '@/state/siteStore';

export type ToolName =
  | 'searchProducts'
  | 'showCollection'
  | 'focusProduct'
  | 'openProduct'
  | 'showSimilarPieces'
  | 'saveToWishlist'
  | 'removeFromWishlist'
  | 'openWishlist'
  | 'scrollToSection'
  | 'openPrivateConsultation'
  | 'showDepartment'
  /** Deprecated aliases for `showDepartment`, kept so fixtures and model habits keep working. */
  | 'showBridal'
  | 'showGold'
  | 'showDiamond'
  | 'navigate'
  | 'getCurrentContext';

export interface JsonSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string; enum?: string[]; minimum?: number; maximum?: number; default?: unknown }>;
  required?: string[];
}

export interface ToolDef {
  name: ToolName;
  description: string;
  parameters: JsonSchema;
  /** Stage 1 tools are browser UI actions; server tools are reserved for /api/concierge/tool. */
  runtime: 'browser' | 'server';
}

export interface ProductBrief {
  slug: string;
  name: string;
  house?: string;
  category: string;
  material: string;
  priceLabel: string;
  image: string;
}

export interface SiteContext {
  route: string;
  routeKind: RouteKind;
  section: SectionId | null;
  currentProduct: ProductBrief | null;
  focusedProduct: ProductBrief | null;
  visibleProducts: ProductBrief[];
  selectedCollection: string | null;
  selectedWorld: string | null;
  wishlist: ProductBrief[];
  recentResults: ProductBrief[];
  recentCollections: string[];
  lastOpenedProduct: string | null;
  conciergeState: ConciergeState;
  mode: ConciergeMode;
  viewport: 'desktop' | 'tablet' | 'mobile';
  localHour: number;
}

export interface ToolOutcome {
  /** JSON payload for the model (or the mock's reply builder). */
  result: unknown;
  /** Human label for the status line once done; '' = no status. */
  label: string;
  /** Human label while running ("Exploring bridal necklaces…"). */
  runningLabel?: string;
  /** Navigation performed (informational for the model). */
  navigateTo?: string;
  /** What the UI should present. */
  ui?: TurnResult;
  /** The panel steps aside so the page action is visible. */
  compact?: boolean;
}

export type ProviderEvent =
  | { type: 'turn.start'; turnId: string }
  | { type: 'text.ready'; turnId: string; text: string }
  | { type: 'text.delta'; turnId: string; delta: string }
  | { type: 'text.done'; turnId: string; text: string }
  | { type: 'tool.call'; turnId: string; callId: string; name: ToolName; args: Record<string, unknown> }
  | { type: 'tool.result'; turnId: string; callId: string; outcome: ToolOutcome }
  | { type: 'tool.error'; turnId: string; callId: string; message: string }
  | { type: 'turn.done'; turnId: string }
  | { type: 'turn.error'; turnId: string; message: string; recoverable: boolean }
  | { type: 'voice.session'; status: 'connecting' | 'live' | 'ended'; message?: string }
  | { type: 'voice.listening'; active: boolean }
  | { type: 'voice.transcript'; text: string; final: boolean }
  | { type: 'voice.speaking'; active: boolean };

export interface ProviderRuntime {
  getCurrentContext(): SiteContext;
  executeTool(name: ToolName, args: Record<string, unknown>, meta: { turnId: string; callId: string }): Promise<ToolOutcome>;
  emit(event: ProviderEvent): void;
  readonly toolDefs: readonly ToolDef[];
}

export interface ProviderCapabilities {
  streaming: boolean;
  voice: 'none' | 'native';
  contextPush: boolean;
}

export interface ConciergeProvider {
  readonly id: 'mock' | 'openai-realtime';
  readonly capabilities: ProviderCapabilities;
  attach(runtime: ProviderRuntime): void;
  detach(): Promise<void>;
  /** Resolves at turn.done / turn.error. */
  submitText(text: string, opts: { turnId: string; source: TurnSource }): Promise<void>;
  cancelTurn(turnId?: string): void;
  pushContext?(ctx: SiteContext): void;
  startVoice?(): Promise<void>;
  stopVoice?(): Promise<void>;
  interrupt?(): void;
}
