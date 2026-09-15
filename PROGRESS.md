# Progress — Waseem Jewellers Stage 1

| Milestone | Status | Verified |
|---|---|---|
| M0 Scaffold | done | 2026-09-07 — `npm i` clean (ESLint pinned to 9.x: eslint-config-next's React plugin is not yet ESLint-10 compatible), typecheck + lint pass, dev server on :3300 with zero runtime errors, canvas + pinned ScrollTrigger + Lenis verified headlessly |
| M1 Assets | done | 2026-09-07 — `npm run assets`: 48 images (19.3 MB) localised with blur placeholders, 5 clips encoded in 1280 / 720 / portrait variants with posters (31.2 MB; the 25 MB figure stays a target, not a blocker), watermark cropped from the menu ambient, asset map + `ASSET_MANIFEST.md` generated, 0 undocumented failures |
| M2 Data + routes | done | 2026-09-07 — 10 products, bridal collection (8 pieces, 4 chapters), 5 worlds, heritage set, menu, site facts; `/jewellery/[slug]` and `/collections/bridal` render with mask reveals, Nastaliq accent, PRICE ON REQUEST on 8 / `Rs.` on 2, 404 route; refresh on deep links and `?edit=` soft navigation verified |
| M3 Chrome + concierge shell | done | 2026-09-07 — nav (wordmark → monogram, SELECTION count, ASK, MENU/CLOSE above the menu), full-screen menu with ambient clip and hover media, cursor bead with side-aware labels, curtain + FLIP transitions (collection → product, product → product), back/forward arrival at the saved position with reveals landing composed, fixed footer reveal, selection ledger (persisted), consultation modal (success + reference), concierge jewel / unfolding panel / editorial transcript / composer / voice stage / result tray / compact ticket, all 11 states previewable via `?concierge=STATE`; commands verified end to end: search → tray, ordinal open → FLIP, ENQUIRE → specs reply, scripted "Let me show you" on desktop and mobile, microphone denied → on-brand message; menu ×6 and concierge ×6 open/close loops leave trigger and tween counts steady; zero console errors on every page |
| M4 Homepage chapters | done | 2026-09-07 — CH00 loading ritual (SVG stone filling with light, wordmark, hairline light, returning-visitor short path, 0.6 s lift on other routes), CH01 hero (pin, scrub, pointer drift, typographic invitation → jewel hand-off verified), CH02 craft stage (450 vh scrub, stone / setting / metal / finishing beats with editorial labels, closing line; WebGL object mounts here at M5), CH03 1952 (paper rising around the numeral, horizontal museum track with container-animation reveals, facade monochrome → colour), CH04 worlds (opposing-speed columns, names behind, hover drift, FLIP into the Bridal House, paper darkening through candlelight tones), CH05 bridal cinema (portrait window → cinema → words → ivory wipe), CH06 wall (twelve-column composition, batch reveals, column parallax, tilt + sheen), CH07 vitrine slider (depth layout, drag with inertia, wheel settle, keyboard), CH08 gold / diamond (pointer split, breath, weight morph, FLIP into the edits), CH09 bespoke tray (five cards, drawn outline → photograph), menu chapter jumps from other routes, mobile fallbacks for every chapter; zero console errors on desktop and mobile passes |
| M5 WebGL | done | 2026-09-07 — procedural studio (gold) and light-tent (stone) cube environments rendered once per renderer; emerald-cut stone geometry whose crown rings mirror the SVG drawing; CH02 craft object (refraction on HIGH/MEDIUM, physical fallback on LOW; closed bezel, four claws, gallery, shoulders, comfort band) driven by the chapter scrub with damped separation and reassembly for the close, pointer parallax, demand rendering, context-loss fallback with one remount, SVG stand-in withdrawing once the object renders; loading ritual gains the three-dimensional stone when its chunk arrives in time (400 ms production), fading in over the drawing and dollying into the crown at the hand-off; WebGL liquid-metal orb for the voice stage with per-state damped targets reading the voice meter; canvas counts return to baseline across concierge open/close cycles and route changes; renders inspected under a forced high tier on a software renderer and refined through three passes (framing, stone environment, setting) |
| M6 Concierge intelligence | done | 2026-09-07 — command matrix driven headlessly (`scripts/dev/concierge-matrix.mjs`) from `/`, `/collections/bridal` and product pages: greeting, collections overview (glide + worlds row), the house (glide to 1952 + house card), traditional / bridal / necklace searches (tray), ordinal open (FLIP into the piece), gold and diamond edits (`?edit=` on the collection, duality chapter on home), named pieces including hyphenated names ("the Naqsh-e-Gul choker" → spotlight on the collection with focus held for "open it"), save / remove with ordinals and deictics, similar pieces (tray + rail glide), private consultation (modal), showrooms (glide to the foot of any route), watches, out-of-scope, thanks, Roman-Urdu ("mujhe haar dikhao", "doosra kholo"); replies complete after FLIP navigations (stale result holds cleared on each turn); tray survives the associate's own glide; twenty open/close cycles leave triggers, tweens, ticker listeners and canvases unchanged; microphone-denied path yields the on-brand line; scripted example on desktop and mobile; language gate clean |
| M7 Responsive + tiers | done | 2026-09-07 — 390×844, 820×1180 and 1440×900 passes over every route; zero horizontal overflow on any route at 390px; touch replacements for every hover affordance; reduced motion rebuilt as composed stills (see the decisions below) — no pins, no scrubs, no playing video, and the chapters that are only traversable by scroll (1952 track, vitrine slider, bespoke tray) fall back to their stacked reading order through a pre-hydration `data-rm` stylesheet; LOW tier verified to load the 720p encodes; WebGL gated to HIGH/MEDIUM with a software-renderer override for inspection |
| M8 QA + docs | done | 2026-09-07 — `npm run build` green (home static, `/collections/bridal` and all ten product pages prerendered, API routes dynamic); typecheck and lint clean; an eight-dimension code audit with adversarial verification produced 17 confirmed defects, all fixed (below); ten concierge open/close cycles and repeated route changes leave triggers, tweens, ticker listeners and canvases at baseline; every focusable control has an accessible name and every route exactly one `h1`; console clean on `/`, `/collections/bridal`, a product page and 404, at desktop and mobile; docs rewritten to the implemented truth |

## M8 audit — defects found and fixed

The audit ran eight independent reviewers (motion contract, lifecycle/leaks, accessibility, copy safety, data integrity, hydration/SSR, state logic, responsive/tiers) and then tried to refute every finding against the code. Seventeen survived and were fixed:

| # | Defect | Fix |
|---|---|---|
| 1 | The route curtain had two writers on its Y: Tailwind v4's independent `translate` property and GSAP's `yPercent`. GSAP folded the class into a permanent one-viewport offset, so **every curtain navigation ended with the ink curtain parked over the whole page** — a black screen on arrival. | GSAP is now the only writer: the class is gone and the resting position is set in a layout effect. |
| 2 | `useSearchParams()` in the concierge's development state preview bailed the tree out of prerendering, so **`next build` failed** on `/_not-found`. | Read the query string from the store, which `RouteTracker` already publishes from inside a Suspense boundary. |
| 3 | `ready()` returned early on a target mismatch and nothing ever released the lock, freezing the page behind an inert curtain. | `ready()` takes a `force` flag; the four-second fallback uses it. |
| 4 | `navigate()`'s promise never settled when its timeline was superseded, hanging every awaited tool call. | The cover phase resolves on supersede as well as on completion. |
| 5 | A query-only navigation (the concierge's gold/diamond edits) never remounts a destination, so nothing called `ready()` — a four-second black curtain. | Same-route navigations arrive on the push. |
| 6 | Five `overwrite: true` tweens created in a loop killed each other, so only the fifth collection column ever drifted on hover. | One tween carrying all five keys. |
| 7 | The cursor label's Tailwind `translate` classes were zeroed by GSAP, losing its centring, its 14px gap and its edge flip. | GSAP owns the label's offset. |
| 8 | `startMeter()` had no cancellation guard across `getUserMedia`, so closing the concierge during the permission prompt left the microphone, an `AudioContext` and a ticker running. | A generation counter, bumped by `stopMeter()`. |
| 9 | `cancelSpeech()` never settled the in-flight `speak()`, so turning spoken replies off mid-sentence left the controller believing it was still speaking. | The pending completion is held at module scope and run on cancel. |
| 10 | No visitor-invokable pause for autoplaying film (WCAG 2.2.2). | A persistent "Pause motion" control in the nav, wired to the existing `videoPaused` flag. |
| 11 | The product gallery's inspect surface was a `<div>` with `onClick` — unreachable by keyboard. | A real button role with `tabIndex`, `aria-pressed`, an accessible name and Enter/Space. |
| 12 | Unlabelled films were announced with their build-manifest labels ("Menu ambient, DEWAN world"). | Unlabelled film is decorative; the films that carry meaning get house-register names. |
| 13 | The concierge asserted a "watch salon" the house has not published, and the word "watch" alone pre-empted every later command. | Reply rewritten to claim nothing; the pattern narrowed. |
| 14 | The LOW tier never actually loaded the 720p encodes — the source was swapped after the element had already selected a resource. | The media element is keyed on the chosen file. |
| 15 | The monogram declared 320×291 for a 208×172 file, so its box was the wrong shape until it loaded. | Correct intrinsic dimensions. |
| 16 | The selection button announced "1 pieces". | Singular form. |
| 17 | Reduced motion left three chapters unreachable (see M7). | Composed stills plus the `data-rm` fallback. |

Seven further findings were refuted on review and left alone.

## Decisions log
- Port 3300 for the dev server (3000 is used by another project on this machine).
- Display font: Bodoni Moda (variable, opsz). Cormorant Garamond documented as the alternative.
- Heritage copy restricted to facts published on waseemjewellers.com; Urdu accents only for Dewan and Naqsh-e-Gul (visible on the campaign title cards).
- Manifest crops are `[x, y, w, h]` fractions of the source (the monogram crop was corrected to the crown + WJW mark).
- Concierge results always step the panel aside (desktop: compact ticket beside the jewel; mobile: the jewel carries the last line as a fading caption) so the tray is never hidden behind the sheet.
- After a scripted example the microphone never auto-resumes; auto-resume only follows a real spoken turn.
- Spoken cadence for streamed replies applies only when the reply is actually voiced (spoken replies on and synthesis available); otherwise words arrive at reading pace.
- On back/forward and deep-link arrivals at a saved scroll position, once-only reveals already reached land in their composed state beneath the lifting veil instead of replaying.
- GSAP lag smoothing stays off for Lenis, which means a tween created during a main-thread stall (hydration, a chunk compiling) inherits a stale clock and jumps ahead on the next tick. The loading ritual is therefore built on the ticker tick after mount, after GSAP's own root update, with smoothing on until the hand-off; every other timeline starts after the ritual, when ticks are regular.
- The stone in the ritual renders over the SVG drawing rather than replacing it, so its transparency never reveals ink beneath.
- Manifest crops, `?tier=` and the dev-only `webgl` override let a software renderer (headless inspection) exercise the WebGL scenes; production detection still treats software renderers as LOW.
- A destination reports arrival once per flight: a second `ready()` (an image decoding after the fallback fired) no longer resets the arrival scroll beneath a glide already in progress. Pinned chapters that report ready in a layout effect, before their registration effect, are honoured at registration, so `sectionsReady()` resolves on every route.
- A new concierge turn clears the previous result's hold timer; the hold used to fire mid-turn and settle the state while the reply was still streaming.
- Reduced motion is decided by GSAP's own `reduce` media condition inside each chapter's `matchMedia`, not by the quality store alone. The store resolves after the first paint, and a `matchMedia` branch created before it resolved was not reverted — which left seven pins alive, the bridal words hidden and the collection columns clipped away. The media condition is evaluated at creation and GSAP reverts the other branch when it flips.
- Chapters that are only traversable by scroll (the 1952 track, the vitrine slider, the bespoke tray) cannot simply "hold still" under reduced motion — their content would be unreachable. They fall back to their stacked reading order through CSS keyed on the pre-hydration `data-rm` attribute, which needs no JavaScript and cannot mismatch on hydration.
- Measured after M8: 24 client chunks, 639 kB gzipped in total, of which the three.js chunk is 232 kB and loads only when a WebGL scene mounts. Media: 20 MB images, 32 MB video, all committed.

## Stage 2.2 — the client-facing pass (September 2026)

Stage 2 built the machine; this pass made the current build presentable to Waseem without
opening the backend. In order of client-facing priority:

1. **Live media.** `Img plain` hot-linked full Shopify originals through the long-tail
   `PieceLink`s and campaign refs; the optimiser now writes every `srcset` (`getImageProps`),
   remote refs are asked for at 2048px, a failed image hides instead of showing a broken glyph on a
   plate, the bridal-set campaign role is inferred for square originals, and `npm run
   warm:images` primes the optimiser after a deploy. `Video` checks a source is allowed before
   loading it.
2. **Terminology.** Every customer-facing "Salon" became a showroom or an appointment; every
   "Private consultation" became Book an appointment / Book a viewing / Visit a showroom /
   Request details / Enquire / Speak with our team, by context; "Private viewing" stays as the
   distinct action it is. The copy guard fails the build on any of the three banned phrases, and
   the concierge's register filter rewrites them if a model ever says one.
3. **Concierge UI.** A theme-following rail (560px at ≥1280, a modal sheet below) with a crest
   masthead, the piece in view on a plate, an exchange set in the display face with the facts
   beside each reply, a result tray of tiles with verified facts and View / Save / Compare, a real
   comparison table (unknown cells say so and offer "Ask"), the standing topic as removable terms,
   and suggestions as italic lines. No bubbles, no chips, no avatars.
4. **Voice.** A server tier through the existing seam: model transcription and speech behind
   `/api/concierge/transcribe` and `/api/concierge/speak`, chosen by the capabilities probe when
   a key is configured, falling back to the browser per utterance; barge-in, cancel, retry, live
   "Heard" line, timeouts; the voice stage is a hairline ring with the crest, breathing with the
   voice, and every state is also a sentence. `npm run voice:check` covers it headlessly.
5. **Homepage.** Five chapters evolved around five semantic figures on real pieces, each a door
   (see MOTION_SYSTEM.md, "Semantic figures"): the Close Look, the craft coda, the bridal suite,
   the wall's gold, Bespoke rebuilt around one pair. The hero and the film carry credits to the
   listed piece worn in them; the worlds name themselves and their piece at rest.
6. **The mark and the cursor.** The nav's surface, `--nav-offset`, the veil cleared on route
   change, mastheads that name the place; a bead / ring / word cursor from the theme tokens.

### Decisions
- The drawn ring in CH02 stays a drawing and is followed by the photograph — the object teaches
  the vocabulary, the coda proves it on a piece that opens.
- Fresh region rectangles are authored from the photograph and marked `reviewed: false`; Waseem
  confirms the naming (`AWAITING_REGION_SIGN_OFF`), and until then the notes say only what the
  frame and the published specification support.
- The camera's magnification is capped by the negative at the size the figure is actually
  rendered (`honestScale`), rather than by a fixed pixel threshold.
- "Salon" survives only as the register's internal token name (`[data-salon]`); it is never
  rendered.

## Known upstream notices
- `THREE.Clock: This module has been deprecated` is logged once by @react-three/fiber 9.7 with three 0.185; harmless, upstream.
- In development, the router's fetch on back/forward can take up to a second before the destination mounts; the arrival veil covers it (the wait is bounded at 1 s). Production builds are faster.

## Pending verification with the client
- Urdu spellings and meanings of the other collection names.
- Archival photography from the house (none exists online).
