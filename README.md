# Waseem Jewellers — Digital Flagship, Stage 1

Stage 1 is a high-fidelity flagship experience that runs on a laptop with no credentials and no backend: the complete cinematic homepage, Bridal collection route, a reusable product route, full-screen navigation, and the Waseem Concierge in writing and by voice. Ten pieces are curated in `src/data/products.ts`, and every image and film is real Waseem material, localised into `public/assets/waseem` and committed. Nothing is fetched from a third party at runtime.

## Requirements

- Node.js 22 or newer, and npm. (Developed on Node 24.)
- A browser on the Tailwind 4 baseline — Chrome or Edge 111+, Safari 16.4+, Firefox 128+.
- ffmpeg, only if you regenerate the media with `npm run assets`. It is not needed to run the site.

## Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3300>. Port 3300 is set in the `dev` and `start` scripts.

## What to try

Follow this in order the first time; it is the intended path through the work.

**The loading ritual.** A hairline of light, the wordmark, SINCE 1952, and the house stone filling with light, then the hand-off into the hero. On a high tier with WebGL the three-dimensional stone joins the drawing if its chunk arrives in time; otherwise the SVG stone carries the whole ritual. A returning visitor within 24 hours gets the short path (the flag is `wj:visited` in `localStorage` — clear it to see the full ritual again). Every other route gets a 0.6 s lift instead.

**The homepage**, fourteen chapters in one continuous scroll, in the order a shop is walked — six of them signature jewellery experiences, each with a beginning, one piece as protagonist, a progression, a closing state and a door:

| Chapter | What to do |
|---|---|
| Hero | Let the film run; LAHORE · SINCE 1952, the shop's name, one line, and the five departments as the first doors — nothing else competes with the jewellery. The header carries the authentic mark alone — the crest over the WJW ligature, no written name — at 44 px (36 on a phone), settling to 32 / 28 px once the page has moved; the motion control is a quiet glyph. The concierge is the crest at the bottom right. |
| By kind | Nine editorial tiles in an asymmetric twelve-column composition, one per kind — rings, necklaces, earrings, bangles, bridal sets, pendants, bracelets, chains, cufflinks — each on a real packshot (the bridal tile on a jewellery-only crop of the Dewan suite). A second piece of the kind surfaces under the hand; the tile opens the kind, the piece named beneath opens the piece. Fed by `repository.showcase()` — only white-ground packshots with published facts front a kind. |
| Craft · **1** | Keep scrolling: an emerald-cut stone condenses out of the dark, then stone, setting, metal and hand finishing separate beneath fixed labels, closing on CRAFTED / TO ENDURE. The object is a study — labelled as one beside the eyebrow: an emerald cut and set in gold to show how a ring is made, not a listed piece. On a desktop the object is live; on every phone, and without WebGL, the same progression plays as twenty-three frames rendered from the same scene and crossfaded by the scroll, the labels on the same beats; under reduced motion a composed still of the same object stands. |
| The Bangle · **2** | Its own pinned chapter: one set of 21K bangles (K13798), turned in the hand from the two angles the shop photographed — the set on its side, the surface close, the rhythm of the motif along the face, the turn to the raised angle and the inside, the complete set. One stage word at a time; the set is the door. |
| The gate · **3** | Two material worlds in one frame: the satlada haar on velvet beneath, the sapphire suite closer still above, behind a mask whose edge follows the pointer and breathes at rest. GOLD and DIAMOND weigh with their side; choosing one fills the frame and carries you into the department. The disc on the divider is the visitor's own control of the split — drag it on any pointer, or move it with the arrow keys; on a phone only the disc takes touch, and the page beneath scrolls as it always does. |
| Gold | The department as a department: the kinds, a tray of its pieces on the card system, the door; it closes on the goldwork figure. |
| Goldwork · **4** | From the work to the piece: the camera opens on the pattern of one collar panel of the Satlada Haar filling the frame, travels down the haar to its relief and the medallion's edge, and pulls back until the whole piece is in view. On the whole piece four places become live — rest on one and the camera drifts closer. |
| Diamond | The other tray, on ink. |
| One suite, one light · **5** | Its own pinned chapter: the room goes dark and a single light finds the chandelier earring, the necklace and the pendant of the Sapphire Pendant Suite in turn, then the whole suite is lit again. |
| Bridal | The suite arrives from behind velvet — two dark textile fields part from the centre and a light crosses it — then is named in place (tikka, earrings, choker, haar); the choker figure beside it, the film as an inset, and the appointment. |
| Signature Collections | Five columns at opposing speeds, the jewellery frame above the portrait. Hover or tab into a column to raise its name; choose one and its portrait flies into the collection page. |
| Men · Kids | The two departments with their pieces, kinds and doors. |
| 1952 | Since 1952, Lahore, three showrooms — Liberty Market, MM Alam Road, DHA — with addresses, map links, hours and the telephone, the facade arriving in colour, an appointment; it ends after its useful content. |
| Bespoke · **6** | One pair of earrings read at the joints: the photograph is cut into crown, bell and tassel, drawn apart by nearly a tenth of the frame, held while each is named — one stage word at a time, in one node — and closed again into the pair. Personal craft · Precision · One-to-one design · Finish, said once; the bespoke door is open from the first frame. |
| Footer | The lockup, the invitation, Explore, Visit (Liberty Market, MM Alam Road, DHA), Contact, the socials and the legal line — revealed from beneath the page on a wide screen; on a phone a compact footer in the flow of the page. |

**The menu.** MENU at the top right. Six entries with hover media: Gold and Diamond open Bridal edits, Bridal the house itself, Collections and Heritage jump to homepage chapters, Bespoke opens the consultation. Escape closes it.

**Bridal** — `/collections/bridal`. The opening film, the intro, then a sticky line: Story runs the four chapters (I–IV), Index lays the pieces out, and Gold / Diamond / Polki filter the index. `?edit=gold` and `?edit=diamond` open the named edit directly. The page closes with a consultation and a "Worn together" rail.

**A piece** — for example `/jewellery/lavender-halo-ring-r11912`. Hovering a gallery image draws it to the eye; clicking a macro enters drag-to-inspect at 2.4×, Escape leaves it. In the column that sticks on desktop: Enquire hands the piece to the concierge, Book a viewing opens the consultation with the piece attached. On a phone a piece with one photograph opens on one frame and a piece with more on a swipe track with a live indicator; either way the name, the price line and the two buttons follow the photograph at once. A piece from the worn-together rail transitions straight into the next product.

**The concierge in writing.** ASK in the nav on desktop, the invitation in the hero, or the crest at the bottom right. These all work:

| Say | What happens |
|---|---|
| `Show me bridal necklaces` | Four pieces arrive in the result tray. |
| `Open the second one` | The second result opens, its image flying into the product page. |
| `Tell me about the Naqsh-e-Gul choker` | The piece is lit where it stands and described with its specifications. |
| `Show me similar` | Four pieces in the same spirit as the one in view. |
| `Book an appointment` | The consultation opens, pre-set to the right occasion. |
| `Tell me about Waseem` | The page glides to 1952 and the house answers. |
| `Where are you?` | The three showrooms and the hours, at the foot of any route. |

It also answers `hello`, `what can you do`, `how much is this`, `thank you`, out-of-scope questions, and Roman Urdu — `mujhe haar dikhao`, `doosra kholo`. The command table is `src/concierge/providers/mock/commands.ts`; the tools it can call are `src/concierge/tools/toolDefs.ts`.

**The concierge by voice.** The mic ring in the hero opens the voice stage listening. Where the browser offers speech recognition it is used, with a live transcript beneath the orb. Where it does not — Firefox, for instance — the mic button runs "Let me show you" instead, which types a real command through the same pipeline so that listening, thinking, the action and the spoken reply all still happen. "Let me show you" sits beneath the mic on every browser. **Deny the microphone and nothing breaks**: the concierge says so in its own voice and offers writing or the example. Spoken replies can be turned off in the panel.

**The consultation.** There is no saved selection in this build — no Save piece, no ledger, no count in the nav; a piece is enquired about or viewed. The consultation form validates name, telephone, showroom and occasion, then returns a reference of the form `WJ-260907-XXXX` and a WhatsApp hand-off. There is no backend: the request is kept in `sessionStorage` under `wj:consultation` and goes nowhere else.

**Reduced motion.** Turn on the OS setting and reload. The quality tier becomes REDUCED, the custom cursor and the WebGL scenes stand down, and every chapter presents its composed state instead of animating.

**Mobile widths.** Narrow the window below 768px and reload, or use a device emulator — the tier is resolved once, on mount. The tier drops to LOW, the cursor is replaced by real controls, the concierge panel becomes a full-screen sheet — results step it aside for the tray, with the concierge's line beside the jewel — and each chapter falls back to its stacked composition.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server on port 3300. |
| `npm run build` | Production build. |
| `npm start` | Production server on port 3300. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run check` | The gate: typecheck, lint, `copy:check`, `nlu:check`, `enquiry:check`, build, `secret:scan`, in sequence. On a memory-constrained machine build with `NEXT_BUILD_CPUS=1`. |
| `npm run leak:check [base]` | **Browser acceptance / regression, run by hand — not part of `check`.** Against a running production build (`npx next start -p 3399`): five route loops and twenty concierge cycles in a real Chromium, DOM nodes, listeners and heap sampled after forced GC. Fails on more than 15% growth. |
| `npm run bundle:report [base] ['?tier=HIGH']` | Measures what each route actually downloads, gzipped, against the budget. Also by hand, against a running build. |
| `npm run voice:check [base]` | Drives the concierge's voice through every state in a headless browser — the browser tier with the speech APIs faked, and the server tier with the transcribe and speak routes mocked. 19 assertions. |
| `npm run assets:variants` | Cuts every localised image into the 640/1080/1600 widths the image loader serves (`src/lib/imageLoader.ts`); run after `assets:images`, commit the variants. |
| `npm run warm:images <base>` | Only for a deployment that still uses a metered image optimiser; this build serves the shop's CDN resizes and its own variants instead, so nothing needs warming. |
| `npm run assets` | Re-encodes the videos and re-localises the images from the manifest. Needs ffmpeg and network access. |
| `npm run assets:images` / `assets:videos` | Either half of the above. |

## Development-only affordances

None of these exist in a production build.

- `?tier=high|medium|low|reduced` forces a quality tier, so the WebGL and reduced-motion paths can be inspected on any machine. (Also honoured in production if `NEXT_PUBLIC_QA_TIER_OVERRIDE=1`.)
- `?concierge=STATE` forces one of the eleven concierge states — `IDLE`, `HOVER`, `OPENING`, `CHAT`, `VOICE_READY`, `LISTENING`, `THINKING`, `SPEAKING`, `EXECUTING_ACTION`, `RESULT`, `ERROR`.
- `node scripts/dev/shot.mjs <url> [--steps N] [--mobile] [--reduced] [--act "click:sel;wait:800;shot:name"]` loads a page in headless Edge or Chromium, scrolls it with real wheel events so Lenis and ScrollTrigger behave as for a visitor, writes screenshots to `scripts/dev/shots/`, and prints console errors, failed requests, and trigger, tween, canvas and video counts.
- `node scripts/dev/concierge-matrix.mjs [--only A,B]` drives the concierge through eight scenarios across the home, collection and product routes with the dev server running, printing the reply, tool labels, navigation, scroll position and tray state for each command.
- `window.__wj` exposes trigger, tween and ticker counts, the site store and `closeOverlays()`; `window.__wjConcierge` exposes the controller and its store.

## Media

Untouched originals live in `media-originals/`, which is git-ignored. Everything the site serves is localised, optimised and **committed** under `public/assets/waseem/` — 48 images with blur placeholders and 5 clips in 1280 / 720 / portrait variants with posters, about 52 MB in total. `next.config.ts` declares no remote patterns, so nothing can be hot-linked. `ASSET_MANIFEST.md` lists every file with its source, crop, dimensions and alt text; it is generated by `npm run assets` and should not be edited by hand.

## Environment

No environment file is required. `.env.example` documents every variable and what it enables.
The concierge ships keyless; setting `CONCIERGE_API_KEY` on the server and redeploying the same
build activates the model path — the bundle does not change, the browser asks
`/api/concierge/capabilities` what it is allowed to be. `OPENAI_API_KEY` alone switches on the
text model, the transcription/speech tier and the realtime voice tier (`gpt-realtime-2.1` over
WebRTC, minted per session by `/api/concierge/realtime-token`); without it the deterministic
engine answers and the browser's own speech APIs are the fallback. The key is a server-side
variable on the deployment and nothing else — never in the repository, a `NEXT_PUBLIC_` name, a
log or a screenshot. Consultation delivery stays on the
visitor's device until all four of `ENQUIRY_WEBHOOK_URL`, `NEXT_PUBLIC_SITE_URL`,
`ENQUIRY_PRIVACY_URL` and `ENQUIRY_PRIVACY_CONTACT` are set and valid (`npm run enquiry:check`
proves a webhook alone is not enough). Every secret is read only under `src/server/`, which is
`server-only`, banned from client imports by ESLint, and checked against the built client chunks
by `npm run secret:scan`.

## Documentation

| File | Contents |
|---|---|
| `SITE_ARCHITECTURE.md` | Routes, chapters, state stores and the shape of the data layer. |
| `DESIGN_SYSTEM.md` | Type scale, colour, spacing and the ivory / dark themes. |
| `MOTION_SYSTEM.md` | Easings, the Lenis + GSAP contract, reveals and page transitions. |
| `CONCIERGE_ARCHITECTURE.md` | Provider interface, tool registry, the voice pipeline and the path to a Realtime provider. |
| `ASSET_MANIFEST.md` | Every localised file, its source and anything that could not be localised. |
| `PERFORMANCE_BUDGET.md` | Tier definitions and the budgets each one is held to. |
| `PROGRESS.md` | Milestone log, decisions and known upstream notices. |

## Not in Stage 1

- Commerce: there is no cart, checkout, pricing feed or stock; eight of the ten pieces are priced on request and two carry a figure, all held in `src/data/products.ts`.
- Backend: the consultation is not transmitted anywhere, and there is no CMS, account or search index.
- Collections beyond Bridal: the five collection worlds exist as data and imagery and route into Bridal; each becomes its own route by adding an entry to `src/data/collections.ts`.
- The OpenAI Realtime concierge: the provider interface, tool registry and API routes are in place, but the shipped concierge is keyless.
- Urdu across the interface: Nastaliq is used only for the two accents verified against the house's own material — دیوان on the Dewan world, نقش گل in Bridal interlude.

## Known limitations

- Prices, specifications and heritage copy are drawn from what the house publishes; nothing is inferred, so several fields are deliberately absent rather than filled.
- Speech recognition depends entirely on the browser. Where it is missing, the scripted example is the voice path, and that is by design rather than a fallback of last resort.
- The WebGL craft object and the ritual stone are tier-gated. On a software renderer they are skipped; force them with `?tier=high` to inspect them.
- `@react-three/fiber` logs one `THREE.Clock: This module has been deprecated` notice on load. It is upstream and harmless.
- Awaiting the house: the Urdu spellings and meanings of the collection names other than Dewan and Naqsh-e-Gul, and archival photography of the founders, the early showrooms and the workshop — none of it is online, so 1952 is currently told with the facade, the vitrine and campaign fragments.
