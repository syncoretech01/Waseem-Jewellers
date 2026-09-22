# Site Architecture — Waseem Jewellers (Stage 1)

The digital flagship of Waseem Jewellers: a cinematic homepage, Bridal, a page for every
piece, and the Waseem Concierge. It runs entirely from the repository — no credentials, no external
services, no network calls at runtime.

## Stack

| | |
|---|---|
| Framework | Next 16.3.4, App Router, Turbopack (there is no webpack configuration and there must not be one) |
| Language | TypeScript 5.9, `strict` with `noUncheckedIndexedAccess`; `@/*` maps to `src/*` |
| UI | React 19.2, Tailwind 4 (`@tailwindcss/postcss`), Motion 13 |
| Motion | GSAP 3.15 (ScrollTrigger, SplitText, CustomEase; Flip and Observer lazily), Lenis 1.3 |
| 3D | three 0.185, `@react-three/fiber` 9.7, `@react-three/drei` 10.7, maath |
| State | Zustand 5 |
| Node | >= 22, npm only |

`npm install && npm run dev` serves the site on http://localhost:3300.

## Routes

As the production build reports them (alongside Next's own `/_global-error`):

| Route | Kind | Renders |
|---|---|---|
| `/` | Static | `Home` — fourteen chapters in one continuous scroll, in the order a shop is walked: the hero (the authentic mark in the header, *Lahore · since 1952*, the name, one proposition, one door to the window — the departments are in the header and the menu), the window by kind (the category system, from `repository.showcase()`), the craft (the emerald study, universal), the bangle (one set of bangles turned in the hand: profile → surface → rhythm → inside → the complete set, pinned), the gate (Gold and Diamond in one frame, with a draggable handle), Gold, the goldwork (from the work to the piece, pinned), Diamond, one suite in one light (pinned), Bridal (from behind velvet), the signature collections, Men and Kids, since 1952 (the showrooms), Bespoke (the parted pair, pinned); the loading ritual (CH00) and the footer mount in `Providers`. Gold, Diamond, Bridal, Men and Kids and the history are server-rendered in full and hydrated on approach (`lazyChapter`). Section ids: hero, vitrine, craft, bangle, gate, gold, goldwork, diamond, light, bridal, collections, menkids, heritage, bespoke, footer |
| `/_not-found` | Static | `src/app/not-found.tsx` — two links back into the site |
| `/collections/[slug]` → `/collections/bridal` | SSG | `CollectionExperience` for the one collection in `src/data/collections.ts` |
| `/jewellery/[slug]` → ten paths | SSG | `ProductExperience` for each of the ten products |
| `/api/concierge/realtime-token` | Dynamic | 503 without `OPENAI_API_KEY`, 501 with one |
| `/api/concierge/tool` | Dynamic | 503; server-side tools are not enabled |
| `/icon.png` | Static | favicon from `src/app/icon.png` |

Both dynamic segments set `dynamicParams = false` and build their params from the data layer, so a
slug that is not in `src/data` is never rendered — Next answers it with the not-found page rather than
attempting it on demand. `generateMetadata` on each derives title, description and the OG image from
the same records.

The two API routes are seams for the future OpenAI Realtime provider, documented in
`CONCIERGE_ARCHITECTURE.md`. They import `server-only`; `OPENAI_API_KEY` is read in
`realtime-token/route.ts` and nowhere else.

Query state (`?world=`, `?edit=`, `?material=`, `?concierge=`) is never read from `window.location` by
an experience. `RouteTracker` publishes `{ pathname, search, navEpoch }` into `siteStore` and
components derive from there. `?tier=` is the one exception: `src/lib/quality.ts` reads it directly,
because tier detection runs before anything is published.

### Not in Stage 1

Accounts, checkout, payments, order history, the full catalogue, CMS or admin, a live OpenAI
connection, an appointment backend, sitemap/robots/JSON-LD.

## Provider stack

`src/app/layout.tsx` sets the fonts (Bodoni Moda for display, Instrument Sans for text, Noto Nastaliq
Urdu for the Urdu titles, not preloaded), the metadata, and a synchronous stamp script that writes
`data-visited`, `data-rm` and `data-coarse` onto `<html>` before first paint so CSS and the loading
ritual can choose their path before hydration.

`src/app/providers.tsx` mounts everything else, and the order is load-bearing:

1. **`MotionConfig reducedMotion="user"`** — Motion respects the OS preference for the whole tree.
2. **`ReactLenis root`** with `autoRaf: false` — Lenis wraps the page but does not run its own loop.
3. **`QualityDetector`** — resolves the tier before any canvas can mount.
4. **`SmoothScroll`** — wires the single RAF of the DOM layer: `gsap.ticker` → `lenis.raf` →
   `ScrollTrigger.update`. The craft canvas renders on demand from that same ticker; only the loader
   gem and the concierge orb keep a loop of their own, and only while they are mounted.
5. **`RuntimeBridge`** — publishes the App Router instance into the imperative runtime registry.
6. **`RouteTracker`** (inside `Suspense`, because it reads `useSearchParams`) — publishes the route.
7. **`StorageSweeper`** — clears what earlier builds kept in the browser (the selection ledger's `wj:selection:v1`/`v2`); nothing in the site store is persisted.
8. **`#page-root`** — the routed tree.
9. **Persistent chrome, mounted once outside the routed tree**: `Footer`, `TransitionLayer`, `Nav`,
   `MenuOverlay`, `ConciergeRoot`, `ConsultationModal`, `Loader`, `CursorLayer`.
   These survive navigation, which is what allows the curtain and FLIP transitions to span routes.

A single effect in `Providers` sets `history.scrollRestoration = 'manual'`, configures ScrollTrigger
(`ignoreMobileResize`, `limitCallbacks`), clears its scroll memory, disables GSAP lag smoothing,
installs the development inspector and runs the catalogue assertion.

## State layer (`src/state/`)

Three Zustand stores and three module-level registries. The registries hold what must not go into a
store: non-serialisable handles and hot, per-frame data.

### `siteStore.ts`

Nothing is persisted. The saved selection — Save piece, the ledger, the count in the nav, the
`persist` middleware and its `wj:selection` storage — is gone; `StorageSweeper` removes a returning
visitor's old record. Everything is session state.

| Field group | Fields |
|---|---|
| Route | `route`, `pathname`, `search`, `routeKind` (`home`/`collection`/`product`/`other`), `navEpoch` |
| Position | `section` (the current `SectionId`), `currentProduct`, `focusedProduct`, `visibleProducts`, `selectedCollection`, `selectedWorld` |
| Last piece | `lastOpenedProduct` |
| Chrome | `menuOpen`, `consultation` (`{ open, topic, productSlug(s), source }`) |
| One-shot requests | `spotlight` (`{ slug, token }`), `pendingSection`, `pendingSpotlight`, `dualityBias` |
| Environment | `videoPaused`, `heroInvitationVisible`, `loaderDone`, `hydrated` |

`setRoute` bumps `navEpoch` and, on a genuine path change after the first publish, clears the
position fields so a new page does not inherit the last one's context. The position setters compare
before they set, so a chapter republishing the same value does not re-render its subscribers.

### `conciergeStore.ts`

An eleven-state machine — `IDLE`, `HOVER`, `OPENING`, `CHAT`, `VOICE_READY`, `LISTENING`, `THINKING`,
`SPEAKING`, `EXECUTING_ACTION`, `RESULT`, `ERROR` — with an explicit `TRANSITIONS` table. `transition()`
refuses an illegal move (and warns in development) rather than corrupting the state; `OPEN_STATES` and
`BUSY_STATES` derive the panel's presence and its busy affordances. Also held: `mode` (`chat`/`voice`),
`panel` (`closed`/`full`/`compact`), `turns` (capped at 40, each with `tools` and a typed `result`),
`transcript`, `recentResults`, `recentCollections`, `providerId`, `voice` flags (adapter, recognition,
synthesis, spoken replies, session), `error`, `greeted`, `trayOpen`.

### `qualityStore.ts`

`tier` (`'unresolved'` until detection runs), `dprCap`, `reducedMotion`, `coarse`, `saveData`, `webgl`,
`renderer`, `detected`, `orbRenderer`. `detect()` runs once on the client and stamps
`<html data-tier>`; `setReducedMotion` follows the media query live and re-detects when it clears.
Selectors are deliberately primitive (`useTier`, `useIsReduced`, `useIsHigh`, `useCanWebGL`,
`useDprCap`, `useIsCoarse`) — Zustand 5 needs stable snapshots.

### `runtime.ts` — the imperative registry

`runtime.lenis`, `runtime.transition`, `runtime.router`, set once by `SmoothScroll`, `TransitionLayer`
and `RuntimeBridge`. `scrollTo()` is the only sanctioned programmatic scroll: it forces past Lenis'
stopped state, collapses to an immediate jump under `REDUCED`, and falls back to `scrollIntoView`
before Lenis exists. `markSettledArrival()` / `isSettledArrival()` let reveals land composed after a
back/forward or deep-link arrival instead of replaying.

### `sections.ts` — the section registry

Every chapter registers through `useChapter({ id, theme, pinned })`. One `IntersectionObserver` plus a
passive scroll listener schedule a rAF pass; the current section is the one whose rect contains the
viewport centre-line, with pinned entries winning ties. The winner is written to `siteStore.section`
and its theme mirrored onto the chrome's `[data-chrome]` wrappers (never `<html>`: a root-level token change re-propagates to every node — see PERFORMANCE_BUDGET, S2I). Below the page root the fixed footer
takes over. `sectionsReady()` resolves once every registered section has reported its pins ready —
`Home`'s pending-section effect, `CollectionExperience` and the transition layer each race it against
a short timeout before scrolling, so an arrival lands after the pins exist. `SECTION_LABELS` gives
each id its house name.

### `visibility.ts` — the product registry

One shared observer; elements register via `useProductVisibility(slug)`, which also stamps
`data-product`. Products at ≥ 0.2 ratio are published in reading order (top → bottom, then left →
right within a 48px band), capped at twelve, so "open the second one" means what the visitor actually
sees. A chapter that owns the viewport — the spatial slider — calls `overrideVisibleProducts()` to
publish its own order and clears it on leave.

## Data layer (`src/data/`)

**Content is data-driven.** Every route, chapter, store and concierge tool reads from these modules.
No file path appears in the content files: media is referenced by asset id and resolved through the
generated asset map. Adding a piece or a collection is a data edit, not a component edit.

| File | Contents |
|---|---|
| `types.ts` | The contract: `Product`, `Collection`, `CollectionChapter`/`StoryBlock`, `CollectionWorld`, `HeritageMoment`, `MenuItem`, `SiteInfo`, `ImageAsset`, `VideoAsset`, plus the `Material` / `Category` / `StyleTag` / `Karat` / `WorldSlug` / `AssetRole` unions |
| `products.ts` | Ten curated pieces, `p01`–`p10`, each with editorial title, house, category, material, tags, metadata, price (`onRequest` or `fixed`), media ids, a three-part story, exactly three `complementary` slugs, `featuredRank`, and the `source` handle and URL it was drawn from |
| `collections.ts` | Bridal: tagline, intro, opening media, eight pieces, four story chapters of `solo`/`duet`/`interlude` blocks, the gold and diamond edits, and the worn-together rail |
| `worlds.ts` | The five signature worlds of CH04 — `rukh-e-jana`, `aks-e-noor`, `rang-e-jamal`, `dewan`, `royal-wedding` — each with a palette, three column tiles, a hero tile (always the middle one, so the FLIP lands on the same image) and its `?world=` href |
| `heritage.ts` | The five moments of CH03, from 1952 to the three showrooms |
| `menu.ts` | The six full-screen navigation items; each `target` exists in Stage 1 |
| `site.ts` | House facts as published: founder, successor, three Lahore showrooms, hours, phone, WhatsApp, email, socials, plus `whatsappHref(text)` |
| `copy.ts` | Consumer-facing copy: the homepage chapters, the product page, the footer and the consultation form |
| `search.ts` | `searchCatalogue()` (structured query, synonym expansion, scoring, featured-rank tiebreak), `similarTo()` (world → material → category → shared tags), `findByName()` (distinctive-word matching for spoken and typed names) |
| `generated/asset-map.ts` | Written by the asset pipeline; `IMAGES` and `VIDEOS` as `const satisfies` records, with the `ImageId` / `VideoId` types derived from them |
| `index.ts` | The single import surface: `getProduct`, `getCollection`, `getImage`, `getVideo`, `productsBySlugs`, and `assertCatalogue()` |

`getImage()` returns a safe empty asset and warns in development when an id is unknown, so a missing
image never breaks a render. `assertCatalogue()` runs once on the client in development and reports
duplicate slugs, non-positive prices, unknown complementary slugs, unknown image ids, missing alt
text, and any collection or world pointing at something that does not exist.

## Asset pipeline

Every image and video is local under `public/assets/waseem/`. Nothing is hot-linked;
`next.config.ts` declares `remotePatterns: []`.

```
scripts/assets/manifest.mjs          the single source of truth: IMAGES, VIDEOS, STILLS
        │
        ├── npm run assets:videos → scripts/assets/encode-videos.mjs (ffmpeg)
        │       trims, crops, encodes 1280 / 720 / 404×720 portrait + poster frames
        │       → public/assets/waseem/video/**  and  .cache/videos.json
        │
        └── npm run assets:images → scripts/assets/localize.mjs (sharp)
                fetch → cache → crop → resize (never enlarge) → webp q82 (+jpg/png on request)
                → 16px blur placeholder → lifts the STILLS frames → merges .cache/videos.json
                → public/assets/waseem/images/**, brand/, og/home.jpg
                → src/data/generated/asset-map.ts
                → ASSET_MANIFEST.md
```

`npm run assets` runs both in that order. Manifest entries carry `derive.crop` (fractions of the
source), `focal` (used for `object-position`), an `alt` string, and a `role`. The role sets the
`maxDisplayWidth` recorded in the asset map — half the stored width for `packshot` and `macro`, the
full width otherwise — and `packshot` also tells `Img` to lay the image on a pearl tile. A failed
fetch is recorded in `ASSET_MANIFEST.md`, not thrown, so one dead URL does not stop the run.

The pipeline is a build-time authoring tool. **`npm run dev` and `npm run build` never invoke it.**
Its outputs — the files under `public/assets/waseem/`, `src/data/generated/asset-map.ts` and
`ASSET_MANIFEST.md` — are committed. `.cache/` and `media-originals/` are not.

`next.config.ts` allows only `image/webp`, pins the device and image size lists, allowlists qualities
`70` and `82` (Next 16 defaults to `[75]` alone), and caches for thirty days. `src/components/media/Img.tsx`
requires an explicit `sizes` string on every use.

## Quality tiers

`src/lib/quality.ts` resolves one of four tiers on the client. The server-rendered tree is
tier-neutral.

| Tier | Chosen when | DPR cap |
|---|---|---|
| `REDUCED` | `prefers-reduced-motion: reduce` | 1 |
| `LOW` | coarse pointer, Save-Data, ≤ 4 GB device memory, viewport < 768px, no WebGL, or a software renderer | 1 |
| `MEDIUM` | integrated or mobile GPU (Intel / UHD / Iris / HD Graphics / Mali / Adreno / PowerVR), max texture < 8192, or an unnamed renderer with < 8 cores | 1.5 |
| `HIGH` | everything else, and Apple GPUs explicitly | 1.75 |

Detection probes WebGL2 then WebGL, reads the unmasked renderer string where the extension allows it,
and releases the context immediately. The effective DPR is `min(tierCap, devicePixelRatio)`. In
development, or when `NEXT_PUBLIC_QA_TIER_OVERRIDE=1`, `?tier=HIGH|MEDIUM|LOW|REDUCED` forces a tier.

How the tier is applied:

- `<html data-tier>` is stamped, and `globals.css` uses the pre-paint `data-rm` stamp to unpin the
  horizontal chapters — the heritage track, the spatial slider and the bespoke tray fall back to their
  stacked reading order.
- Every chapter reads `tier === 'REDUCED'` and collapses its scroll choreography accordingly; GSAP
  `matchMedia` carries `prefers-reduced-motion` as a condition alongside the desktop/mobile breakpoints,
  so a live change reverts the other branch cleanly.
- The craft object mounts only when `webgl && (HIGH || MEDIUM)`, the loading ritual has finished, the
  chapter is within one viewport, and the WebGL context has not been lost twice. Otherwise the stage
  carries the house stone in SVG. `CraftScene` clamps its canvas DPR to `min(dprCap, 1.75 | 1.5)`.
- `orbRenderer` is `webgl` only when WebGL is available and the tier is not `REDUCED`; the concierge
  orb otherwise renders its static form.
- `Video` never plays under `REDUCED` or when the visitor has paused media, has no `autoplay`
  attribute (playback starts from an effect once the tier is known), and serves the portrait encode
  on phones.
- `CursorLayer` renders only for fine pointers on a resolved, non-reduced tier.

## File map

```
src/
  app/
    layout.tsx            fonts, metadata, viewport, the pre-paint stamp script
    providers.tsx         the provider stack and the persistent chrome
    page.tsx              /
    not-found.tsx         /_not-found
    globals.css           Tailwind 4 theme, [data-theme] tokens, data-rm fallbacks
    collections/[slug]/   the collection route
    jewellery/[slug]/     the product route
    api/concierge/        realtime-token, tool — reserved seams
  components/
    home/Home.tsx         the homepage, plus chapters/Ch01…Ch09
    loader/               the loading ritual (CH00), its stone and gem, readiness promises
    chrome/               Nav, MenuOverlay, Monogram, Footer (CH10)
    collection/           CollectionExperience, CollectionOpening, StoryBlocks, IndexView
    product/              ProductExperience, Gallery, InfoColumn, InspectImage, WornTogetherRail
    commerce/             ConsultationModal, PieceLink
    media/                Img, Video
    motion/               SmoothScroll, TransitionLayer, TransitionLink, CursorLayer, Arrive
    three/craft/          CraftScene
    ui/                   Button, Dialog, Field, primitives
  concierge/              controller, provider seam, tools, voice, orb, panel UI, bridge
  data/                   the content and the generated asset map
  lib/
    motion/               gsap.ts (the only GSAP entry point), lazyPlugins, transition,
                          flipFrames, easings, pointer, snapWithLenis
    three/                gem geometry, materials, studio environment, scene lifecycle
    quality.ts  cn.ts  format.ts  focusTrap.ts  devInspector.ts
  motion/hooks/           useChapter, useReveals, useFlipTarget, useFlipNavigate,
                          useFocusScroll, useProductVisibility
  state/                  siteStore, conciergeStore, qualityStore, runtime, sections,
                          visibility, trackers
  types/                  dom.d.ts, speech.d.ts
scripts/
  assets/                 manifest, encode-videos, localize, lib
  dev/                    inspection scripts (below)
public/assets/waseem/     the committed localised media
```

`src/lib/motion/gsap.ts` is the single GSAP module; `eslint.config.mjs` makes importing `gsap`,
`gsap/all`, `gsap/*` or `@gsap/react` anywhere else an error, with `gsap.ts` and `lazyPlugins.ts` as
the only exceptions. Flip and Observer register on first use through `lazyPlugins.ts`.

## The concierge, in one paragraph

`ConciergeMount` is mounted once, in `Providers`: the orb eagerly, and the salon — controller,
panel, tray, lexicon, tools — lazily, on the first request, a hover of the orb, or idle after the
ritual. `ConciergeController` owns the provider, the voice adapter, speech output and every timer,
and reduces provider events into store transitions — the UI reads only the store.
`createProvider()` returns a `FallbackProvider`, which tries the server-mediated model
(`/api/concierge/turn`, live when `CONCIERGE_API_KEY` is set) and answers with the keyless engine
on any recoverable failure — including the ordinary case of no key. Nothing `NEXT_PUBLIC_` selects
a provider. Twenty-four tools are declared in `tools/toolDefs.ts`; twenty-one run in the browser
through `tools/executeTool.ts`, and three that only read the catalogue (`compareProducts`,
`explainSpecification`, `deepSearch`) run on the server. Every call passes `tools/validate.ts`
first. Voice uses the browser's own recognition and synthesis as the fallback tier
(`voice/adapters.ts`, `voice/speech.ts`), with `voice/engine.ts` as the seam a realtime engine
plugs into. Any component can summon the concierge by dispatching through `concierge/bridge.ts` —
no import of the concierge itself. The full account is in `CONCIERGE_ARCHITECTURE.md`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | `next dev -p 3300` |
| `npm run build` | `next build` — type-checks, then prerenders the static and SSG routes |
| `npm start` | `next start -p 3300` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run check` | typecheck, then lint, then build — the gate before a commit |
| `npm run assets:videos` | ffmpeg encodes (requires `ffmpeg`/`ffprobe` on PATH and the originals) |
| `npm run assets:images` | sharp localisation; writes the asset map and `ASSET_MANIFEST.md` |
| `npm run assets` | both, videos first |

### Development inspection scripts (`scripts/dev/`)

Playwright drivers and browser expressions used to check the running site. They are excluded from
`tsconfig.json` and from ESLint, and are never part of a build. The three `.mjs` entry points launch
headless Edge or Chromium with SwiftShader enabled; the `.js` files are expressions passed to
`--eval` or run in a console. All of them expect `npm run dev` to be up on port 3300.

| Script | Purpose |
|---|---|
| `shot.mjs` | Loads a URL, collects console and page errors, scrolls with real wheel events so Lenis and ScrollTrigger behave as they do for a visitor, and writes screenshots. Flags: `--out --w --h --steps --to --wait --mobile --reduced --full --click --eval --tag --hover` |
| `eval.mjs` | Loads a URL, scrolls to a given Y, evaluates one expression and prints the result |
| `concierge-matrix.mjs` | Drives the keyless concierge through a matrix of commands on each route kind and reports the reply, tool labels, navigation, scroll, tray and consultation for each |
| `cycle-probe.js` | Opens and closes the concierge twenty times and compares ScrollTrigger, tween, ticker and canvas counts before and after — the leak check |
| `probe-reveals.js` | Reports the computed clip-path, visibility and geometry of the first reveals and split-text elements |
| `reduced-probe.js` | Under `REDUCED`, reports the tier, trigger and pin counts, the heritage track transform, the worlds clip-path and video paused state |
| `overflow-probe.js` | Lists elements crossing the viewport edge, ignoring deliberate horizontal scrollers and hidden overlays |
| `curtain2.js`, `edit-curtain.js`, `edit2.js` | Sample the transition curtain's position and the page's inert state across a navigation, including one driven by the concierge |
| `edit2.js` | Asks the concierge for the gold edit and reports the resulting URL, edit title and filter row |
| `spot-probe.js` | Follows a concierge spotlight request from `pendingSpotlight` through to the focused element |
| `kbd-probe.js` | Report the roles, labels and tab order of the custom controls |
| `a11y-names.js`, `label-probe.js` | List focusable elements with no accessible name, and every form field with its label, `aria-label` and `aria-labelledby` |
| `click-bridal.js`, `click-house.js` | Click a named item in the full-screen menu |

`installDevInspector()` exposes `window.__wj` in development only, with live counts of ScrollTriggers,
tweens and ticker functions, the last reported WebGL info, a `site()` snapshot of the store, and
`closeOverlays()`. Most of the scripts above depend on it.

## Related documents

`CONCIERGE_ARCHITECTURE.md` · `DESIGN_SYSTEM.md` · `MOTION_SYSTEM.md` · `PERFORMANCE_BUDGET.md` ·
`ASSET_MANIFEST.md` (generated) · `README.md`
