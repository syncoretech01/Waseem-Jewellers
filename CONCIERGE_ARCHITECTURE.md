# Concierge Architecture — Waseem Jewellers (Stage 2)

Everything below describes the code as it stands at the end of Stage 2. Where the design changed
from Stage 1, the reason is given rather than the history; `git log` has the history.

## Principle

The concierge is a private jewellery associate, not a chatbot. It acts in the room — brings
pieces, opens a department, keeps a piece, arranges a consultation — and then says one or two
sentences. It answers in the language it was addressed in. It never invents a specification, a
price or a piece: every fact it states is a published field of the listable catalogue, and every
piece it names has a page.

Three guarantees hold whichever engine is answering, and each is mechanical rather than
instructional:

1. **A tool call is validated before it acts** (`tools/validate.ts`), on every path. A slug that
   is not in the listable set is refused, not corrected.
2. **The reply passes the brand register** (`register.ts`): two sentences, no exclamation, no
   emoji, no markdown, no slug, never "the House".
3. **The model sees only what it may say** (`src/server/concierge/retrieve.ts`): at most twelve
   candidate pieces, chosen before its first token, and told that anything not listed is not
   published.

## The engines

There are two today and a seam for a third. `createProvider()` returns one thing — a
`FallbackProvider` — and there is no selection to configure.

| Engine | Id | Where it runs | What it is for |
|---|---|---|---|
| Keyless | `keyless` | browser | The shipped default and the regression layer. Deterministic multilingual NLU over twelve core actions. Answers when there is no key, when the model fails, and in CI. |
| Server model | `server-model` | our server → the model | Open-ended understanding. Grounded on retrieval, validated on every tool call, filtered on every sentence. Ships dark: it is live the moment `CONCIERGE_API_KEY` is set and the same build is redeployed. |
| Realtime voice | `realtime-voice` | browser data channel → the model | Not built. The seam it plugs into is (`voice/engine.ts`). |

**`FallbackProvider`** tries the model and, on any *recoverable* failure before the first word
has been shown — no key, rate limit, timeout, an upstream error — runs the same sentence through
the keyless engine under the same turn id. The controller never learns it happened. A failure
after words have been shown is not recoverable: re-answering would put two different answers in
front of the visitor.

The client asks the server what it is allowed to be through **`capabilities.ts`** —
`GET /api/concierge/capabilities`, fetched when the panel first opens, cached five minutes in
`sessionStorage`. The answer is computed from server-only environment, which is why activating
the model needs no rebuild: the bundle is byte-identical with or without the key.

## Files

```
src/concierge/
  ConciergeController.ts   the state machine; owns the provider, the voice adapter, the timers
  createProvider.ts        returns a FallbackProvider — nothing to select
  capabilities.ts          the probe: intelligence, voice, languages, enquiry, privacy
  bridge.ts                requestConcierge() — any page asks for the salon without importing it
  memory.ts                ConversationMemory: standing slots, anchor, discussed, language; projectMemory()
  ordinals.ts              "the second one" — shared by the planner and the tools
  register.ts              enforceBrandRegister, completeSentences — the sentence terminators of five scripts
  types.ts                 ConciergeProvider, ProviderRuntime, ProviderEvent, ToolDef, JsonSchema
  nlu/                     isomorphic, DOM-free: script.ts, tokenize.ts, translit.ts, numbers.ts, lexicon.ts, parse.ts, fixtures.ts
  providers/
    FallbackProvider.ts    model first, keyless on recoverable failure
    ServerConciergeProvider.ts   NDJSON over /api/concierge/turn; executes browser tools; validates again
    MockConciergeProvider.ts     the keyless engine (the name predates its role as the default)
    mock/commands.ts, mock/corePlan.ts   the planner: corePlan (NLU) first, a regex table after
  tools/
    toolDefs.ts            one registry, JSON-schema parameters, runtime: browser | server
    validate.ts            the gate — schema, slug existence by declared role, path allowlist, budget
    executeTool.ts         every browser tool; validates at the top, because the realtime path has no other gate
  voice/
    engine.ts              chooseVoiceEngine — which engine listens; registerVoiceEngine for the native one
    languages.ts           recognition language by conversation, speech runs by script, voice by language
    adapters.ts            WebSpeechAdapter (three alternatives, scored), ScriptedExampleAdapter
    speech.ts              planSpeech — never a wrong-language voice; silence and a written reply instead
    meter.ts, scripts.ts
  ui/
    ConciergeMount.tsx     eager: the orb, and the lazy salon behind it
    ConciergeRoot.tsx      lazy: the panel, the tray, the bridge listener
    ConciergePanel.tsx     the rail; ContextRibbon.tsx; Composer.tsx; Exchange.tsx; VoiceStage.tsx
    ResultTray.tsx         the vitrine
    ConciergeOrb.tsx       the door — store and bridge only, no controller

src/server/concierge/     server-only, never importable from the browser (ESLint + secret-scan)
  retrieve.ts             ground(): parse → filter → rank → ≤12 candidates; the catalogue block
  prompt.ts               persona, rules, the sanitised context
  continuation.ts         the HMAC-signed continuation between rounds; pending calls bound by id + name + args hash
  untrusted.ts            sanitiseMemory, sanitiseToolResult, sanitiseContext — nothing from the browser is trusted for its shape
  serverTools.ts          compareProducts, explainSpecification, deepSearch — executed where the catalogue is
  limits.ts               token buckets per scope (concierge 12/min · 60/hr; enquiry 3/min · 5/hr), best-effort on serverless

src/app/api/concierge/
  capabilities/route.ts   what this deployment is
  turn/route.ts           the stateless agent loop
  tool/route.ts           reserved
  realtime-token/route.ts reserved for the realtime engine
```

## A turn, on the model path

1. The browser posts `{ turnId, text, context, memory, continuation?, toolResults? }`.
   `context` and `memory` are TypeScript types on a POST body and are re-validated on arrival
   (`untrusted.ts`): slugs against the listable set, slots through the published vocabulary,
   numbers clamped, the route matched to a real page, the selection reduced to a count.
2. `ground()` reads the sentence with the same parser the keyless engine uses, merges the
   standing topic under it (new words always win), and retrieves candidates: the anchor, then
   what was just shown, then what has been discussed, then the ranked matches — twelve at most.
3. `buildMessages()` assembles the persona, the rules, the sanitised where-am-I line (the piece
   in view comes from `grounding.anchor`, never from a name the browser supplied), the
   `<catalogue>` block, and the keyless engine's reading as a `<visitor-intent>` hint.
4. The model streams. Text deltas are forwarded; the browser buffers to a sentence boundary
   before showing anything, so the register filter never truncates a sentence mid-arrival.
5. Tool calls are validated. Server tools run here and their results join the messages.
   Browser tools are sent down as `tool.call` frames, and their ids, names and argument hashes
   are sealed into the continuation.
6. The browser validates again, executes, and posts back the **real** outcomes — `result`, the
   JSON the model reasons over, not `ui`. The server accepts only issued ids with matching
   names, drops duplicates, fills unanswered calls with `NO_RESULT`, and sanitises payloads.
7. Three rounds, four tool calls. The last permitted round ends the turn rather than sealing a
   continuation the next request would refuse. A turn whose every call was refused and which
   said nothing fails recoverably, and the keyless engine answers instead.
8. The browser composes the rounds' text as one reply and applies the register once — two
   sentences for the whole turn, not per round — and emits `text.ready` on the first finished
   sentence so the voice can speak it.

## The keyless engine

`nlu/` is deliberately narrow: twelve core actions, a lexicon of a few hundred surface forms
across Latin, Arabic and Gurmukhi scripts, a 0.45 confidence floor below which it asks rather
than acts. It is not trying to imitate the model, and **its lexicon is not to be grown to chase
natural phrasing** — that is the model's job. `npm run nlu:check` runs the fixture set (intent
≥ 95 %, slots ≥ 90 %, wrong-slug actions 0) as a *development* gate. A blind set written by
native speakers who have not seen the lexicon is the *acceptance* gate, and it is a person's
sign-off, not a number.

## Tools

Twenty-four in `toolDefs.ts`. Every argument that names a piece is declared `format:
'piece-slug'` and existence-checked against the listable set; `showCollection`'s slug is a
collection and is checked against its own enum instead. Numeric bounds clamp rather than refuse
(a model asking for forty pieces meant "several"); enum and pattern violations refuse (those name
things that do not exist). Undeclared arguments are dropped — the args a tool receives are
rebuilt from the schema, never passed through.

Browser tools act on the page: search, open, focus, save, remove, the selection, a section, the
consultation, a department, a collection, matching pieces, refine (with the honesty ladder for
"something lighter": published weight, else form, never an estimated gram), filters into the
URL, clear filters, price guidance (which carries a budget into the consultation rather than
inventing a range), navigate. `showGold`/`showDiamond`/`showBridal` are deprecated aliases of
`showDepartment`/`showCollection`.

Server tools read the catalogue where it is: `compareProducts` (null for every unpublished cell,
said explicitly), `explainSpecification` (material notes, attributed as general facts),
`deepSearch`.

Not registered, deliberately: `showSetMembers` — `setId` is empty on every piece, so it could
only ever return nothing; and a campaign filter — 64 of 69 campaign pieces are withheld pending
names from Waseem, so it returned an empty tray for seven of nine campaigns.

## Memory

`ConversationMemory` in `conciergeStore`: standing slots (six turns / eight minutes), anchor
(four turns), discussed (twelve), language. A route change to a different piece replaces the
anchor and keeps the topic. `projectMemory()` sends a bounded projection to the model — never a
transcript — and `ContextRibbon` shows the standing topic as removable terms, so what the
concierge believes it is being asked about is visible and undoable.

## Voice

Browser `SpeechRecognition` / `speechSynthesis` are the **fallback tier**. No browser offers
`pa-PK`; Punjabi in Arabic script is heard as `ur-PK`, Roman Urdu as `en-IN`, and the language
follows the conversation (`memory.language`), not `navigator.language`. Three recognition
alternatives are scored. Speech is planned per run of one script, each run asks for a voice in
its own language, and a run with no such voice is not spoken in another — the concierge says so
once and lets the written reply stand.

`chooseVoiceEngine` picks the engine from the same capabilities probe that picks the text
model. The realtime engine registers itself through `registerVoiceEngine` when it exists and the
server advertises `voice: 'native'`; nothing in the UI changes. Its contract is written at that
seam. `executeTool` validates its own arguments because on that path nothing else will.

## The UI

Three zones (see DESIGN_SYSTEM.md, "The salon"): the rail (the associate — words and state,
never an image larger than a thumbnail), the vitrine (the jewellery, `ResultTray`), the stage
(the page, which steps aside via `html[data-rail="1"]`). Results do not collapse the rail; only
an action that takes over the stage does.

`ConciergeMount` is eager and small: the orb, driving the panel through the bridge. The salon —
controller, lexicon, tools, providers, panel — mounts on the first request, on a hover of the
orb, or on idle after the loading ritual, whichever comes first; a request that beats the chunk
is held and replayed. Measured: 555 ms from a pre-idle click to an open salon, and 40 kB gzipped
off every route's initial script set.

The nine states are unchanged: IDLE · HOVER · OPENING · CHAT · VOICE_READY · LISTENING ·
THINKING · SPEAKING · EXECUTING_ACTION · RESULT · ERROR. On a phone the sheet is modal and
behaves like one — the page behind is inert, focus is trapped; on desktop the rail is not modal,
and closing it returns focus to whatever opened it.

## Enquiry

The consultation form stays on the visitor's device — a reference, a note kept in the tab, their
own WhatsApp message — until **all** of a delivery destination, a canonical origin, a privacy
statement URL and a privacy contact are configured. `assessEnquiryReadiness` is the one
decision; `/api/enquiry` and the capabilities probe both consume it; `npm run enquiry:check`
proves that a webhook alone stays local. The acknowledgement says what happened: *ready* when
nothing was sent, *delivered* only when the sink took it.

## Environment

| Variable | Read by | Effect |
|---|---|---|
| `CONCIERGE_API_KEY` | `src/server/env.ts` | The model path goes live; the same build, redeployed. Absent is the shipped state. |
| `CONCIERGE_MODEL`, `CONCIERGE_BASE_URL` | `src/server/env.ts` | Defaults `gpt-4o-mini`, the OpenAI base. |
| `CONCIERGE_SIGNING_SECRET` | `src/server/env.ts` | Signs continuations; falls back to the key. |
| `ENQUIRY_WEBHOOK_URL`, `NEXT_PUBLIC_SITE_URL`, `ENQUIRY_PRIVACY_URL`, `ENQUIRY_PRIVACY_CONTACT` | `src/server/enquiry/readiness.ts` | All four, valid, before a consultation leaves the device. |
| `NEXT_PUBLIC_QA_TIER_OVERRIDE=1` | `src/lib/quality.ts` | A QA build honours `?tier=` and exposes `__wjFps`. |
| `OPENAI_API_KEY` | `realtime-token/route.ts` | Reserved for the realtime engine. |

Nothing `NEXT_PUBLIC_` selects a provider. That variable existed in Stage 1 and could not do the
job — it is inlined at build time — and it is gone.

Three layers keep the key out of the browser: `import 'server-only'` in every `src/server`
module, an ESLint rule forbidding `@/server/*` from client directories, and
`scripts/dev/secret-scan.mjs`, which greps the built client chunks for the key's value on every
`npm run check`.

## Not built

- The realtime voice engine (the seam is; the contract is at `voice/engine.ts`).
- `showSetMembers` and campaign filtering, for want of data (above).
- A comparison surface in the UI: `compareProducts` returns a table the model can reason over,
  and there is no `ComparisonTray` rendering it yet.
- Server-side persistence of anything. Memory is session-scoped by design; the selection alone
  persists, in `localStorage`, pruned against the catalogue at hydration.
