# Stage 2.2 — the client-facing pass

Written 15 September 2026 after watching the review recording (66 s, silent), inspecting the
deployed Stage 2 build at 1440×900 and 390×844 (homepage scroll, five departments, three PDP
modes, ten concierge states, voice states), capturing the Stage 1 deployment for comparison,
and reading the source behind every surface named below. Base: `stage-2` at `04126ee`.

The complaint is correct. Side by side, the Stage 2 homepage is the Stage 1 skeleton with more
photographs in it: the same hero, the same rendered stone, the same 1952 lead-in, the same
dark concierge drawer. What follows is what changes, what powers it, and what stays.

## What the recording and the live inspection showed

| Where | What the client saw | Cause (verified in source) |
|---|---|---|
| Slider ("The Collection"), wall, worlds | Black or empty frames for seconds; "Polki Raani Haar" with no photograph | `PieceLink` renders every long-tail piece as a raw `<img>` of the **original Shopify file** (1.8–4 MB each) — `Img.tsx` `plain` path hot-links `ref.src`; the optimiser is bypassed and there is no placeholder. Where the optimiser *is* used, packshots request `w=2560` on a 400 px tile. Each cache-miss transform costs ~2 s. |
| Craft chapter | A flat gold line-drawing of a stone, not the ring | The R3F ring renders only on `tier === 'HIGH'`; every Intel/UHD/Iris laptop resolves `MEDIUM`, so most visitors get the SVG fallback. |
| Bespoke | An abstract octagon diagram | `Ch09Bespoke` opens on a `LoaderStone outlineOnly` drawing and masks a halo ring into a step-cut outline (`GEM_MASK`). |
| Heritage | Caption colliding with the display line; huge crest watermark | Vertical caption of panel 4 overlaps the panel's headline at 1440; 38 vw crest at 6 %. |
| Nav | Crest with "THE COLLECTION" beneath it | The nav prints the current chapter label under the mark when it reappears. |
| Concierge | Dark drawer, tiny labels, giant gold sphere in voice mode; on phones the jewellery tray is hidden behind the sheet | `data-theme="dark"` hard-set on rail/tray; `.micro` on everything; `VoiceStage` orb 132–148 px inside a 214–240 px ring; below 1280 px the tray (z 69) sits under the sheet (z 70). |
| Copy | "salons", "Private consultation" | 2 "salon" strings, 14 "Private consultation" strings, plus the persona/tool descriptions that teach the model the phrase. |

## Priority order (as briefed)

**P0** — 1 live media · 2 terminology · 3 Concierge UI · 4 voice
**P1** — 5 homepage evolution · 6 semantic motion · 7 product-first presentation · 8 cursor
**P2** — 9 micro-interactions · 10 department/PDP polish · 11 responsive/browser · 12 verification + deploy

## 1 · Live media (P0)

- `Img` `plain` for remote refs goes through the optimiser with a real `srcset` (`getImageProps`), never the original file; remote sources carry `?width=2048` so Vercel transforms a 2048 px upstream instead of a 4500 px one.
- Correct `sizes` on every remote card (department grid, wall, slider, worlds, concierge tray) so tiles request 640–1080, not 2560.
- A ground under every frame while it loads: pearl for packshots, ink/ivory for campaign frames; no black boxes.
- Seven listable bridal sets carry 4000 px on-body portraits filed as `packshot` and are mounted on pearl plates with 18 % margins — re-role them `campaign` in the catalogue build.
- `scripts/dev/warm-images.mjs`: after each deploy, request every listed hero at the three widths so the client's first visit hits the edge cache.
- `Video` gets an `onError`/stalled path that keeps the poster; the hero passes the still beneath.
- Verified against the deployed URL with the network audit, not localhost.

## 2 · Terminology (P0)

Every customer-facing "salon"/"Private consultation" is rewritten for its context (the full list, with line numbers, is in the copy sweep commit):
- Footer CTA → **Book an appointment**; bridal chapter CTA → **Book a bridal appointment**; department closing → **VISIT US IN LAHORE / Book a viewing**; bridal collection closing → **Book a bridal appointment**; form eyebrow/dialog name → **Book an appointment**, submit → **Request an appointment**, WhatsApp text → "Appointment request WJ-…", success → "Your appointment details are ready." / "Our team will be in touch to confirm your appointment."
- Wall → "Chosen at MM Alam Road." / "From the showroom · MM Alam Road".
- Concierge chip and scripted lines → **Book an appointment** (the only phrasing that parses in the keyless engine without touching the lexicon); tool ticket → "Opening the appointment form…" / "Appointment form"; result line → "The appointment form is open beside you."; clarify → "to book an appointment"; persona and tool descriptions → appointment/viewing vocabulary; register filter strips `private consultation` → `appointment` and `salon` → `showroom` on model output.
- Product page keeps **Book a viewing** as the one distinct action; accordion → **Visit a showroom**; ledger → "Book a viewing of these pieces".
- `copy-guard` bans `salon(s)` and `private consultation` in rendered sources (identifiers such as `data-salon` are excluded by lookarounds). "House of Waseem" stays banned; it is never reintroduced.
- Subtitle "Private jewellery assistance" is retired; the concierge is "Waseem Concierge".

## 3 · Concierge UI (P0) — a redesign, not a restyle

- **Register follows the page.** The rail, tray and ticket drop the hard-coded dark theme: ink on dark chapters, pearl/ivory with ink type on ivory chapters and department pages. The "dark chat drawer" disappears.
- **Desktop geometry.** Rail 560 px (token-derived everywhere), full height from under the nav; voice stage lives *beside* the rail in the space the scrim occupied, so the exchange keeps its height.
- **Context.** The piece in view becomes a hero plate (full-rail 5:4 image, name 22 px, price, Book a viewing / Save) — not a 72 px thumbnail on a dark well.
- **Conversation.** Type scale lifted (visitor 15 px sans, concierge 20 px display, `lang` set from the conversation language so Urdu gets its Nastaliq face); `.micro` reserved for verbs. Suggestions stay as italic lines and become route-aware.
- **Discovery.** Results render as a *tray brought to you*: large tiles (240–320 px), packshots on pearl, name, one or two verified facts (purity · weight), a "why" line from the request ("Gold · under 15 g"), and View / Save / Compare on hover. On phones and tablets the tray renders inside the sheet above the composer (fixes the hidden-tray defect). A real comparison table for 2–3 pieces (purity, weight, stones, price, "—" with an Ask affordance when unpublished) and a "Kept" surface with thumbnails.
- **Chrome.** One hairline; Close and Write as words; no bubbles, avatars, timestamps or badges (the salon rules hold); compact "steps aside" form becomes the orb caption on every device.
- **Voice stage.** The gold sphere goes. A thin champagne ring (120 px) whose stroke breathes with the meter, the live transcript set large in italic serif beneath it, and unmistakable state words for every state in the brief (Idle, Ready, Permission, Listening, Heard, Thinking, Acting, Speaking, Result, Interrupted, Error, Denied). "Tap to interrupt" while speaking.

## 4 · Voice (P0)

Browser speech stays the fallback tier. Model-backed voice ships through the existing seam:
- **Hearing:** `ServerTranscriptionAdapter` (`kind: 'server'`) — mic → `MediaRecorder` → `POST /api/concierge/transcribe` → OpenAI `POST /v1/audio/transcriptions` (`gpt-4o-transcribe`, jewellery/Urdu prompt, `language` from the conversation when known) → the *existing* grounded, validated, register-filtered turn. Punjabi, Roman Urdu and code-switching are transcribed by the model, not by `en-IN` WebSpeech. End of utterance by the meter (silence 900 ms) or the button.
- **Speaking:** a speaking seam (`SpeechEngine`) with `POST /api/concierge/speak` → `gpt-4o-mini-tts` (`marin`, register instructions), streamed and played through an analyser that drives the orb envelope; browser synthesis remains the fallback.
- **Behaviour fixes (traced defects):** the whole reply is spoken on the model path (only the first sentence is today); SPEAKING follows the audio, not the text stream; the hands-free loop re-opens the mic after a spoken reply; recognition language follows the conversation on the model path; a network/unsupported error never silently runs the scripted example; voices readiness handled; barge-in via the meter while the server voice plays; "Write" mid-sentence discards rather than submits.
- Gated by `OPENAI_API_KEY` (already reserved) → capabilities `voice: 'server'`. Without the key the browser tier runs — with the same redesigned UI. The realtime WebRTC engine remains the documented future target; it is not built in this pass.
- Verified headlessly with a fake recognition/synthesis harness (`scripts/dev/voice-check.mjs`) and manually with the natural-language prompt set.

## 5 · Homepage — chapters that change materially

| Chapter | Change |
|---|---|
| CH01 Hero | The film's tail becomes a piece credit ("Worn here — Polki Raani Haar · View") so the first product door is under one viewport. |
| CH02 Vitrine → **The Close Look** | Three thumbnails become one hero semantic figure — the Pearl Blossom Choker, earring → choker, full fidelity — with two doors beside it. First contact with a real piece at ~1.3 viewports. |
| CH02 Craft | The ring stays (it is the interaction the client values) and now renders on MEDIUM as well as HIGH. Its coda is new: the rendered object dissolves into the **Lavender Halo Ring** photograph with the same labels lit in place — stone, prongs, halo, shank — so the chapter ends on a Waseem piece. |
| CH03 Heritage | Refined, not rebuilt: caption/headline collision fixed, watermark reduced, panel 4 (a repeat of the hero film) dropped. |
| CH04 Worlds | Names, moods and counts shown at rest; each world column carries a real piece with a door; the grid loads through the optimiser. |
| CH05 Bridal | The film now settles onto a piece: the **Rang-e-Jamal Emerald Suite** composition figure (choker motif → seven strands → pendant) with a door beneath; CTA renamed. |
| CH06 Wall | Recomposed product-first: tighter template, a 6-column hero tile, packshots on pearl; the scene tile becomes a goldwork figure on **Rang-E-Jamal** (gold-bridal-set-2, 252.84 g). Copy fixed. |
| CH07 Slider | Kept; pin shortened; remote heroes load with a ground. |
| CH08 Duality | Kept; the diamond FLIP image made visible; COMPARE cursor while the split is uncommitted. |
| CH09 Bespoke → **Made for one person** | The diagram tray goes. One honest piece — the **Emerald Tassel Earrings** as a pair figure (pair → drop → tassel → pair) — with the words retimed and the bespoke door. |

Structural, not cosmetic: five chapters change their composition, three new figures enter, ~600 vh of pin leaves, and the same photograph no longer appears three times.

## 6 · Semantic jewellery motion — five new figures on real pieces

| # | Family (new) | Piece · frame | Beats |
|---|---|---|---|
| 1 | **Setting anatomy** | Lavender Halo Ring · p09-hero (2000 px) | stone → prongs → halo → shank (21K hallmark) |
| 2 | **Composition** | Rang-e-Jamal Emerald Suite · p06-hero (2880 px) | choker motif → seven strands → pendant fall |
| 3 | **Goldwork surface** (homepage placement) | Rang-E-Jamal gold set · w-rang-3 (2250 px) | textured collar → pearl edge → bangle stack |
| 4 | **Pair** | Emerald Tassel Earrings · p08-hero (2000 px) | left → its counterpart → drop → tassel |
| 5 | **Craft detail** (homepage placement) | Pearl Blossom Choker · p03-hero (2880 px) | earring → choker |
| + | **Two-angle turn** (PDP) | Lavender Halo Ring · p09-hero / p09-second | three-quarter ↔ top view — the only piece with two real photographs |

All are regions of one finished photograph, captioned as anatomy/composition/detail — never assembly. No set membership is invented (none exists in the data). The resolver's fidelity test changes from an absolute 1100 px ceiling to *region source pixels ≥ displayed pixels*, which is what makes full fidelity honest on the 2000–2880 px frames.

## 7 · Cursor

Typed states sourced from copy — VIEW · EXPLORE · OPEN · ASK · LISTEN · SAVE (Kept) · CLOSE · DRAG (held) · COMPARE — one verb per action across the site. The 7 px bead stays; state is expressed with a hairline beside it, never a ring or a label always on. Theme-aware (champagne on ink, gold-deep on ivory, no shadow halo). Held state on both drag surfaces; LISTEN on every mic; hybrid-device and re-entry fixes. Fine pointers only; off under reduced motion.

## 8 · Logo behaviour

Rules applied everywhere: the nav carries the crest monogram only — never with a chapter label beneath it; the label moves out of the mark's column. The wordmark appears in the hero and the footer; the lockup once, at the heritage seal. The heritage watermark is reduced and never overlaps a photograph. On department and product pages the crest stays small and still; over scrolling grids nothing floats but the crest.

## 9–11 · Micro-interactions, department/PDP polish, responsive

One hover figure (`hairline-draw`, `draw-closer` at 1.03/700 ms) replaces the hand-copied variants; no magnetism, no springs. Department and PDP get spacing, card, cursor, loading and Concierge-integration refinements only — their architecture is untouched. Mobile: the craft chapter's overlapping lines fixed; the concierge sheet composed; 390 px overflow re-verified.

## What stays untouched

Catalogue architecture and repository · product model and generated data shape · department and PDP layouts and modes · the tool validation boundary · enquiry readiness and rate limits · Selection v2 · the NLU lexicon (frozen — new chip phrases are chosen from what already parses) · the performance instrumentation and leak gates · the authentic mark itself.

## Verification before deploy

`npm run check` (typecheck, lint, copy guard with the new bans, NLU, enquiry, build, secret scan) · `leak:check` and `bundle:report` against a production build · the natural-language prompt set through both text and the voice harness · deployed-URL media audit · 1440×900 and 390×844 captures of every surface in the brief, beside the Stage 1 and Stage 2 captures already taken.

## Blockers stated up front

- **Production model intelligence and model-backed voice need `CONCIERGE_API_KEY` / `OPENAI_API_KEY` on the Vercel project.** Neither exists here. The voice path is built, harness-tested and gated; it cannot be exercised end-to-end against OpenAI on this machine. That blocks a live-voice demonstration, not the visual design.
- The blind native-speaker language set remains the acceptance gate for multilingual understanding.
