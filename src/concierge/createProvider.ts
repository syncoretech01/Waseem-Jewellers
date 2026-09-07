import type { ConciergeProvider } from './types';
import { MockConciergeProvider } from './providers/MockConciergeProvider';
import { FutureOpenAIRealtimeProvider } from './providers/FutureOpenAIRealtimeProvider';

/** Env-driven selection with a silent fallback to the keyless concierge. */
export function createProvider(): ConciergeProvider {
  if (process.env.NEXT_PUBLIC_CONCIERGE_PROVIDER === 'openai') {
    if (process.env.NODE_ENV === 'development') console.info('[concierge] OpenAI Realtime provider selected; falling back to the keyless concierge until activated.');
    void FutureOpenAIRealtimeProvider;
  }
  return new MockConciergeProvider();
}
