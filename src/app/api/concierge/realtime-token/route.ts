import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Future OpenAI Realtime: mint a short-lived client secret with the full session
 * configuration baked in (instructions = system prompt + site context, tools in the
 * flat Realtime shape, transcription, server VAD, voice). See CONCIERGE_ARCHITECTURE.md.
 *
 * Stage 1 ships the seam only. The API key is read here and nowhere else.
 */
export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: {
          code: 'CONCIERGE_VOICE_OFFLINE',
          message: 'Live voice is not configured. Set OPENAI_API_KEY to enable the OpenAI Realtime concierge.',
          see: 'CONCIERGE_ARCHITECTURE.md#future-openai-realtime--activation',
        },
      },
      { status: 503 },
    );
  }
  // TODO(realtime-1): POST https://api.openai.com/v1/realtime/client_secrets with
  // { session: { type: 'realtime', model: OPENAI_REALTIME_MODEL, instructions, tools: realtimeTools(),
  //   audio: { input: { transcription: { model: 'whisper-1' }, turn_detection: { type: 'server_vad', silence_duration_ms: 600 } },
  //            output: { voice: OPENAI_REALTIME_VOICE } } } }
  // and return { token: data.value, expiresAt: data.expires_at, model }.
  return NextResponse.json({ error: { code: 'CONCIERGE_VOICE_NOT_IMPLEMENTED', message: 'Realtime minting is a Stage 2 task.' } }, { status: 501 });
}
