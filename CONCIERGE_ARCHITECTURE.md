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
    appointment.ts         the draft read the way the form reads it: required fields, showroom by name, date, the read-back
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
  serverTools.ts          compareProducts, explainSpecification, deepSearch, checkAvailability — executed where the catalogue is
  limits.ts               token buckets per scope (concierge 12/min · 60/hr; enquiry 3/min · 5/hr), best-effort on serverless

src/server/booking/
  provider.ts             BookingProvider, NullProvider, bookingProvider() — the seam; nothing books today

src/app/api/concierge/
  capabilities/route.ts   what this deployment is (intelligence, voice, enquiry, privacy, booking)
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

Thirty-seven in `toolDefs.ts`. Every argument that names a piece is declared `format:
'piece-slug'` and existence-checked against the listable set; `showCollection`'s slug is a
collection and is checked against its own enum instead. Numeric bounds clamp rather than refuse
(a model asking for forty pieces meant "several"); enum and pattern violations refuse (those name
things that do not exist). Undeclared arguments are dropped — the args a tool receives are
rebuilt from the schema, never passed through.

Browser tools act on the page: search, open, focus, save, remove, the selection, a section, the
appointment form, a department, a collection, matching pieces, refine (with the honesty ladder
for "something lighter": published weight, else form, never an estimated gram), filters into
the URL, clear filters, price guidance (which carries a budget into the appointment form rather
than inventing a range), navigate, and the operator tools below. `showGold`/`showDiamond`/
`showBridal` are deprecated aliases of `showDepartment`/`showCollection`; `openSaved` and
`openAppointment` are `openWishlist` and `openPrivateConsultation` under the names a visitor
uses (the voice session also knows the latter as `bookAppointment`).

Server tools read the catalogue where it is: `compareProducts` (null for every unpublished cell,
said explicitly), `explainSpecification` (material notes, attributed as general facts),
`deepSearch`, and `checkAvailability` (the booking seam, below).

## Operating the site

The concierge moves the visitor and works the page on request, then confirms in one short
sentence what is in front of them, and never names a tool. Every one of these is one visitor
sentence — the phrases are in the tool descriptions, in English and Roman Urdu — and each does
exactly what the visitor's own hand would, through the same transition system the site's links
use (`runtime.transition.navigate`; never `window.location`).

| Tool | Visitor says | What happens |
|---|---|---|
| `navigate { target \| path }` | "take me to gold", "go back", "home", "the bridal collection", "where are your showrooms", "my saved pieces", "the appointment form" | A target resolves to the allowlisted path or to the tool that owns it: `locations` is the heritage chapter, `appointment` the form, `saved` the ledger. `back` is the router's history step, which the transition layer answers with its reveal half; the result says where the visitor landed, or that there was nowhere to go. The path allowlist is unchanged. |
| `scrollToSection { section }` | "the craft", "the showrooms", "the kinds", "the gate" | A homepage chapter from any page: home first, then the glide — issued after arrival and after `lenis.resize()`, because the smooth scroller otherwise clamps the target to the previous page's height. `kinds` is the row of kinds inside the window chapter (`[data-kinds]`, else the chapter's `nav`); `gate` is the Gold / Diamond gate chapter. |
| `openMenu` / `closeMenu` / `closeConcierge` | "open the menu", "close", "bas" | The chrome. `closeConcierge` closes the panel 1.6 s later, after the goodbye. |
| `openSaved` / `openAppointment` | "show my saved pieces", "open the appointment form" | Aliases, above. |
| `setGalleryFrame { index }` | "the second photo", "doosri tasveer" | On a piece's page only. `Gallery.tsx` publishes `{ slug, count, index }` to the store and answers `galleryRequest` by bringing the frame into view (stacked frame on a wide screen, snap position on a phone). A frame past the count is refused with the count. |
| `activateGate { material }` | "the gold side", "diamond wala" | Sets `siteStore.gate` and glides to the gate chapter, home first if needed; the chapter reads the store. |
| `highlightCategory { category }` | "where are the bangles" | Sets `siteStore.highlightedCategory` and glides to the kinds. |
| `getCurrentContext` | — | Route kind, path, section, the piece in view and its frame count, the selection count, whether the menu, the ledger and the appointment form are open, and the appointment draft with what is still missing. |

**The appointment, and the confirmation rule.** Three tools, and the visitor watches all three:

- `fillAppointment { name?, phone?, email?, showroom?, occasion?, date?, window?, message?, productSlugs?, addSelection? }`
  writes into `siteStore.consultation.draft` and opens the form if it is closed. The form shows
  the draft in its own fields; a field the visitor has typed into since is theirs (per-field
  timestamps on both sides — the later hand wins). A showroom is resolved by id or by the name
  a visitor says ("Liberty", "Gulberg" is in the published address); a date must be `YYYY-MM-DD`
  and not past; a telephone number must pass the form's own rule; product slugs pass the
  validator like every other slug and `addSelection` adds the saved pieces. The result is the
  draft in words (showroom name, occasion label, pieces by name) and the still-missing required
  fields — name, telephone, showroom, occasion, the same four the form refuses without — with a
  note to ask for them one at a time and never to invent a value.
- `reviewAppointment` returns the same read-back so the confirming sentence is built from the
  words on the form: "I have everything ready for Saturday at Liberty Market — shall I send the
  request?"
- `submitAppointment { confirmed }` refuses with `NOT_CONFIRMED` unless `confirmed === true`,
  and both personas say to pass that only after the visitor has answered yes in the
  conversation. It then runs the form's own button — `requestConsultationSubmit()` bumps a
  nonce the modal answers with `form.requestSubmit()`, so validation, the honeypot and the
  elapsed-time rule are exactly what a click gets — and waits for the outcome the modal writes
  to `siteStore.consultationOutcome`. What comes back is what happened: `prepared` (kept on the
  device with a `WJ-` reference and the visitor's own WhatsApp line; nothing transmitted),
  `delivered` (the server sink took it), `failed` (sent, did not arrive; the reference and
  WhatsApp are still the visitor's), or `INCOMPLETE` with the form's missing fields. Every
  result carries `booked: false`, because no provider books, and the personas are told: never
  say booked, confirmed or reserved — "your request is prepared with reference WJ-…; sending it
  on WhatsApp is the next step" / "your request has been sent; our team will confirm".

Nothing here changes where a name and a telephone number may go. The draft lives in memory in
the store (never persisted, never partialised), the per-turn `SiteContext` the model path posts
carries only whether the form is open, the voice `<site-context>` block carries only which
fields are filled and which are missing, and the draft's values are returned only by the tools
that are asked for them. The form posts `/api/enquiry` only when `capabilities().enquiry` is
`server`, as before; on the local path the harness proves no request is made at all.

**The booking seam.** `src/server/booking/provider.ts` declares `BookingProvider` —
`availability({ showroom, date })` and `book(input)` — and ships `NullProvider` (`kind: 'none'`,
availability `null`, `book` resolving `{ booked: false, reason: 'no booking provider configured' }`).
`bookingProvider()` selects by `BOOKING_PROVIDER`; only `none` is implemented, and the comments
describe what a Calendly or webhook provider would do. The capabilities route exposes
`booking: provider.kind` and the client type carries it. `checkAvailability { showroom, date }`
is a read-only server tool over the seam: today it answers `{ available: null, note:
'availability is not published; our team confirms times' }`, and a model is told never to
state a time it did not return. Only a provider returning `booked: true` could ever let the
word "booked" be said, and none does.

`npm run operator:check [base]` drives all of it through `ConciergeController.runTool` — the
validator, the events and the store transitions a model's call takes — against a running
server with the capabilities route mocked to keyless / local: `navigate 'gold'` through the
curtain, `back`, a homepage chapter from a department page resting within 200 px, the ledger,
the form filled with the values visible in its inputs (and the visitor's own typing kept),
`submitAppointment` refused without confirmation and `prepared` with it — with `/api/enquiry`
never called — the gallery frame moving into view, and the panel closing after a goodbye
(43 assertions).

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

Three tiers, chosen in one place (`voice/engine.ts`, `chooseVoiceEngine`) by the same
capabilities probe that picks the text model. Top down:

| Tier | Advertised as | What it is |
|---|---|---|
| **Native** — the client-demo voice | `voice: 'native'` when `OPENAI_API_KEY` is set and `CONCIERGE_REALTIME` is not `off` | One model that hears, understands and speaks: `gpt-realtime-2.1` over WebRTC (`voice/realtime.ts`). The server mints a ten-minute client secret (`POST /api/concierge/realtime-token`) with the whole session decided there — model, voice (`OPENAI_REALTIME_VOICE`, default `marin`), semantic voice-activity detection with interruption, noise reduction, the input transcription model (`CONCIERGE_REALTIME_STT`, default `gpt-4o-transcribe` with a Roman-script vocabulary prompt), the browser tools, and the spoken persona (`voice/realtimePrompt.ts`). The browser opens the call, keeps one conversation across turns and routes, refreshes a small `<site-context>` block through `session.update` as the page changes (piece in view with its published facts, the pieces just shown with ordinals and slugs, the standing request, the selection), and answers every function call through `executeTool` — the validator is the only gate on this path, and it is enough. |
| **Server** — the fallback | `voice: 'server'`, and implied by `native` | `ServerTranscriptionAdapter` records an utterance with `MediaRecorder`, ends it on the meter's silence and posts it to `POST /api/concierge/transcribe` (`CONCIERGE_STT_MODEL`, default `gpt-4o-transcribe` with the vocabulary prompt; the newer `gpt-transcribe` family takes keywords and `languages: en, ur` — Punjabi is not an accepted code and is heard through Urdu). The words enter the same grounded, validated, register-filtered text turn a typed sentence does; the reply is spoken by `POST /api/concierge/speak` (`gpt-4o-mini-tts`, the associate's register as instructions). |
| **Browser** — what ships with no credential | `voice: 'browser'` | `WebSpeechAdapter` and `speechSynthesis`. No browser offers `pa-PK`; Punjabi in Arabic script is heard as `ur-PK`, Roman Urdu as `en-IN`; three alternatives are scored; a run with no voice in its own language is written rather than spoken in another. |

**The ladder steps down one rung, never silently.** A realtime session that cannot open
(the token refused, WebRTC failing) falls to the server tier for that visitor; a server
transcription that fails falls to the browser's own hearing. The store records the rung
(`voice.fallback`) and the stage says so in the visitor's words — "Listening — if I mishear,
correct me or write to me." — never "WebSpeech", "API" or "provider".

**The native session, event by event.** `speech_started` over a reply cancels it on both ends
(`response.cancel` + `output_audio_buffer.clear`, the stage says "Go on — I am listening.");
`speech_stopped` writes a placeholder line into the exchange and moves the state to THINKING;
the transcription lands on its own line by item id (two quick sentences keep their own words)
and the stage shows it as *Heard*; `response.created` opens a concierge turn; the reply's
transcript streams as deltas; `output_audio_buffer.started` / `stopped` drive SPEAKING, so the
state follows the audio; function calls run through `executeTool`, their outputs go back, and
the model continues the same turn; `response.done` with no calls pending finishes it. No more
than four actions answer one sentence. A typed correction ("Not quite? Correct it") goes into
the same session; "Once more" clears the words and listens again; "Write instead" rests the
microphone without ending the conversation. Four minutes of silence end the session; the next
tap reopens it. A transcript the model writes in Devanagari or Gurmukhi is romanised before it
is shown (`src/lib/romanise.ts`); Urdu script and English are left as they are.

**What was measured, on the review build, in a real browser with the ten spoken prompts
played into the microphone (16 September 2026):** first spoken word 0.5–0.8 s after the
visitor stopped; the action 1.5–3.3 s; the turn 3–6 s; barge-in two seconds into a reply
cancelled it and answered the new sentence with the context kept. The transcription →
text-model → speech pipeline on the same build waited 4.8–7.6 s for the first spoken word.
Realtime is the client-demo path; the pipeline is the fallback. The prompts were synthesised
speech, not a Lahore speaker — the blind native-speaker gate still stands.

`npm run voice:check` drives every state through a headless browser with the speech APIs
faked and the routes mocked: browser tier, server tier, and the native tier refused and
falling to the server tier (24 assertions).

The spoken persona carries the same "Operating the site" and appointment sections as the
written one (`VOICE_INSTRUCTIONS`), with the Roman Urdu the phrases are heard in, and the
session's tool list now includes `navigate` — "take me to gold" and "go back" are spoken as
often as typed. The `<site-context>` block tells the session how many photographs the piece
in view has and the state of the appointment form (open or closed, which fields are filled,
which are still needed) — never the visitor's name or number, which the session reads back
only through `reviewAppointment`.

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
| `CONCIERGE_MODEL`, `CONCIERGE_BASE_URL` | `src/server/env.ts` | Defaults `gpt-5.6-terra` (reasoning off, `max_completion_tokens`; older families get `temperature` and `max_tokens`), the OpenAI base. |
| `CONCIERGE_SIGNING_SECRET` | `src/server/env.ts` | Signs continuations; falls back to the key. |
| `ENQUIRY_WEBHOOK_URL`, `NEXT_PUBLIC_SITE_URL`, `ENQUIRY_PRIVACY_URL`, `ENQUIRY_PRIVACY_CONTACT` | `src/server/enquiry/readiness.ts` | All four, valid, before a consultation leaves the device. |
| `NEXT_PUBLIC_QA_TIER_OVERRIDE=1` | `src/lib/quality.ts` | A QA build honours `?tier=` and exposes `__wjFps`. |
| `OPENAI_API_KEY` | `src/server/env.ts` | One credential, everything on: the text model (when `CONCIERGE_API_KEY` is absent and the base is OpenAI's), the server voice tier and the realtime tier; the probe advertises `intelligence: 'model'`, `voice: 'native'`. |
| `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `CONCIERGE_REALTIME_STT`, `CONCIERGE_REALTIME` | `src/server/env.ts` (`realtimeEnv`) | Defaults `gpt-realtime-2.1`, `marin`, `gpt-4o-transcribe`; `CONCIERGE_REALTIME=off` keeps the server tier as the top of the ladder. |
| `CONCIERGE_STT_MODEL`, `CONCIERGE_TTS_MODEL`, `CONCIERGE_TTS_VOICE`, `CONCIERGE_VOICE_BASE_URL` | `src/server/env.ts` | Defaults `gpt-4o-transcribe`, `gpt-4o-mini-tts`, `marin`, the OpenAI base. |
| `BOOKING_PROVIDER` | `src/server/booking/provider.ts` | Which booking seam is active. Only `none` exists; any other value is logged and treated as none. The probe advertises `booking: '<kind>'`. |

Nothing `NEXT_PUBLIC_` selects a provider. That variable existed in Stage 1 and could not do the
job — it is inlined at build time — and it is gone.

Three layers keep the key out of the browser: `import 'server-only'` in every `src/server`
module, an ESLint rule forbidding `@/server/*` from client directories, and
`scripts/dev/secret-scan.mjs`, which greps the built client chunks for the key's value on every
`npm run check`.

## Not built

- `showSetMembers` and campaign filtering, for want of data (above).
- The blind native-speaker gate: the voice has been tested with synthesised Pakistani speech on
  the review build, not with people from Lahore speaking naturally.
- Server-side persistence of anything. Memory is session-scoped by design; the selection alone
  persists, in `localStorage`, pruned against the catalogue at hydration.
