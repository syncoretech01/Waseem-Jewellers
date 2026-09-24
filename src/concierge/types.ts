import type { ImageRef } from '@/data/types';
import type { ConciergeMode, ConciergeState, TurnResult, TurnSource } from '@/state/conciergeStore';
import type { RouteKind, SectionId } from '@/state/siteStore';

export type ToolName =
  | 'searchProducts'
  | 'showCollection'
  | 'focusProduct'
  | 'openProduct'
  | 'showSimilarPieces'
  | 'showMatchingPieces'
  | 'refineResults'
  | 'filterProducts'
  | 'clearFilters'
  | 'showPriceGuidance'
  | 'scrollToSection'
  | 'scrollPage'
  | 'getProductFacts'
  | 'openPrivateConsultation'
  | 'compareProducts'
  | 'comparePieces'
  | 'explainSpecification'
  | 'deepSearch'
  | 'showDepartment'
  /** Deprecated aliases for `showDepartment`, kept so fixtures and model habits keep working. */
  | 'showBridal'
  | 'showGold'
  | 'showDiamond'
  | 'navigate'
  | 'getCurrentContext'
  /** Operating the site: the chrome, the gallery, the gate, the window. */
  | 'openMenu'
  | 'closeMenu'
  | 'closeConcierge'
  /** `openAppointment` is `openPrivateConsultation` under the name the visitor uses. */
  | 'openAppointment'
  | 'setGalleryFrame'
  | 'activateGate'
  | 'highlightCategory'
  /** The appointment, prepared in the open and sent only on the visitor's word. */
  | 'fillAppointment'
  | 'reviewAppointment'
  | 'submitAppointment'
  | 'cancelAppointment'
  | 'showMoreProducts'
  | 'checkAvailability';

/**
 * The subset of JSON Schema this registry uses, and the validator enforces in full.
 *
 * Widened for arrays because a comparison takes two or three slugs, and "an array of
 * strings" is not a constraint worth having: the item shape, the bounds and the pattern are
 * where a malformed call is actually caught.
 */
/**
 * What a string argument refers to, where the name alone cannot be trusted to say.
 *
 * The validator used to decide "is this a piece?" from the argument's *name* — a list
 * containing 'slug'. That was wrong in both directions at once: `showCollection.slug` is a
 * collection, so every attempt to open one was refused as a piece that does not exist, and
 * `openPrivateConsultation.productSlug` is a piece but was not named 'slug', so an
 * invented one travelled all the way to the consultation form. Declaring the role beside
 * the argument makes both cases fall out of the same rule.
 */
export type SlugFormat = 'piece-slug' | 'collection-slug';

export interface JsonSchemaProperty {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array';
  /** Marks a string (or the entries of an array) as naming something that must exist. */
  format?: SlugFormat;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  /** Arrays only. */
  items?: { type: 'string' | 'integer' | 'number'; enum?: string[]; pattern?: string; format?: SlugFormat };
  minItems?: number;
  maxItems?: number;
  /** Strings only — a slug shape, for instance. */
  pattern?: string;
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  /** Always false in practice: an undeclared argument is dropped, never forwarded. */
  additionalProperties?: false;
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
  /** A reference, resolved by the optimiser at the size it is shown. */
  image: ImageRef;
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
  recentResults: ProductBrief[];
  recentCollections: string[];
  lastOpenedProduct: string | null;
  conciergeState: ConciergeState;
  mode: ConciergeMode;
  viewport: 'desktop' | 'tablet' | 'mobile';
  localHour: number;
  /**
   * The chrome and the page furniture the operator tools act on. None of this is personal:
   * the appointment draft itself is deliberately not here, because this object travels with
   * every model turn, and the draft is handed over only when a tool is asked for it.
   */
  gallery: { count: number; index: number } | null;
  gate: 'gold' | 'diamond' | null;
  highlightedCategory: string | null;
  menuOpen: boolean;
  appointmentOpen: boolean;
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

/**
 * What answered a turn, and why — for the QA view and the harnesses, never for the visitor.
 *
 * A fallback that happens silently is a fault nobody can find: the visitor hears the
 * keyless engine's sentence and no one knows the model was ever tried. Every engine records
 * itself here — the rung, the reason it was reached, the language it read, the intent and
 * the tool — and the controller keeps the last few for `?qa=1`.
 */
export interface TurnTrace {
  /**
   * Which engine answered: the text model or the keyless engine on the typed path; on the
   * voice path the direct rung (the parser, no model), the delegation model, or the voice
   * model speaking alone.
   */
  rung: 'model' | 'keyless' | 'direct' | 'astra' | 'live';
  /** Why a rung below the one tried answered instead — or why the voice did not open — the code and message of the failure, verbatim. */
  fallback?: string;
  language?: string;
  intent?: string;
  /** The plan the keyless engine chose, by id. */
  plan?: string;
  tool?: string;
  note?: string;
}

export type ProviderEvent =
  | { type: 'turn.start'; turnId: string }
  | { type: 'turn.trace'; turnId: string; trace: TurnTrace }
  | { type: 'text.ready'; turnId: string; text: string }
  | { type: 'text.delta'; turnId: string; delta: string }
  | { type: 'text.done'; turnId: string; text: string }
  | { type: 'tool.call'; turnId: string; callId: string; name: ToolName; args: Record<string, unknown> }
  | { type: 'tool.result'; turnId: string; callId: string; outcome: ToolOutcome }
  | { type: 'tool.error'; turnId: string; callId: string; message: string }
  | { type: 'turn.done'; turnId: string }
  | { type: 'turn.error'; turnId: string; message: string; recoverable: boolean }
  | { type: 'voice.session'; status: 'connecting' | 'live' | 'ended'; message?: string }
  /** The visitor's spoken line as the exchange shows it — a placeholder while the words are on their way, then the words. */
  | { type: 'voice.utterance'; id: string; text: string; final: boolean; lost?: boolean }
  /** The visitor has finished a sentence and the session is composing — LISTENING becomes THINKING. */
  | { type: 'voice.thinking' }
  | { type: 'voice.listening'; active: boolean }
  | { type: 'voice.transcript'; text: string; final: boolean }
  | { type: 'voice.speaking'; active: boolean };

export interface ProviderRuntime {
  getCurrentContext(): SiteContext;
  executeTool(name: ToolName, args: Record<string, unknown>, meta: { turnId: string; callId: string }): Promise<ToolOutcome>;
  emit(event: ProviderEvent): void;
  readonly toolDefs: readonly ToolDef[];
}

/**
 * One name per engine, not per vendor.
 *
 * These used to be two names for three things: the server-mediated *text* model called itself
 * `openai-realtime` while advertising `voice: 'none'`, which made the identity useless for
 * the one question anyone asks it — can this thing speak. The Live voice is a different
 * engine with a different transport and different failure modes, and carries its own name.
 */
export type ProviderId = 'keyless' | 'server-model' | 'live-voice';

export interface ProviderCapabilities {
  streaming: boolean;
  /**
   * `none` — this engine does not speak; the controller drives the browser's own speech.
   * `browser` — the same, said explicitly: recognition and synthesis are the browser's.
   * `native` — the engine itself hears and speaks over its own transport.
   */
  voice: 'none' | 'browser' | 'native';
  contextPush: boolean;
  /** Whether the engine reasons, or answers from a fixed plan. Decides what a fallback costs. */
  intelligence: 'deterministic' | 'model';
}

export interface ConciergeProvider {
  readonly id: ProviderId;
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
