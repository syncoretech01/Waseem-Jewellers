# Concierge Architecture — Waseem Jewellers (Stage 2)

Everything below describes the code as it stands at the end of Stage 2. Where the design changed
from Stage 1, the reason is given rather than the history; `git log` has the history.

## Principle

The concierge is a private jewellery associate, not a chatbot. It acts in the room — brings
pieces, opens a department, sets pieces side by side, prepares an appointment — and then says
one or two sentences. It answers in the language it was addressed in. It never invents a specification, a
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
| Realtime voice | `realtime-voice` | browser WebRTC → the model | The client-demo voice (`voice/realtime.ts`): one session that hears, understands and speaks; the call is opened before the tap; every function call passes `executeTool`. Falls to the transcription tier, then the browser's own hearing, each step recorded. |

**`FallbackProvider`** tries the model and, on any *recoverable* failure before the first word
has been shown — no key, rate limit, timeout, an upstream error — runs the same sentence through
the keyless engine under the same turn id. The visitor never learns it happened; the record
does: every fallback is announced on the turn's trace (`turn.trace`, see *The fallback record*)
with the code and message that caused it, and an upstream refusal pauses the model for ninety
seconds so the visitor is not charged a round trip per sentence for an answer that will not
change. A failure after words have been shown is not recoverable: re-answering would put two
different answers in front of the visitor.

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
  qa.ts                    qaMode() — ?qa=1 or window.__wjConciergeQA: the tester's view of what was heard; the turn trace (recordTrace, useQaTrace)
  replies.ts               every deterministic reply in six language columns; resolveReplyLanguage() — the persistence rule; subjectIn()
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
    realtime.ts            RealtimeVoiceAdapter — the call opened before the tap, the microphone attached in it
    realtimePrompt.ts      VOICE_INSTRUCTIONS, TURN_DETECTION, the realtime tool list, the site-context block
    speech.ts              planSpeech — never a wrong-language voice; silence and a written reply instead
    meter.ts, scripts.ts
  ui/
    ConciergeMount.tsx     eager: the orb, and the lazy salon behind it
    ConciergeRoot.tsx      lazy: the panel, the tray, the bridge listener
    ConciergePanel.tsx     the rail; ContextRibbon.tsx; Composer.tsx; Exchange.tsx; VoiceStage.tsx
    ResultTray.tsx         the vitrine
    ConciergeOrb.tsx       the door — store and bridge only, no controller; docks on a phone (src/styles/concierge.css)

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
   numbers clamped, the route matched to a real page.
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

### Language

Language mirroring is a hard rule on every engine: English is answered in English, Urdu in
Urdu, Roman Urdu in Roman Urdu, Punjabi in Punjabi, Roman Punjabi in Roman Punjabi, a mix in
the same mix — and never the other way. For the model it is a prompt rule (`server/concierge/
prompt.ts`, `voice/realtimePrompt.ts`), restated with the fact it needs: the language of the
visitor's last full sentence travels in `<visitor-language>` and in the realtime
`<site-context>`. For the keyless engine it is a table: **`replies.ts`** holds every
deterministic sentence in six columns — `en`, `ur-Latn`, `pa-Latn`, `ur`, `pa-Arab`,
`pa-Guru` — and `commands.ts`, `corePlan.ts`, the controller and the two UI surfaces read
their language's column. The English column reads `copy.ts`, so there is still one English
source of truth; the other five need a native speaker's reading before Stage 2 is accepted.

How the language is decided (`nlu/script.ts`, `nlu/parse.ts`): script first — Arabic is
Urdu, or Shahmukhi if a Punjabi marker is present; Gurmukhi is Punjabi. Latin script is told
apart by function words, not by the lexicon: `romanEvidence()` reads three closed sets of
Roman Urdu-only, Roman Punjabi-only and shared words ("mujhe", "ke", "mein" decide Urdu;
"menu", "de", "hor", "deo" decide Punjabi; "wala", "kholo", "wapas" prove only that the line is
not English). None of these is a concept, so the lexicon stays bounded. English is the
answer by absence of evidence.

**Persistence** (`resolveReplyLanguage`): a sentence with evidence of its own decides its
language and becomes the conversation's — including a full English sentence of three words
or more, which switches back. A short command with no evidence — "Second one.", "Gold.",
"Liberty." — has no language of its own and inherits the last full sentence's; a shared
Roman word inherits whether that was Urdu or Punjabi. The language is remembered once per
sentence, before any plan is made, so every reply the sentence produces reads one column.
"Begin again" drops the standing topic and keeps the language.

### Economy

For an action command — open, a department, back, the appointment — the reply is one word,
"Ji." / "Bilkul." / "Of course.", streamed as `text.ready` before the tools run so the voice
says it while the page moves; the action is the reply. A search answers in one sentence
("Ji, chaar gold rings saamne hain."). What the engine cannot read — no subject of its own and
a word it does not know, "Kal shaam ka time dekhna" — is answered with one short question in
the visitor's language, "Maaf kijiye, dobara kahenge?", never with a list of what the concierge
can do. The second unreadable sentence in a row is not the same question again: in writing,
"Doosre lafzon mein kahenge?"; on the voice stage, "Shayad likh kar bhej dijiye." with *Likh kar
bhejein* and *Dobara kahein* beneath the ring, and the microphone does not reopen by itself to
ask a third time. Sentence-final punctuation is cleared before the lexicon is matched — every
transcript the voice tier writes ends in a full stop, and "Gold." once matched nothing.

## Tools

Thirty-three in `toolDefs.ts`. Every argument that names a piece is declared `format:
'piece-slug'` and existence-checked against the listable set; `showCollection`'s slug is a
collection and is checked against its own enum instead. Numeric bounds clamp rather than refuse
(a model asking for forty pieces meant "several"); enum and pattern violations refuse (those name
things that do not exist). Undeclared arguments are dropped — the args a tool receives are
rebuilt from the schema, never passed through.

Browser tools act on the page: search, open, focus, a section, the appointment form, a
department, a collection, matching pieces, refine (with the honesty ladder for "something
lighter": published weight, else form, never an estimated gram), filters into the URL, clear
filters, price guidance (which carries a budget into the appointment form rather than
inventing a range), compare, navigate, and the operator tools below. `showGold`/`showDiamond`/
`showBridal` are deprecated aliases of `showDepartment`/`showCollection`; `openAppointment` is
`openPrivateConsultation` under the name a visitor uses (the voice session knows it as
`bookAppointment` too, and is offered that one door only).

**Saving is not offered on this build.** `saveToWishlist`, `removeFromWishlist`, `openWishlist`
and `openSaved` are gone with the public Selection ledger; the keyless engine's `save`,
`remove` and `selection` intents stay in the frozen lexicon and answer with what the concierge
can do instead ("Saving pieces is not offered here. I can set two side by side for you, or
prepare a viewing."), and both personas say the same. `comparePieces` takes explicit slugs and
never read a saved state.

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
| `navigate { target \| path }` | "take me to gold", "go back", "home", "the bridal collection", "where are your showrooms", "the appointment form" | A target resolves to the allowlisted path or to the tool that owns it: `locations` is the heritage chapter, `appointment` the form. `back` is the router's history step, which the transition layer answers with its reveal half; the result says where the visitor landed, or that there was nowhere to go. The path allowlist is unchanged. |
| `scrollToSection { section }` | "the craft", "the showrooms", "the kinds", "the gate" | A homepage chapter from any page: home first, then the glide — issued after arrival and after `lenis.resize()`, because the smooth scroller otherwise clamps the target to the previous page's height. `kinds` is the row of kinds inside the window chapter (`[data-kinds]`, else the chapter's `nav`); `gate` is the Gold / Diamond gate chapter. |
| `openMenu` / `closeMenu` / `closeConcierge` | "open the menu", "close", "bas" | The chrome. `closeConcierge` closes the panel 1.6 s later, after the goodbye. |
| `openAppointment` | "book an appointment", "open the appointment form" | The alias, above. |
| `setGalleryFrame { index }` | "the second photo", "doosri tasveer" | On a piece's page only. `Gallery.tsx` publishes `{ slug, count, index }` to the store and answers `galleryRequest` by bringing the frame into view (stacked frame on a wide screen, snap position on a phone). A frame past the count is refused with the count. |
| `activateGate { material }` | "the gold side", "diamond wala" | Sets `siteStore.gate` and glides to the gate chapter, home first if needed; the chapter reads the store. |
| `highlightCategory { category }` | "where are the bangles" | Sets `siteStore.highlightedCategory` and glides to the kinds. |
| `getCurrentContext` | — | Route kind, path, section, the piece in view and its frame count, whether the menu and the appointment form are open, and the appointment draft with what is still missing. |

**The appointment, and the confirmation rule.** Three tools, and the visitor watches all three:

- `fillAppointment { name?, phone?, email?, showroom?, occasion?, date?, window?, message?, productSlugs? }`
  writes into `siteStore.consultation.draft` and opens the form if it is closed. The form shows
  the draft in its own fields; a field the visitor has typed into since is theirs (per-field
  timestamps on both sides — the later hand wins). A showroom is resolved by id or by the name
  a visitor says ("Liberty", "Gulberg" is in the published address); a date must be `YYYY-MM-DD`
  and not past; a telephone number must pass the form's own rule; product slugs pass the
  validator like every other slug. While the form is open a bare answer is the field it
  answers — "Liberty" is the showroom, a name is the name. The result is the
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
curtain, `back`, a homepage chapter from a department page resting within 200 px, `openSaved`
refused as a tool that no longer exists, the form filled with the values visible in its inputs
(and the visitor's own typing kept), `submitAppointment` refused without confirmation and
`prepared` with it — with `/api/enquiry` never called — the gallery frame moving into view, and
the panel closing after a goodbye (39 assertions).

Not registered, deliberately: `showSetMembers` — `setId` is empty on every piece, so it could
only ever return nothing; and a campaign filter — 64 of 69 campaign pieces are withheld pending
names from Waseem, so it returned an empty tray for seven of nine campaigns.

## Memory

`ConversationMemory` in `conciergeStore`: standing slots (six turns / eight minutes), anchor
(four turns), discussed (twelve), language. A route change to a different piece replaces the
anchor and keeps the topic. `projectMemory()` sends a bounded projection to the model — never a
transcript — and `ContextRibbon` shows the standing topic as removable terms, so what the
concierge believes it is being asked about is visible and undoable.

## The fallback record

Nothing falls to a lower rung silently. Each engine emits `turn.trace` — the rung that
answered (`model`, `keyless`, `realtime`, `browser-voice`), why a rung below the one tried
answered instead (the failure's code and message, verbatim), the language read, the intent,
the plan and the tool. `FallbackProvider` announces every fallback and every paused turn; the
realtime adapter announces a token or handshake that failed and a response the provider
refused; the controller announces each step down the voice ladder. `qa.ts` keeps the last
forty (`recordTrace`, `useQaTrace`, `controller.qaTrace()` for the harnesses) and the voice
stage and the exchange print the latest line in QA mode only — `?qa=1` or
`window.__wjConciergeQA = true`; the URL flag is lost on a product navigation, the window
flag is not. Never a customer-facing string.

## Voice

Three tiers, chosen in one place (`voice/engine.ts`, `chooseVoiceEngine`) by the same
capabilities probe that picks the text model. Top down:

| Tier | Advertised as | What it is |
|---|---|---|
| **Native** — the client-demo voice | `voice: 'native'` when `OPENAI_API_KEY` is set and `CONCIERGE_REALTIME` is not `off` | One model that hears, understands and speaks: `gpt-realtime-2.1` over WebRTC (`voice/realtime.ts`). The server mints a two-minute client secret (`POST /api/concierge/realtime-token`) with the whole session decided there — model, voice (`OPENAI_REALTIME_VOICE`, default `marin`), server voice-activity detection (`TURN_DETECTION`: 450 ms of silence, threshold 0.5, 300 ms prefix, interruption on), near-field noise reduction, the input transcription model (`CONCIERGE_REALTIME_STT`, default `gpt-4o-transcribe` with a Roman-script vocabulary prompt), the browser tools, and the spoken persona (`voice/realtimePrompt.ts`). The browser opens the call **before the tap** — the moment the voice stage is shown, or a pointer reaches the microphone — with an audio transceiver and no microphone, so nothing is heard and no permission is asked; the tap attaches the microphone track (`replaceTrack`, ~100 ms) and the stage says "Listening". It keeps one conversation across turns and routes, refreshes a small `<site-context>` block through `session.update` as the page changes (piece in view with its published facts, the pieces just shown with ordinals and slugs, the standing request, the appointment form's state), and answers every function call through `executeTool` — the validator is the only gate on this path, and it is enough. |
| **Server** — the fallback | `voice: 'server'`, and implied by `native` | `ServerTranscriptionAdapter` records an utterance with `MediaRecorder`, ends it on the meter's silence and posts it to `POST /api/concierge/transcribe` (`CONCIERGE_STT_MODEL`, default `gpt-4o-transcribe` with the vocabulary prompt; the newer `gpt-transcribe` family takes keywords and `languages: en, ur` — Punjabi is not an accepted code and is heard through Urdu). The words enter the same grounded, validated, register-filtered text turn a typed sentence does; the reply is spoken by `POST /api/concierge/speak` (`gpt-4o-mini-tts`, the associate's register as instructions). |
| **Browser** — what ships with no credential | `voice: 'browser'` | `WebSpeechAdapter` and `speechSynthesis`. No browser offers `pa-PK`; Punjabi in Arabic script is heard as `ur-PK`, Roman Urdu as `en-IN`; three alternatives are scored; a run with no voice in its own language is written rather than spoken in another. |

**The ladder steps down one rung, never silently.** A realtime session that cannot open
(the token refused, WebRTC failing) falls to the server tier for that visitor; a server
transcription that fails falls to the browser's own hearing. The store records the rung
(`voice.fallback`) and the stage says so in the visitor's words — "Listening — if I mishear,
say it once more or write to me." — never "WebSpeech", "API" or "provider".

**The native session, event by event.** `speech_started` over a reply cancels it on both ends
(`response.cancel` + `output_audio_buffer.clear`, the stage says "Go on — I am listening.");
`speech_stopped` writes a placeholder line into the store and moves the state to THINKING;
the transcription lands on its own line by item id (two quick sentences keep their own words);
`response.created` opens a concierge turn; the reply's transcript streams as deltas;
`output_audio_buffer.started` / `stopped` drive SPEAKING, so the state follows the audio; a
function call runs through `executeTool` **the moment its arguments are complete**
(`response.function_call_arguments.done`), its output goes back as soon as the page has acted,
and the model is asked to continue once its own response has closed; `response.done` with no
call outstanding finishes the turn. No more than four actions answer one sentence. A typed
sentence goes into the same session; "Write instead" and the panel closing rest the microphone
— the track is stopped and the browser's indicator goes off — and keep the call for three
minutes, so the next tap re-attaches rather than reconnects. Four minutes of silence end a
used session. A transcript the model writes in Devanagari or Gurmukhi is romanised
(`src/lib/romanise.ts`); Urdu script and English are left as they are.

**The visitor never reads their own words.** No interim text, no "Heard", no transcript, no
edit-with-transcript: a wrong reading printed back is worse than one acted on and corrected in
a breath. The stage shows five states and nothing else — LISTENING · THINKING · BRINGING IT TO
YOU · SPEAKING · TRY AGAIN (a small label, one sentence in the display face, and "Try again"
beneath it when something did not work; "Write instead" and "Let me show you" always wait
below the ring). The words are still kept — in the store (`transcript`, the visitor turns with
`source: 'voice'`), in the session, in the adapter's trace — for the tools, the tests and the
QA view: `?qa=1` on the URL or `window.__wjConciergeQA = true` writes "heard — …" under the
stage and shows the spoken lines in the exchange.

**Why server VAD, and what was measured (21 September 2026, the deployment's key, this
machine's network).** With the short-command set — "Gold." "Show rings." "Second one." "Back."
"Diamond." "Show me something elegant for walima." "Open it." "Mujhe baraat ke liye kuch heavy
gold mein dikhao." "Book an appointment." "Liberty." — streamed over the WebSocket with exact
end timestamps (`.cache/s22/concierge/vad-probe.mjs`), semantic VAD at `auto` ended a turn a
median 1.0 s after the last word with a tail to 3.0 s ("Book an appointment." waited three
seconds; in the browser five), `high` a median 1.1 s with a tail to 1.9 s, while server VAD at
500 ms of silence ended every turn in 0.96 / 1.38 s (median / worst) and at 400 ms in
0.85 / 0.86 s. 450 ms is the setting shipped: every command detected, no tail, and a breath of
tolerance for a pause mid-sentence. In the browser (`scripts/dev/voice-latency.mjs`, the same
prompts through a fake microphone, timings from the client's own timeline; "speech end" is the
server's onset plus the prompt's length, ±150 ms): the deployed build before this pass detected
the end of speech a median 0.55 s after the last word with a worst of 3.8 s and lost one
command outright; the tuned build detected all ten at a median 0.51 s, worst 0.53 s. Turn
detected → tool call fell from a median 1.43 s to 0.99 s; speech end → first voice from
1.39 / 5.19 s to 1.14 / 1.35 s (median / worst). Tap → "Listening" was 6.0 s on the deployed
build (the secret, 1.0–2.3 s, and the WebRTC handshake, 3.7–4.4 s, were both paid on the tap);
with the call opened beforehand a standalone probe attached the microphone to the live call
98 ms after the tap (`.cache/s22/concierge/warm-probe.mjs`) — the integrated warm path could not
be re-timed the same day because the account's API credits ran out mid-pass
(`insufficient_quota`), and is the first thing to measure once they are topped up. The prompts
were synthesised speech, not a Lahore speaker — the blind native-speaker gate still stands.

`npm run voice:check` drives every state through a headless browser with the speech APIs
faked and the routes mocked: browser tier, server tier, the native tier refused and falling to
the server tier with the words kept and not shown, the QA view showing them, and the browser
rung asking again (31 assertions). `node scripts/dev/voice-latency.mjs` times the real thing
against the deployment (`--base`), or a local build against the deployment's session
(`--token-from <live> --tune`, the QA hook in `realtime.ts` pushing this build's turn
detection and tools over the channel).

The spoken persona (`VOICE_INSTRUCTIONS`) follows OpenAI's realtime prompting guide —
labelled sections, short bullets, sample phrases, capitals for the rules that must hold — and
carries the same "Operating the site" and appointment sections as the written one, with the
Roman Urdu the phrases are heard in. Its "Short commands" section makes one word an action:
"Gold." opens the department, "Second one." opens that piece, "Open it." opens the piece in
view or the first just shown, "Back." goes back, "Liberty." fills the showroom while the form
is open. A turn is a preamble of at most three words ("Of course." / "Ji.") said as the tool is
called, then one sentence of at most eight words; a single word or a name keeps the language
of the visitor's last full sentence; an empty result or a refused call is answered with the
next thing the visitor can do, never with the emptiness alone. The `<site-context>` block tells the session how many photographs the piece
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

**No dead end.** Every line that reports a failure is followed by the next thing to press, in
the display face: an empty tray by "Show nearby pieces" (the same request with its conditions
set aside — the kind alone, else the material — dispatched directly, `controller.nearby()`) and
"The bridal pieces"; a failed turn by "Try that once more" and "Let me show you"; the voice
stage's TRY AGAIN by "Try again", with "Write instead" and "Let me show you" always beneath the
ring; a microphone refused by MICROPHONE OFF and those two; a session that dropped by "The line
went quiet." and the same. A model is told the same rule in its instructions (an empty result
offers nearby or bridal pieces in the same sentence; a refused call is never repeated) and by
every tool's error message, which says what to do next rather than what went wrong.

**The floating crest** (`ConciergeOrb.tsx`, `src/styles/concierge.css`): a 48px target in the
bottom-right corner, clear of the device's home indicator (`--safe-bottom`); the disc inside it
is 40px on a phone and 56px from the tablet up. It is hidden while the full panel is open (the
rail covers it, the sheet would sit over it), while the menu, the appointment form or the hero's
invitation is up, and while a form field outside the salon has focus — the keyboard rises over
that corner. On a phone it docks — a 0.72-scale disc, quieter, the same target — over the
chapters whose bottom edge is spoken for: the window's row of kinds, the gold / diamond gate,
the footer, a piece's details, a department's grid (`useSiteStore().section`).

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
- Server-side persistence of anything. Memory is session-scoped by design, and nothing the
  concierge holds persists across a reload.
