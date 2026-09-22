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
| Live voice | `live-voice` | browser WebRTC → GPT-Live → this application | The premium voice (`voice/live.ts`): GPT-Live hears and speaks, full duplex, and holds no tools; every request it delegates comes to the browser, where one router (`voice/router.ts`) sends a plain command to the deterministic parser and a natural sentence to the delegation model (`/api/concierge/delegate`, GPT-6 Astra on the text path's grounding); the outcome goes back as a terse English fact and the voice says it in the visitor's language. No rung beneath it: a session that cannot open is said so once, in writing, and the written concierge answers. |

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
    executeTool.ts         every browser tool; validates at the top, because the voice's direct rung has no other gate
    appointment.ts         the draft read the way the form reads it: required fields, showroom by name, date, the read-back
  voice/
    engine.ts              chooseVoiceEngine — the Live session when the deployment offers it, the scripted example on request, nothing else
    adapters.ts            VoiceAdapter, VoiceSessionRuntime, ScriptedExampleAdapter ("Let me show you")
    live.ts                LiveVoiceAdapter — one WebRTC session per concierge open; transcript turns; delegations answered; SPEAKING from playback; the audit
    livePrompt.ts          LIVE_INSTRUCTIONS, LIVE_MODEL, LIVE_VOICE (the one-line voice constant), the audition list, the site-context block
    router.ts              routeSentence — direct (the parser, no model) or astra; runDirect — the plan's tools, then the fact
    astra.ts               runAstra — the delegation route's loop from the browser: frames, tools executed here, the fact
    facts.ts               factForOutcome / factForPlan — the terse English fact the voice model is told
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
  liveEnv.ts              liveEnv(): the credential, CONCIERGE_LIVE, the delegation model and its effort
  responses.ts            the Responses API request for the delegation model: the registry in its tool shape, priority tier with a fallback, the output read
  continuation.ts         the HMAC-signed continuation between rounds; pending calls bound by id + name + args hash
  untrusted.ts            sanitiseMemory, sanitiseToolResult, sanitiseContext — nothing from the browser is trusted for its shape
  serverTools.ts          compareProducts, explainSpecification, deepSearch, checkAvailability — executed where the catalogue is
  limits.ts               token buckets per scope (concierge 12/min · 60/hr; enquiry 3/min · 5/hr), best-effort on serverless

src/server/booking/
  provider.ts             BookingProvider, NullProvider, bookingProvider() — the seam; nothing books today

src/app/api/concierge/
  capabilities/route.ts   what this deployment is (intelligence, voice, enquiry, privacy, booking)
  turn/route.ts           the stateless agent loop of the typed concierge (chat completions, gpt-5.6-terra)
  delegate/route.ts       the same loop for the delegation model behind the voice (Responses API, gpt-6-astra, low effort, priority tier)
  live-session/route.ts   one Live session for a browser: the offer in, the answer out; the key never leaves
  tool/route.ts           reserved
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
prompt.ts`, `voice/livePrompt.ts`), restated with the fact it needs: the language of the
visitor's last full sentence travels in `<visitor-language>`, in the Live `<site-context>`,
and — the moment the router hears it change — in a `session.instructions.append`. For the keyless engine it is a table: **`replies.ts`** holds every
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
`openPrivateConsultation` under the name a visitor uses.

`toolDefs.ts` is the one registry. The keyless planner reads it, the turn route sends it to
the text model in the chat-completions shape, the delegate route sends it to the delegation
model in the Responses shape (`server/concierge/responses.ts`), and the voice's direct rung
executes its plans through `executeTool`. The voice model itself holds no tools; there is no
voice-only list to drift.

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
the panel closing after a goodbye (86 assertions, with the voice router table below).

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
answered (`model` or `keyless` on the typed path; `direct`, `astra` or `live` on the voice
path), why a rung below the one tried answered instead (the failure's code and message,
verbatim), the language read, the intent, the plan, the tool, and for the voice the
delegation id and the reason for the rung. `FallbackProvider` announces every fallback and
every paused turn; the Live adapter announces a session that would not open (the provider's
own code and message — a quota refusal is on the record verbatim), a line that dropped, and a
delegation model that failed. `qa.ts` keeps the last forty (`recordTrace`, `useQaTrace`,
`controller.qaTrace()` for the harnesses) and the voice stage and the exchange print the
latest line in QA mode only — `?qa=1` or `window.__wjConciergeQA = true`; the URL flag is
lost on a product navigation, the window flag is not. Never a customer-facing string.

## Voice

One path, and nothing beside it: microphone → WebRTC → GPT-Live (`gpt-live-1`) → client
delegation → this application's router → the one tool registry → a terse English fact back →
one to five spoken words in the visitor's language. There is no browser-speech rung, no
transcription rung, no server-speech rung, and no deterministic engine standing in front of
the voice; those were removed with S2K rather than left as a ladder.

**Why GPT-Live, and what it changes.** The Live model hears and speaks full duplex — it
listens while it talks, decides when to speak, and stops when the visitor interrupts; there is
no turn detection to tune and no `response.cancel` to send. It holds no tools: when the visitor
asks for something the page must do it *delegates* — `session.delegation.created` with an id
and no words — and the application answers with `session.commentary.append` (said aloud,
paraphrased) or `session.thinking.append` (a fact, held). The visitor's words arrive
separately, as `session.input_transcript.delta` fragments with `start_ms`/`end_ms` on the
session's clock and no end-of-turn marker; the assistant's as
`session.output_transcript.delta`. There is no end-of-response event, so SPEAKING is driven
by playback. Instructions, voice, model and delegation mode are immutable after creation;
`session.instructions.append` adds to them. The session is billed by the second
(`session.usage.updated`), 15 s at creation credited against the run.

**The session** (`/api/concierge/live-session`). The browser creates an `RTCPeerConnection`,
adds an audio transceiver (the microphone comes on the tap, by `replaceTrack`), creates the
`oai-events` data channel before the offer, gathers ICE for at most 2.5 s, and posts the
offer to our route. The route holds the key and decides everything: `model: gpt-live-1`,
`instructions: LIVE_INSTRUCTIONS`, `audio.output.voice: LIVE_VOICE`, `delegation: { type:
'client' }`, `store: false`, and an `input` seed — a developer message with the sanitised
site-context block (pieces named by slug are resolved against the repository, never trusted
by name), and on a reconnection the recent transcript. It returns the session id and the SDP
answer. No ephemeral secret exists and nothing is sent over the data channel to start the
session. Rate-limited 6 a minute, 40 an hour per address; a refusal carries the provider's
own code and message (`insufficient_quota` is recorded verbatim by the trace).

**One conversation.** One session per concierge open — opened the moment the voice stage is
shown or a pointer reaches the microphone, kept across turns and routes, rested (microphone
released, `session.input_audio.mute`) by "Write instead" or a tap while listening, closed
gracefully (`session.close` → `session.closed`, then the transports) when the panel closes,
by "Begin again", or after three minutes of silence. A dropped line (`session.closed` with
`connection_lost`, a failed peer connection) is re-established once, at most twice in two
minutes: the microphone stream is kept, the recent transcript is seeded as `input`, and the
voice is told to say so in a few words. If it cannot be re-established the stage says "The
line dropped — once more?" in the visitor's language with "Write instead" beneath the ring.

**The router** (`voice/router.ts`). Every sentence — spoken and delegated, or typed into the
same session — is read once, by `readSentence` (the language, remembered) and `planFor` (the
keyless planner: `corePlan` first, the ordered table after). Two rungs:

- *direct*: the plan is an action (a department, an ordinal, a named piece, back, compare,
  close, a collection), a fact the site holds (the price is on request, the showrooms, a
  greeting), an appointment detail or a plain appointment request of at most eight words, or
  a plain search — no word the lexicon does not carry, at most six words. The plan's tools run
  through `executeTool` at once, before any speech, and the fact comes from the outcome
  (`voice/facts.ts`: "Gold department is open." / "Opened piece 2 of 4: …" / "The appointment
  form is open; noted: showroom Liberty Market. Still needed: name, telephone. Ask for the
  first one only.").
- *astra*: everything else — a sentence with qualifiers the lexicon does not carry
  ("elegant", "classy", "not too heavy"), a search of more than six words, a sentence the
  parser cannot read at all — goes to `/api/concierge/delegate`: the turn route's loop
  (`ground()`, `buildMessages()`, `untrusted.ts`, `validateToolCall`, server tools on the
  server, browser tools sent down as frames and executed here, the signed continuation between
  rounds) with a reasoning model over the Responses API — `gpt-6-astra`, `reasoning.effort:
  low`, `service_tier: priority` with a fallback to the default tier on refusal, `store:
  false`, the last eight spoken lines as history, and a voice preface telling the model its
  text is not spoken: it returns one English line of facts and status.

The lexicon is frozen; the router grew no vocabulary. Two English function verbs, "take" and
"go", joined the stop-word list in `replies.ts` so "Take me to Bridal" reads as the department
it names rather than as a search with an unknown word.

**When the words are read.** The transcript is accumulated per turn. At a delegation the
fragments are given up to 400 ms to settle (the transcript lags the decision), then read; at
a pause of 800 ms with no delegation they are read anyway, so a plain command acts the moment
the parser can read it and the delegation that follows is attached to the same turn and
answered with the same fact. A sentence the parser cannot read at all is held for 2.6 s for
a delegation — GPT-Live decides whether small talk needs the page — and let go if none comes.
A delegation with no transcript is answered "No words were transcribed; ask once more."

**The fact back.** `RESULT_CHANNEL` in `live.ts` chooses the append: `commentary` (the
default: the documentation says commentary is said aloud and paraphrased) or `thinking`. The
content opens with "Backend result (English facts; say it in the visitor's language,
briefly):" and the instructions carry the length rule (one to five words after an action, one
short sentence after a search). After the fact the site-context block is pushed again as
`session.thinking.append` with a null delegation id (also on every page change, debounced
700 ms, only when it changed), so "the second one" resolves against what is in view.

**Language.** The instructions carry the mirroring rule, the one-word-follow-up rule and the
tool-result-never-changes-the-language rule; the router remembers the language once per
sentence (`resolveReplyLanguage`) and, when it changes, sends one
`session.instructions.append` naming it. English at the start is not announced.

**Typed text in the voice session.** `sendText` routes the sentence exactly as a spoken one,
tells the voice it was typed (`thinking.append`), and hands the outcome back as commentary
with a null delegation id. "Write instead" rests the microphone and keeps the session.

**States.** LISTENING — the session is live and the microphone attached (`onStart`);
THINKING — a turn is being routed (`voice.thinking`); BRINGING IT TO YOU — a tool is running
(`tool.call`); SPEAKING — the remote track carries voice, measured by an analyser on the
stream (louder than 0.018 RMS; quiet for 650 ms ends it), with the output transcript as the
signal only when no analyser could be made; TRY AGAIN — a failure, with "Write instead" and
"Try again" beneath the ring. A turn closes when the voice falls silent after the fact, or
four seconds after the fact if it never spoke. No transcript is shown; `?qa=1` prints "heard
—" and the trace line: rung, intent, plan, tool, language, delegation id, the reason for the
rung.

**Failure.** The session cannot be opened (the route refused, the account, the handshake,
the channel): the stage writes "Voice is unavailable just now. You can continue by writing."
in the visitor's language, once, the written concierge is presented, and the tap does not ask
the route again until "Try again". Nothing speaks in its place. A refused microphone is a
different message, as before.

**The audio pipeline.** Exactly one `getUserMedia` stream (echo cancellation, noise
suppression, automatic gain), one peer connection, one session; tracks stopped and the stream
released on rest and on close; the stream kept only across a reconnection. `SpeechRecognition`
and `speechSynthesis` are not referenced anywhere in `src/concierge`. `window.__wjVoiceAudit()`
(development, or the QA flag) reports streams asked for, live tracks, peer connections open,
sessions; `npm run voice:check` counts them across open → talk → close five times.

**Measured.** `npm run voice:check` (56 assertions) drives the whole path in a headless
browser with the transport faked — a scripted data channel, a tone on the remote track — and
the routes mocked: the session refused (said once, the written concierge, the reason on the
trace), a direct command acting before any speech, a natural sentence through the delegation
route with its tool executed here, the language instruction sent once, a typed sentence into
the session, SPEAKING from the track, the words kept and never shown, the QA view, five
conversations with nothing left open, a dropped line re-established with the transcript
seeded, and the browser's speech APIs never touched. `npm run operator:check` (86 assertions)
adds the router's reading of every sentence of the demo — which rung, which plan — with the
pieces brought and the form opened as the sentences need.

What could not be measured before the deploy: the real session. The key exists only on the
deployment, and the previous deployment (ae84093) has no session route. `node
scripts/dev/voice-latency.mjs --base <deployed> --prompts <set>` (or `--base
http://localhost:3300 --session-from <deployed>` for a local build) plays a prompt set into a
fake microphone as one continuous session and reports, per prompt: what was heard, the rung,
the intent, the tool, the language, the delegation id, the visible action, the reply, and
speech end (the last transcript fragment's end on the session's clock, placed on this
machine's clock from the session's creation, ±200 ms) → delegation → visible action → first
voice audio → done. The prompt sets are made by `.cache/s22/concierge/s24/make-prompts.mjs`:
`cmd` (the ten short commands), `natural` (the natural Pakistani set), `owner` (the
owner-demo script with an interruption); each prompt carries expectations the run checks.
`.cache/s22/concierge/s24/audition.mjs` records the same four sentences in each candidate
voice for a human ear. None of this is human acceptance: the speaker is synthesised, and the
final acceptance for the voice is a person speaking into a real microphone on the live
deployment — HUMAN VOICE ACCEPTANCE NOT VERIFIED.

**The voice.** `LIVE_VOICE` in `voice/livePrompt.ts` is one line and says `marin`,
provisionally: no one has yet heard the candidates say Urdu or Punjabi. The audition list is
the voices the documentation presents as feminine (quartz, willow, gleam, bossa, delta) and
the four older female voices (marin, coral, shimmer, sage); the choice is a person's.

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
| `OPENAI_API_KEY` | `src/server/env.ts`, `src/server/concierge/liveEnv.ts` | One credential, everything on: the text model (when `CONCIERGE_API_KEY` is absent and the base is OpenAI's), the Live session and the delegation model; the probe advertises `intelligence: 'model'`, `voice: 'native'`. |
| `CONCIERGE_LIVE` | `src/server/concierge/liveEnv.ts` | `off` keeps the voice dark on a deployment that has the key: the probe advertises `voice: 'none'`, the stage is not offered, the typed concierge is unchanged. |
| `CONCIERGE_DELEGATE_MODEL`, `CONCIERGE_DELEGATE_EFFORT` | `src/server/concierge/liveEnv.ts` | The model behind the voice and its reasoning effort; defaults `gpt-6-astra`, `low` (`medium` or `high` accepted). The voice itself is a constant, `LIVE_VOICE` in `src/concierge/voice/livePrompt.ts`, and the Live model is `LIVE_MODEL` beside it. |
| `BOOKING_PROVIDER` | `src/server/booking/provider.ts` | Which booking seam is active. Only `none` exists; any other value is logged and treated as none. The probe advertises `booking: '<kind>'`. |

Nothing `NEXT_PUBLIC_` selects a provider. That variable existed in Stage 1 and could not do the
job — it is inlined at build time — and it is gone.

Three layers keep the key out of the browser: `import 'server-only'` in every `src/server`
module, an ESLint rule forbidding `@/server/*` from client directories, and
`scripts/dev/secret-scan.mjs`, which greps the built client chunks for the key's value on every
`npm run check`.

## Not built

- `showSetMembers` and campaign filtering, for want of data (above).
- The blind native-speaker gate: the voice has been exercised with a faked transport and, once
  deployed, with synthesised Pakistani speech — not with people from Lahore speaking naturally
  into a real microphone. HUMAN VOICE ACCEPTANCE NOT VERIFIED.
- The voice choice: marin is provisional; the audition files are for a person to hear.
- Server-side persistence of anything. Memory is session-scoped by design, and nothing the
  concierge holds persists across a reload.
