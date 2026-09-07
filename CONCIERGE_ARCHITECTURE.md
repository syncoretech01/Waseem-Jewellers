# Concierge Architecture — Waseem Jewellers (Stage 1)

## Principle
A private associate who does things in the room and says one or two sentences after. Never a chat log that looks like software: no bubbles, avatars, timestamps, chips, spinners or badges.

## States
IDLE · HOVER · OPENING · CHAT · VOICE_READY · LISTENING · THINKING · SPEAKING · EXECUTING_ACTION · RESULT · ERROR — the `TRANSITIONS` table lives in `src/state/conciergeStore.ts`; illegal transitions are ignored with a development warning.

## Seam
`ConciergeProvider` proposes; `ConciergeController` executes and renders through the store. Providers: `MockConciergeProvider` (default, keyless, ordered command table) and `FutureOpenAIRealtimeProvider` (typed stub). Tools: `TOOL_DEFS` (JSON schema) + one browser-side `executeTool` returning `ToolOutcome { result, label, navigateTo?, ui? }`. The UI reads only the store and cannot tell which provider or voice adapter is active.

## Site context
`getCurrentContext()` returns route, section, current / focused / visible products, selected collection and world, wishlist, recent results, concierge state, viewport and local hour — so "open the second one" and "show me something that matches this" resolve.

## Voice
`WebSpeechAdapter` (SpeechRecognition where available) · SpeechSynthesis replies · `ScriptedExampleAdapter` fallback ("Let me show you") — all drive the same FSM, so every state is demonstrable without a key or a microphone.

## Future OpenAI Realtime — activation
1. Set `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`; set `NEXT_PUBLIC_CONCIERGE_PROVIDER=openai`.
2. Implement the mint in `src/app/api/concierge/realtime-token/route.ts` (client secret with instructions = system prompt + `renderContext(ctx)`, `realtimeTools()`, transcription, server VAD, voice).
3. Complete `FutureOpenAIRealtimeProvider` steps `TODO(realtime-1..9)`: token POST with context → RTCPeerConnection + microphone → remote audio → `oai-events` data channel → SDP to `/v1/realtime/calls` → suffix-matched events → `function_call_arguments.done` → `executeTool` → `function_call_output` + `response.create` → `pushContext` via `session.update` → teardown.
4. Server-only tools (bookings, database search) go through `/api/concierge/tool`.

The API key is read only inside route handlers and never imported by client modules.
