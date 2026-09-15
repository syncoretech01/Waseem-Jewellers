# Performance Budget

Stage 1, Waseem Jewellers. Everything below describes code in this repository as it stands.

## The standing decision

Budgets are targets. The mandatory bar for Stage 1 is behavioural, not numeric:

- **No obvious jank.** Scrubbed chapters track the wheel; nothing stutters on a normal desktop machine.
- **No leaks.** ScrollTriggers, `gsap.ticker` listeners and GL resources return to their resting counts across route changes and concierge open/close cycles.
- **No broken responsive behaviour.** Every chapter composes at 360 px and at 2560 px, portrait and landscape.

A number in the table below being missed is a conversation. One of the three above being missed is a defect.

| Target | Value | Status |
|---|---|---|
| Base route JS | ≤ 170 kB gz | **316 kB — over by 146** (home, 16 Sep 2026, after Stage 2.2: the five figures and the doors cost 7 kB on the app chunk; was 309 on 11 Sep, 349 before the hydration work). Every route 296–316. See *Measured* below. |
| three + R3F chunk | ≈ 220 kB gz, requested once per document; never under REDUCED | **253 kB — over by 33** (HIGH tier via `?tier=HIGH` on a QA build, 11 Sep 2026). Two chunks: 232 + 21. |
| drei | pulled in only by the craft object, so HIGH and MEDIUM only | no separate chunk — bundled into the 232 kB three chunk |
| Homepage first load including three | ≤ 400 kB gz | **602 kB — over by 202** (349 initial + 253 three, HIGH tier, 11 Sep). **435 on LOW** (16 Sep 2026, settled, where three never loads; was 358 — the concierge chunk now arrives on idle and is counted as settled). |
| Images | webp; 2880 px for the four full-bleed campaign frames, 2250 px or less for everything else | met (see manifest) |
| Video, one codec, all variants | ≤ 25 MB | h264 31.2 MB — over; **AV1 21.6 MB — within** where AV1 is supported (verified in Chromium, 11 Sep 2026) |
| CLS | 0 (fixed aspect boxes, blur placeholders, no late-injected chrome) | not measured |

## Measured

`npm run bundle:report` loads each route in a real browser from a running production build, captures
every script response, gzips it here and attributes it by content. Read from a manifest, a number
says what *could* load; read from a browser, it says what *did*. First run, 11 September 2026, against
the build at `99ac717`:

| Route | Initial (HTML-referenced) | Settled (after idle) |
|---|---|---|
| `/` | 349 kB | 358 kB |
| `/gold` | 336 kB | 363 kB |
| `/jewellery/[slug]` | 340 kB | 371 kB |
| `/collections/bridal` | 331 kB | 358 kB |

Where the 349 kB on the homepage goes, by chunk:

| gz kB | What | Avoidable on first paint? |
|---|---|---|
| 70 | React runtime | no |
| 44 | Next app-router runtime | no |
| 58 | GSAP core + ScrollTrigger + SplitText + CustomEase | no — the loading ritual is GSAP |
| 68 | Application shell: the `motion` library, Loader, Nav, `Img`, the client index | partly — `motion` is only used by surfaces that open on interaction |
| **39** | **The concierge: lexicon, parser, tools, controller** | **yes — nothing here is visible until the panel opens** |
| **25** | **Concierge UI, Lenis** | **yes, the UI part** |
| 45 | Chapters and the rest | partly — `MenuOverlay`, `SelectionLedger`, `ConsultationModal` all mount on every route, invisible |

The 179 kB overage is not the animation system; it is that everything a visitor *might* open is
hydrated before they can open anything. That is the S2F hydration work, and its target — at least
120 kB off the initial figure — is now a measurement rather than an estimate.

### After the hydration work

Same day, same method, after the surfaces invisible until an interaction — the salon behind the
orb, the menu, the ledger, the consultation form, the cursor — were moved off the initial script
set and onto idle-or-interaction (`ConciergeMount`, `LazyChrome`):

| Route | Before | After | Off |
|---|---|---|---|
| `/` | 349 kB | 309 kB | 40 |
| `/gold` | 336 kB | 294 kB | 42 |
| `/jewellery/[slug]` | 340 kB | 300 kB | 40 |
| `/collections/bridal` | 331 kB | 296 kB | 35 |

The concierge is now entirely absent from the initial set — its 31 kB chunk arrives on idle, or
on the first request if that comes sooner, and a request that arrives before the chunk is held
and replayed (measured: 555 ms from a pre-idle click on the orb to an open salon). The homepage
needed one more cut than the others: the hero's invitation imported the controller directly,
and a seven-line microphone glyph was being imported from the campaign page component.

**Forty kilobytes, not the hundred and twenty the plan estimated.** The estimate assumed the
deferred surfaces were ~120 kB together; measured, they were ~65. What remains initial is React
(70), the Next router (43), GSAP with the plugins the ritual needs (57), and the `motion` library
that the nav and the orb animate with (~35, inside a 56 kB shell chunk). Taking the last two off
the first paint would mean re-animating the loader, the nav and the orb without them, which is a
redesign of finished work rather than a stabilisation, and is not done here. The 170 kB line
is therefore not reachable on this architecture; **309 kB is the honest floor**, and the budget
document should be read with that.

**On measuring three.** Headless Chromium has no real GPU, so `QualityDetector` resolves LOW and
the craft object never mounts; the ordinary report reads 0 for that line. The figure above comes
from a QA build (`NEXT_PUBLIC_QA_TIER_OVERRIDE=1`) loaded with `?tier=HIGH` and scrolled to
CH02, where the chunk is requested on approach. On software GL that page runs at about two frames
a second — which is what the frame-rate monitor now demotes a real visitor away from.

## Quality tiers

`src/lib/quality.ts` resolves one tier on the client. The server tree is tier-neutral; `useQualityStore.tier` is `'unresolved'` until `QualityDetector` (`src/state/trackers.tsx`) runs its effect, at which point the tier is written to `<html data-tier>`. An inline script in `src/app/layout.tsx` stamps `data-rm`, `data-coarse` and `data-visited` before first paint so CSS and the loader can choose a path without waiting for hydration.

Detection is a first-match ladder:

| Order | Rule | Tier |
|---|---|---|
| 1 | `prefers-reduced-motion: reduce` | REDUCED |
| 2 | `pointer: coarse`, or `connection.saveData`, or `deviceMemory ≤ 4` (assumed 8 when unreported), or `innerWidth < 768` | LOW |
| 3 | No WebGL context, or renderer matches `swiftshader\|llvmpipe\|basic render\|software` | LOW |
| 4 | Renderer matches `intel\|uhd\|iris\|hd graphics\|mali\|adreno\|powervr`, or `MAX_TEXTURE_SIZE < 8192` | MEDIUM |
| 5 | Renderer matches `apple m\|apple gpu` | HIGH |
| 6 | Renderer string unavailable and `hardwareConcurrency < 8` (assumed 4 when unreported) | MEDIUM |
| 7 | Otherwise | HIGH |

The probe creates a throwaway canvas, takes `webgl2 ?? webgl`, reads the unmasked renderer through `WEBGL_debug_renderer_info` and `MAX_TEXTURE_SIZE`, then releases the context with `WEBGL_lose_context`. Any throw is treated as no WebGL.

DPR caps are `Math.min(cap, devicePixelRatio || 1)`:

| Tier | DPR cap |
|---|---|
| HIGH | 1.75 |
| MEDIUM | 1.5 |
| LOW | 1 |
| REDUCED | 1 |

A live `prefers-reduced-motion` change is followed: turning it on forces REDUCED with DPR 1 and a static orb; turning it off re-runs detection.

### What each tier turns off

| | HIGH | MEDIUM | LOW | REDUCED |
|---|---|---|---|---|
| Loader stone in WebGL (`LoaderGem`) | yes | no | no | chunk never requested |
| Craft object (`CraftScene`, CH02) | yes | yes | no | no |
| Stone refraction | 2 bounces, aberration 0.006 | 1 bounce, no aberration | — | — |
| Menu ambient and world films | yes | yes | no | no |
| Video source | 1280 | 1280 | 720 | not played |
| FLIP page transition | yes | yes | curtain/veil instead | veil |
| Custom cursor | yes | yes | off on coarse pointers | off |
| Chapter scrubs | yes | yes | yes | replaced by composed stills |
| Concierge orb | WebGL | WebGL | WebGL | static |

Notes on the edges. The craft chapter renders its SVG stone, halo, ring and band in the DOM at every tier — the canvas is an overlay, so LOW and REDUCED lose the object's dimensionality, not the chapter. Under REDUCED the chapters take their still path — the `reduce` condition of `gsap.matchMedia` in most, a plain store check in CH06 and CH08 — which sets the finished composition (labels lit, reveals at rest) instead of building a scrubbed timeline. `scrollTo` collapses to an immediate jump, and no video ever plays. The concierge orb falls back to `OrbStatic` whenever `orbRenderer` is `'static'`, which is any tier without a usable WebGL probe plus REDUCED.

## WebGL rules

Three canvases exist in Stage 1. Two are transient; one is long-lived.

| Canvas | File | Frameloop | DPR | Power hint | Lifetime |
|---|---|---|---|---|---|
| Loader stone | `src/components/loader/LoaderGem.tsx` | `always` | `[1, 1.5]` | low-power | unmounts with the ritual |
| Craft object | `src/components/three/craft/CraftScene.tsx` | `demand` | `[1, max(1, min(dprCap, 1.75 on HIGH, 1.5 on MEDIUM))]` | high-performance | mounts near CH02, then persists |
| Concierge orb | `src/concierge/orb/OrbCanvas.tsx` | `always` | `[1, 2]` | low-power | mounts with the voice stage |

**One heavy canvas at a time.** The craft object is the only expensive scene. It mounts only when the loader has finished, the tier is HIGH or MEDIUM, WebGL is available, and an `IntersectionObserver` with `rootMargin: '100% 0px'` reports the chapter within one viewport. The loader gem is gone before that point. The orb is a single sphere on a small element. Once mounted, the craft canvas is not torn down again for the life of the page — its cost is bounded by demand rendering rather than by unmounting.

**Demand rendering.** `useDemandInvalidate` (`src/lib/three/sceneLifecycle.ts`) adds one function to `gsap.ticker` and calls `invalidate()` only when something has changed: a damped value still settling, a new `craftProgress.value` from the chapter's scrub, or a mouse that has moved more than 0.002 in normalised space (the shared pointer model in `src/lib/motion/pointer.ts` tracks `pointerType === 'mouse'` only). A still, unhovered scene renders nothing.

**Disposal.** Every geometry and material is created in `useMemo` and disposed in an unmount effect — nine objects in `CraftScene`, geometry and material in `OrbMesh` and in the loader gem. `disposeObject(root)` sits in the same file for imperatively built subtrees; nothing in Stage 1 calls it yet.

**Environment maps.** `createStudioEnvironment` and `createGemEnvironment` (`src/lib/three/studioEnvironment.ts`) build a procedural jeweller's studio and a gem light tent and render each **once per renderer** into a half-float `WebGLCubeRenderTarget` (256 px; 128 px for the loader gem's tent), cached in a `WeakMap` keyed by the renderer. Nothing is downloaded. `scene.environment` is set on mount and cleared on unmount; the cube itself lives as long as the renderer that made it.

**Context loss.** `useContextLoss` calls `preventDefault()` on `webglcontextlost` and reports upward. `CraftScene` then renders nothing, and `Ch02Craft` increments a counter and remounts the scene under a new `key`. After two losses it stops mounting the scene entirely and the chapter runs on its DOM stage. The canvas is also only faded in (700 ms) once `gl.compileAsync` resolves, or after a 900 ms timeout, so a slow compile never shows a half-lit object.

**Orb throttling, precisely.** `OrbCanvas` runs `frameloop="always"`. Its `Throttle` component returns early from its own frame callback while the concierge is at rest, which skips that callback's work; R3F still renders the frame. The saving is the callback, not the draw.

## Media policy

`next.config.ts` is the whole image contract:

```
formats:     ['image/webp']
deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560]
imageSizes:  [96, 160, 256, 384, 512]
qualities:   [70, 82]          // Next 16 requires an allowlist; the default is [75]
minimumCacheTTL: 30 days
remotePatterns: []             // nothing is hot-linked
```

`src/components/media/Img.tsx` is the only `next/image` call site — the monogram and the concierge result thumbnails are plain `<img>` on already-sized local files. `sizes` is a **required** prop — there is no default, so a new call site cannot silently ship a full-width candidate. Quality is typed `70 | 82` and defaults to 82; 70 is used for the 80 px selection-ledger thumbnail. Every `next/image` call carries the generated blur placeholder, and fill images take a focal `object-position` from the asset map, so boxes are stable from first paint. Packshots (white-background stills) render on a pearl tile with `mix-blend-mode: multiply`. A `plain` variant renders a bare `<img>` for FLIP sources, where a wrapper and a shifting `currentSrc` would break the transition; it is `loading="lazy"` unless `priority` or `eager` is set.

Source files are produced by `scripts/assets/localize.mjs`: fetch, crop, resize with lanczos3 (never enlarging), webp at quality 82, plus a 16 px webp blur inlined as base64.

Video is encoded by `scripts/assets/encode-videos.mjs` into three variants and two posters per clip: **1280** landscape (CRF 24 by default), **720** landscape (CRF +3), and a **404 × 720 portrait crop** (CRF +4) taken around a per-clip subject x-offset. All are libx264, yuv420p, `+faststart`, silent.

`src/components/media/Video.tsx` is the only video element:

- `muted`, `playsInline`, `loop`, `disablePictureInPicture`, `disableRemotePlayback`; poster from the asset map.
- **No `autoplay` attribute.** Playback starts from an effect once the tier is known.
- `preload="none"` by default. The hero passes `auto`; the menu ambient, the menu world films and the collection opening pass `metadata`. On first intersection a `none` element is flipped to `auto` before play.
- An `IntersectionObserver` with `rootMargin: '25% 0px'` plays on entry and pauses on exit, and is disconnected on cleanup.
- Sources in order: the portrait crop under `media="(max-width: 767px) and (orientation: portrait)"`, then 720 on LOW or 1280 elsewhere. `portrait={false}` opts out where the frame is always landscape.
- Nothing plays under REDUCED, and nothing plays while the visitor has paused motion.
- `onFirstFrame` resolves through `requestVideoFrameCallback`, falling back to the `playing` event, with a 2500 ms timeout so the loader is never held by a stalled decode.

**The visitor-facing control.** The navigation carries a `Pause motion` / `Play motion` button with `aria-pressed`, wired to `siteStore.videoPaused`. Setting it pauses every mounted `Video` and prevents any from starting. It is a real control, not a preference stored out of sight.

## Code splitting

| Module | Loaded by | When |
|---|---|---|
| `@/components/three/craft/CraftScene` | `next/dynamic`, `ssr: false` in `Ch02Craft` | HIGH or MEDIUM, WebGL available, loader done, chapter within one viewport |
| `./LoaderGem` | bare `import()` in `Loader` | home route without `data-rm`, requested as the ritual mounts at every tier; raced against a 400 ms timer (2500 ms in development) and joined only on HIGH with WebGL while the fill is still below 0.75 (0.97 in development) |
| `./OrbCanvas` | `next/dynamic`, `ssr: false` in `Orb` | preloaded on pointer-enter of the concierge invitation or orb; rendered only for the voice stage with `orbRenderer === 'webgl'` |
| `gsap/Flip` | `loadFlip()` in `src/lib/motion/lazyPlugins.ts` | a 1500 ms timer in `TransitionLayer`. Registered but not called: the FLIP transition tweens its own clone with core GSAP |
| `gsap/Observer` | `loadObserver()` in the same file | CH07's spatial slider, desktop branch only — the drag is not built on mobile or under REDUCED |

So three and R3F arrive on every tier but REDUCED: the loader stone requests them on the home route, and the concierge orb requests them when the voice stage opens. drei is pulled in only by `CraftScene`, so it never loads on LOW or REDUCED.

`src/lib/motion/gsap.ts` is the single GSAP entry point — ScrollTrigger, SplitText and CustomEase register there, and ESLint forbids importing `gsap` or `gsap/*` anywhere else. `SmoothScroll` drives `lenis.raf` from `gsap.ticker`, so the DOM layer runs on one RAF.

## Measured asset weights

From `ASSET_MANIFEST.md`, generated by `npm run assets` on 2026-09-07: **48 images, 19.35 MB** and **5 clips, 31.20 MB across all variants**.

| Clip | 1280 | 720 | Portrait | Used by |
|---|---|---|---|---|
| hero-royal | 5.24 MB | 1.47 MB | 1.70 MB | hero (CH01), menu BRIDAL |
| bridal-cinema | 5.57 MB | 1.67 MB | 1.83 MB | bridal cinema (CH05) |
| bridal-opening | 1.85 MB | 561 kB | 538 kB | /collections/bridal opening and its interlude block |
| menu-ambient | 4.09 MB | 1.27 MB | 1.09 MB | menu ambient backdrop, menu COLLECTIONS |
| diamond-studio | 2.59 MB | 783 kB | 988 kB | CH08 diamond side, menu DIAMOND |

Only one variant of a clip is ever fetched, and — the hero apart, which passes `preload="auto"` — only when its chapter comes into range. The totals above are what sits on disk, not what a visit downloads. The heaviest images are the campaign frames: `p03-hero` 1.51 MB, `p06-hero` 1.35 MB, `bespoke-bride` 1.22 MB and `wall-campaign` 1.21 MB — all at 2880 px except `bespoke-bride`, which is 2250 px. The rest of the product, world and heritage frames run 73 kB – 1.09 MB; the video stills are 16 – 81 kB. next/image re-encodes each of these down to the requested candidate width, so the on-disk figure is an upper bound.

## Inspecting locally

```
npm install
npm run dev            # port 3300
```

**Headless inspection.** `scripts/dev/shot.mjs` drives Playwright over headless Edge, Chrome or Playwright's bundled Chromium — whichever launches first — scrolls with real wheel events so Lenis and ScrollTrigger behave as they do for a visitor, and writes screenshots to `scripts/dev/shots`:

```
node scripts/dev/shot.mjs http://localhost:3300/ --steps 8 --tag home
node scripts/dev/shot.mjs "http://localhost:3300/?tier=low" --mobile --tag low
node scripts/dev/shot.mjs http://localhost:3300/ --reduced --tag reduced
node scripts/dev/shot.mjs http://localhost:3300/ --act "click:[data-cursor=ask];wait:1200;shot:concierge"
```

It prints one JSON line — elapsed ms, resolved `data-tier`, scroll height, live ScrollTrigger and tween counts, and the number of `canvas` and `video` elements on the page — followed by every console error, warning, page error, 4xx response and failed request, or `NO CONSOLE ERRORS/WARNINGS`. Canvas and trigger counts across a scroll pass are the leak check. Note that the browser is launched with ANGLE SwiftShader, so detection sees a software renderer and lands on LOW; use the override to inspect the other tiers.

**Tier override.** `?tier=high|medium|low|reduced` forces a tier. It is honoured in development, or in a build started with `NEXT_PUBLIC_QA_TIER_OVERRIDE=1`. The override is applied after detection and lifts the software-renderer veto on the `webgl` flag, so a software renderer can still be used to inspect the GL paths.

**Runtime inspector.** In development, `window.__wj` (`src/lib/devInspector.ts`) exposes `triggers()`, `tweens()`, `tickerFns()`, `site()` and `closeOverlays()`. `gl()` and `glInfo` are wired to a `reportGL` helper that nothing currently calls, so they report nothing yet.

## What has not been measured

Be clear with anyone reading these numbers:

- **No Lighthouse or PageSpeed run has been recorded.** LCP, TBT, INP and CLS are unverified.
- **No bundle analysis has been run.** The JS budgets in the first table are hand-set targets, not observations.
- **No field data.** There is no RUM, no analytics, no error reporting.
- **No frame-time capture on real hardware.** Tier behaviour has been checked by forcing tiers in a desktop browser and in the headless harness, not on a phone or an integrated-GPU laptop under load.
- The video total on disk exceeds its target line; nothing has been re-encoded to bring it under.

## Not in Stage 1

Cache and compression headers beyond `minimumCacheTTL`, AV1/HEVC or adaptive (HLS) video variants, a CI performance gate, and real-user monitoring are deferred to Stage 2.

## Video: AV1 first

Every clip is encoded twice (`npm run assets:videos`): h264, which everything plays, and AV1 through
SVT-AV1. AV1 where supported, H.264 fallback; verified in Chromium. The browser chooses — the AV1 `<source>` precedes the h264 one — so a
device that cannot decode it never fetches it; in Chromium only the `.av1.mp4` is requested. No
other browser has been tested against this build.

| | h264 | AV1 | saving |
|---|---|---|---|
| hero-royal 1280 | 5.24 MB | 3.13 MB | 40 % |
| bridal-cinema 1280 | 5.57 MB | 3.76 MB | 33 % |
| menu-ambient 1280 | 4.09 MB | 2.88 MB | 29 % |
| diamond-studio 1280 | 2.59 MB | 2.26 MB | 13 % |
| all fifteen files | 31.20 MB | 21.56 MB | 31 % |

The first pass landed AV1 *larger* than h264 on the 720 and portrait tiers, and larger on one 1280
clip: SVT-AV1 reads CRF on a different scale, and the shipped h264 had been encoded tighter than
the script's defaults. The values in the encoder are the third pass, checked frame against frame
(SSIM 0.986 between codecs on the hero at 1280; the kundan and the emerald beads read identically
at 1:1). The plan's 40–50 % estimate is met on the hero and not on the quiet clips; 31 % overall
is the honest figure.

No `<source>` carries a `media` attribute any more. Chromium keeps a MediaQueryList listener for
one as a pending activity after the element is gone, and through it the video, its buffered film
and every ancestor. The portrait file is chosen with `matchMedia` in JS instead.

## Leaks

`npm run leak:check` is a browser acceptance and regression command, **not part of `npm run
check`**: it needs a running production build (`npx next start -p 3399`) and drives a real
Chromium, so it is run by hand before a release rather than on every gate. It walks / → /gold → a PDP → / →
/collections/bridal → / five times through the app's own links, then opens and closes the
concierge twenty times, forcing GC through CDP before every sample. The audit that motivated it
(11 Sep 2026) found +4,400 DOM nodes, +768 listeners and +1 MB of heap per loop — a whole previous
homepage retained per visit, the hero video and its 31 seconds of film five times over after five
visits. Four retainers, each sufficient on its own:

1. `Observer.create` caches its target in a module-level array that `kill()` never prunes
   (`lazyPlugins.ts` → `killObserver`).
2. `gsap.quickTo` is a paused tween on the global timeline, removed only on completion; six per
   home visit were never killed (Ch01Hero, Ch06Wall, Ch08Duality).
3. A `<source media>` element is pinned by Blink after unmount (above).
4. `gsap.matchMedia().add()` attaches a change handler to every MediaQueryList it creates and
   neither `kill()` nor `revert()` removes it — 47 per loop, an upstream bug in gsap 3.15,
   contained in `gsap.ts`.

After: nodes 2,189 on every loop, listeners 740 on every loop, concierge cycles flat, heap
8.8 → 9.9 MB with the increment shrinking each loop (browser performance-entry buffers, not ours).

## The frame-rate monitor

`src/lib/perf/fpsMonitor.ts` samples the same `gsap.ticker` that drives every tween — a 120-frame
ring of frame durations, plus a `PerformanceObserver('longtask')` count for the inspector. Three
consecutive seconds under 45 fps demotes the tier one step through `useQualityStore.demote`,
which cascades exactly as a detected tier does: DPR cap, `useCanWebGL`, video variant, `data-tier`.

Once per session, never back up. A page that promotes itself the moment it recovers oscillates,
and the visitor sees the site change its mind. `data-demoted` on `<html>` carries the fps that
caused it, and `detectedTier` in the store keeps what the device claimed, so the two can be told
apart.

Held off where a low reading would be true and irrelevant: during the loading ritual, while
`html.is-transitioning`, for 800 ms after any `ScrollTrigger.refresh()` (the one place a
stale-clock trap actually lives), and while the document is hidden. REDUCED is never a demotion
target — it is the visitor's own preference.

Not drei's `PerformanceMonitor`, which sees only R3F frames; this page's cost is DOM and
compositing, and the object it would watch is the smallest part of it.

Proven in a browser (11 Sep 2026): a QA build on `?tier=HIGH`, CPU throttled 30× under CDP while
scrolling, demoted to MEDIUM at a measured 2 fps after the ring filled and the three-second window
elapsed, and stayed at MEDIUM after the throttle was lifted. `__wjFps()` is exposed on QA and dev
builds so the reading can be watched rather than trusted.
