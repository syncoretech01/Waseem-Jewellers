'use client';

import { startSyntheticMeter, stopMeter } from './meter';
import type { VoiceContextInput } from './realtimePrompt';
import type { ProviderEvent, SiteContext, ToolName, ToolOutcome } from '../types';

export type VoiceErrorCode = 'MIC_DENIED' | 'NO_SPEECH' | 'NETWORK' | 'ABORTED' | 'UNSUPPORTED';

export interface VoiceHandlers {
  onStart(): void;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onEnd(): void;
  onError(e: { code: VoiceErrorCode; message: string }): void;
}

/**
 * Two adapters, and no ladder between them.
 *
 * `realtime` is the Live session (`live.ts`): one conversation over WebRTC that hears, reasons
 * through this application and speaks. `scripted` is "Let me show you": a typed example line
 * through the same handlers, on any browser, with no microphone and no credential. Nothing
 * else listens — the browser's own recognition and the transcription tier are gone, and a
 * session that cannot open is said so once and answered by the written concierge.
 */
export interface VoiceAdapter {
  readonly kind: 'scripted' | 'realtime';
  isSupported(): boolean;
  start(handlers: VoiceHandlers): Promise<void>;
  /** The visitor is done for now: the example finalises; the session rests its microphone. */
  stop(): void;
  abort(): void;
  /** A session adapter keeps one conversation open across turns; it needs the concierge's runtime. */
  bind?(runtime: VoiceSessionRuntime): void;
  isLive?(): boolean;
  /** The session hears the room: the microphone is attached and open. */
  isHearing?(): boolean;
  /** Open the call before any tap, so the tap is instant; resolves whether it is live. Never asks a permission. */
  warm?(): Promise<boolean>;
  /** A typed sentence into the same conversation. */
  sendText?(text: string): boolean;
  /** Cut the reply that is being spoken; the conversation stays. */
  interrupt?(): void;
  /** End the conversation gracefully and release everything. */
  close?(): Promise<void>;
}

export interface VoiceSessionRuntime {
  emit(event: ProviderEvent): void;
  executeTool(name: ToolName, args: Record<string, unknown>): Promise<ToolOutcome>;
  /** What the session should know about the page, rendered small. */
  context(): VoiceContextInput;
  /** The page as the router and the tools read it. */
  siteContext(): SiteContext;
  /** Fires whenever the page changes in a way the session should hear about; returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

/**
 * "Let me show you": types a visitor line through the same handlers, so the whole
 * pipeline — listening, thinking, action, reply — runs on any browser.
 */
export class ScriptedExampleAdapter implements VoiceAdapter {
  readonly kind = 'scripted' as const;
  private timers = new Set<number>();
  private line = '';

  constructor(private nextLine: () => string) {}

  isSupported() {
    return true;
  }

  async start(h: VoiceHandlers) {
    this.abort();
    this.line = this.nextLine();
    h.onStart();
    startSyntheticMeter();
    const chars = [...this.line];
    let i = 0;
    const type = () => {
      i += 1;
      h.onInterim(chars.slice(0, i).join(''));
      if (i < chars.length) {
        const id = window.setTimeout(type, 42 + Math.random() * 18);
        this.timers.add(id);
      } else {
        const id = window.setTimeout(() => {
          stopMeter();
          h.onFinal(this.line);
        }, 420);
        this.timers.add(id);
      }
    };
    const first = window.setTimeout(type, 900);
    this.timers.add(first);
  }

  stop() {
    this.abort();
  }

  abort() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.clear();
    stopMeter();
  }
}
