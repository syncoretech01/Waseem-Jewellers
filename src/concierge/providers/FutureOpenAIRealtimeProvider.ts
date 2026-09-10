import type { ConciergeProvider, ProviderCapabilities, ProviderRuntime, SiteContext } from '../types';
import type { TurnSource } from '@/state/conciergeStore';

/**
 * Typed stub for the OpenAI Realtime concierge. Nothing here connects anywhere in Stage 1.
 * Activation steps live in CONCIERGE_ARCHITECTURE.md (§ Future OpenAI Realtime — activation);
 * each TODO below maps to one of them. The API key is never read in the browser.
 */
export class FutureOpenAIRealtimeProvider implements ConciergeProvider {
  readonly id = 'realtime-voice' as const;
  readonly capabilities: ProviderCapabilities = { streaming: true, voice: 'native', contextPush: true, intelligence: 'model' };
  private runtime: ProviderRuntime | null = null;

  attach(runtime: ProviderRuntime) {
    this.runtime = runtime;
    if (process.env.NEXT_PUBLIC_CONCIERGE_PROVIDER !== 'openai') {
      runtime.emit({ type: 'turn.error', turnId: 'attach', message: 'NOT_CONFIGURED', recoverable: false });
    }
  }

  async detach() {
    // TODO(realtime-9): full teardown — data channel, mic tracks, peer connection, AudioContext, rAF meter, <audio> element.
    this.runtime = null;
  }

  async submitText(_text: string, _opts: { turnId: string; source: TurnSource }) {
    // TODO(realtime-6): send conversation.item.create { type:'message', role:'user', content:[{ type:'input_text', text }] } + response.create.
    this.runtime?.emit({ type: 'turn.error', turnId: _opts.turnId, message: 'NOT_CONFIGURED', recoverable: true });
  }

  cancelTurn() {
    // TODO(realtime-6): response.cancel on the data channel.
  }

  pushContext(ctx: SiteContext) {
    void ctx;
    // TODO(realtime-8): debounced session.update { session: { instructions: BASE + renderContext(ctx) } }.
  }

  async startVoice() {
    // TODO(realtime-1): POST /api/concierge/realtime-token with { context } → { token }.
    // TODO(realtime-2): new RTCPeerConnection(); getUserMedia({ audio:true }); addTrack.
    // TODO(realtime-3): pc.ontrack → detached <audio autoplay>; analyser → voiceMeter.speech.
    // TODO(realtime-4): pc.createDataChannel('oai-events'); parse JSON frames; match event types by suffix.
    // TODO(realtime-5): POST offer.sdp to https://api.openai.com/v1/realtime/calls with the ephemeral token; setRemoteDescription(answer).
    // TODO(realtime-7): on function_call_arguments.done → runtime.executeTool(name, args) → conversation.item.create { type:'function_call_output', call_id, output } + response.create;
    //                   track pending call ids so turn.done is emitted only when a response.done arrives with none pending.
    this.runtime?.emit({ type: 'voice.session', status: 'ended', message: 'NOT_CONFIGURED' });
  }

  async stopVoice() {
    await this.detach();
  }

  interrupt() {
    // TODO(realtime-6): response.cancel + output_audio_buffer.clear.
  }
}
