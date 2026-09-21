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
| Base route JS | ≤ 170 kB gz | **317 kB — over by 147** (home, 17 Sep 2026, after the gate, the window by kind and the three jewellery moments: +0.6 kB on 16 Sep's 316; was 309 on 11 Sep, 349 before the hydration work). Every route 297–317; settled 426–447 with the concierge operator chunk (65 kB, was 31). See *Measured* below. |
| three + R3F chunk | ≈ 220 kB gz, requested once per document; never under REDUCED | **253 kB — over by 33** (HIGH tier via `?tier=HIGH` on a QA build, 11 Sep 2026). Two chunks: 232 + 21. |
| drei | pulled in only by the craft object, so HIGH and MEDIUM only | no separate chunk — bundled into the 232 kB three chunk |
| Homepage first load including three | ≤ 400 kB gz | **602 kB — over by 202** (349 initial + 253 three, HIGH tier, 11 Sep). **435 on LOW** (16 Sep 2026, settled, where three never loads; was 358 — the concierge chunk now arrives on idle and is counted as settled). |
| Images | webp; 2880 px for the four full-bleed campaign frames, 2250 px or less for everything else; served without a metered optimiser — the shop's CDN resizes the long tail, build-time 640/1080/1600 variants serve the localised set (`src/lib/imageLoader.ts`) | met (see manifest); 16 Sep 2026: the review deployment answered 402 to every `/_next/image` once the plan's monthly transformations were spent, which is why the optimiser is gone |
| Video, one codec, all variants | ≤ 25 MB | h264 31.2 MB — over; **AV1 21.6 MB — within** where AV1 is supported (verified in Chromium, 11 Sep 2026) |
| CLS | 0 (fixed aspect boxes, blur placeholders, no late-injected chrome) | **0.000** after load (17 Sep 2026, `.cache/s22/vitals.mjs`, production build, 1440×900, MEDIUM). The same observer reports ~5.9 over a full scroll-through, which is the pinned chapters switching between fixed and flow at their boundaries — a layout-shift entry by definition, not something a visitor sees move. |
| LCP | ≤ 2.5 s | **1.2–1.8 s** on localhost (same runs; the hero's poster). Not yet measured from Lahore. |

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
| 45 | Chapters and the rest | `MenuOverlay` and `ConsultationModal` mount closed behind `LazyChrome`; five homepage chapters hydrate on approach (`lazyChapter`) |

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

A live `prefers-reduced-motion` change is followed: turning it on forces REDUCED with DPR 1; turning it off re-runs detection.

### What each tier turns off

| | HIGH (A) | MEDIUM (C: integrated GPU) | LOW (B/C: phones, 4 GB, narrow) | LOW + still (D: weak, or demoted twice) | REDUCED |
|---|---|---|---|---|---|
| Loader stone in WebGL (`LoaderGem`) | yes | no | no | no | chunk never requested |
| Craft object (`CraftScene`, CH02) | live emerald | live emerald | the prerendered still (since 21 Sep: the client refused the flat LOW stone) | the still; WebGL withheld, the three chunk never fetched | the still |
| Stone | 3 bounces, dispersion 0.011 | 2 bounces, 0.007 | — | — | — |
| Canvas DPR cap | 1.75 | 1.5 | 1 (1.5 on a premium phone: `data-premium`) | 1 | 1 |
| Menu ambient and world films | yes | yes | no | no | no |
| Video source | 1280 | 1280 | 720 / portrait | 720 / portrait | not played |
| Video sources kept while far away | let go after 4 s beyond 1.5 viewports, on every tier (see *Final pass*) | same | same | same | never attached |
| Scroll owner | Lenis (wheel smoothed) | Lenis | native touch; Lenis observes only (`data-scroll="native"` on coarse pointers) | same | same |
| FLIP page transition | yes | yes | curtain/veil instead | curtain/veil | veil |
| Custom cursor | yes | yes | off on coarse pointers | off | off |
| Chapter scrubs | yes | yes | yes | yes | replaced by composed stills |
| Once-reveals (rise, split, mask) | IntersectionObserver per scope, on every tier | same | same | same | shown at once |
| Concierge trigger | crest + ring, CSS | same | same | same | same, nothing moving |

The letters are the client's device tiers (A modern desktop, B premium phone, C mainstream phone or integrated GPU, D weak). Detection puts a phone on LOW whatever its GPU — the phone paths are written against LOW — and marks a recent Apple, Adreno 7xx/8xx or Mali-G7x+ GPU, or eight gigabytes reported, as `premium` (`data-premium`, canvas DPR 1.5 instead of 1). `weak` — two gigabytes, two cores or save-data — is LOW with WebGL withheld (`data-weak`), so the craft chapter shows its still and the three chunk is never fetched. The inline stamp in `src/app/layout.tsx` writes `data-tier-guess` (`reduced` / `low` / `medium`) and `data-weak` before first paint from the same facts, so a stylesheet or the loader can choose a path before hydration; `detectQuality` overwrites `data-tier` a few hundred milliseconds later with the renderer string in hand.

Notes on the edges. The craft chapter's object is for everyone (16 Sep 2026): HIGH and MEDIUM render it with the refractive stone; LOW — every phone — renders the same geometry at DPR 1 with the non-refractive stone, on a demand frameloop, which is what makes the three chunk (253 kB gz, fetched only as the chapter approaches) affordable there; REDUCED and a browser without WebGL show a still of the same object rendered once from the same scene (`public/assets/waseem/images/craft/ring-*.webp`, 11–36 kB, cut by `scripts/assets/craft-poster.mjs`). The SVG stone, halo, ring and band remain in the DOM only for the drawing's own reveal and are hidden the moment the object or the still is up. Under REDUCED the pinned chapters take their still path — the `reduce` condition of `gsap.matchMedia` — which sets the finished composition (labels lit, reveals at rest) instead of building a scrubbed timeline. `scrollTo` collapses to an immediate jump, and no video ever plays. The concierge trigger (17 Sep 2026) is the crest on a disc with a hairline ring, DOM and CSS on every tier — it has no renderer to choose, so `qualityStore.orbRenderer` no longer has a reader.

## WebGL rules

Two canvases exist. One is transient; one is long-lived. A third — the concierge orb's liquid-metal sphere, `frameloop="always"` on `[1, 2]` DPR, mounted with the voice stage — was removed on 17 September 2026 with the trigger redesign: the trigger is Waseem's crest on a disc, and the voice stage was already a hairline ring with the crest at its centre, so nothing asked for the sphere.

| Canvas | File | Frameloop | DPR | Power hint | Lifetime |
|---|---|---|---|---|---|
| Loader stone | `src/components/loader/LoaderGem.tsx` | `always` | `[1, 1.5]` | low-power | unmounts with the ritual |
| Craft object | `src/components/three/craft/CraftScene.tsx` | `demand` | `[1, max(1, min(dprCap, 1.75 on HIGH, 1.5 on MEDIUM))]` | high-performance | mounts near CH02, then persists |

**One heavy canvas at a time.** The craft object is the only expensive scene. It mounts only when the loader has finished, the tier is not REDUCED, WebGL is available, and an `IntersectionObserver` with `rootMargin: '100% 0px'` reports the chapter within one viewport. The loader gem is gone before that point. Once mounted, the craft canvas is not torn down again for the life of the page — its cost is bounded by demand rendering rather than by unmounting.

**Demand rendering.** `useDemandInvalidate` (`src/lib/three/sceneLifecycle.ts`) adds one function to `gsap.ticker` and calls `invalidate()` only when something has changed: a damped value still settling, a new `craftProgress.value` from the chapter's scrub, or a mouse that has moved more than 0.002 in normalised space (the shared pointer model in `src/lib/motion/pointer.ts` tracks `pointerType === 'mouse'` only). A still, unhovered scene renders nothing.

**Disposal.** Every geometry and material is created in `useMemo` and disposed in an unmount effect — nine objects in `CraftScene`, geometry and material in the loader gem. `disposeObject(root)` sits in the same file for imperatively built subtrees; nothing in Stage 1 calls it yet.

**Environment maps.** `createStudioEnvironment` and `createGemEnvironment` (`src/lib/three/studioEnvironment.ts`) build a procedural jeweller's studio and a gem light tent and render each **once per renderer** into a half-float `WebGLCubeRenderTarget` (256 px; 128 px for the loader gem's tent), cached in a `WeakMap` keyed by the renderer. Nothing is downloaded. `scene.environment` is set on mount and cleared on unmount; the cube itself lives as long as the renderer that made it.

**Context loss.** `useContextLoss` calls `preventDefault()` on `webglcontextlost` and reports upward. `CraftScene` then renders nothing, and `Ch02Craft` increments a counter and remounts the scene under a new `key`. After two losses it stops mounting the scene entirely and the chapter runs on its DOM stage. The canvas is also only faded in (700 ms) once `gl.compileAsync` resolves, or after a 900 ms timeout, so a slow compile never shows a half-lit object.

**The concierge trigger costs no frame.** At rest nothing runs: the ring and the trace are stylesheet keyframes that exist only while the store is in a moving state (LISTENING, THINKING, EXECUTING_ACTION, SPEAKING), and the hover's specular band is one GSAP timeline of 1.1s, killed when the hover ends. No ticker, no canvas, no `voiceMeter` reader — the trigger is the one piece of the concierge on every first paint, and it is a `<button>`, two `<span>`s and two small SVGs.

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
| `gsap/Flip` | `loadFlip()` in `src/lib/motion/lazyPlugins.ts` | a 1500 ms timer in `TransitionLayer`. Registered but not called: the FLIP transition tweens its own clone with core GSAP |
| `gsap/Observer` | `loadObserver()` in the same file | no homepage consumer since the spatial slider left (16 Sep 2026); kept for a drag surface that needs it |

So three and R3F now arrive only on the home route: the loader stone requests them on every tier but REDUCED, and the craft object as CH02 approaches. No other route loads them — the concierge no longer requests them anywhere (`preloadOrbCanvas` is a kept no-op). drei is pulled in only by `CraftScene`, so it never loads on LOW or REDUCED.

`src/lib/motion/gsap.ts` is the single GSAP entry point — ScrollTrigger, SplitText and CustomEase register there, and ESLint forbids importing `gsap` or `gsap/*` anywhere else. `SmoothScroll` drives `lenis.raf` from `gsap.ticker`, so the DOM layer runs on one RAF.

## Measured asset weights

From `ASSET_MANIFEST.md`, generated by `npm run assets` on 2026-09-07: **48 images, 19.35 MB** and **5 clips, 31.20 MB across all variants**.

| Clip | 1280 | 720 | Portrait | Used by |
|---|---|---|---|---|
| hero-royal | 5.24 MB | 1.47 MB | 1.70 MB | hero (CH01), menu BRIDAL |
| bridal-cinema | 5.57 MB | 1.67 MB | 1.83 MB | bridal cinema (CH05) |
| bridal-opening | 1.85 MB | 561 kB | 538 kB | /collections/bridal opening and its interlude block |
| menu-ambient | 4.09 MB | 1.27 MB | 1.09 MB | menu ambient backdrop, menu COLLECTIONS |
| diamond-studio | 2.59 MB | 783 kB | 988 kB | menu DIAMOND |

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

## The scroll, measured on an integrated GPU (17 Sep 2026)

`.cache/s22/vitals.mjs` and `.cache/s22/profile.mjs` (a CDP CPU profile over a scroll range, aggregated by function and by caller) were run against the production build in a headed Chromium on an Intel HD 530 — the class of laptop most of the review will happen on. Two things were found and fixed, and one is reported as it is.

**The compile block.** Mounting the craft object as its chapter approached put 1.4 s on the main thread in the middle of the window chapter: 1,378 ms in `getProgramInfoLog`, then — once that sync point was removed — 893 ms in `getProgramParameter` inside `PMREMGenerator._applyGGXFilter`. The filter shader that pre-filters the object's environment is the slowest shader in three to compile on this driver, and it is compiled by a render, so no parallel-compile extension helps it. Three changes: the canvas holds `frameloop="never"` until `compileAsync` reports every program linked (a first frame drawn earlier blocks for the whole compile); `checkShaderErrors` is off in production; and the object is also mounted early, at the first idle moment after the loader in which the visitor has not scrolled for 900 ms — usually while the hero is being read — so the environment's second passes there. Worst frame during a full scroll-through: **850–1,016 ms before, 133–300 ms after** (three runs each).

**The gate's writes.** The gate's ticker wrote the divider's `left` and the two words' `font-variation-settings` every frame, breath included, whether or not the gate was on screen. Each is layout, and every scroll read after it forced a reflow: 240–470 ms of `pageYOffset`/`actualScroll` per two seconds of scrolling in the profile. The divider is now moved by transform, the weight is written only when it changes by a step, nothing is written when the split has not moved, and the ticker and the breath run only while the gate is on screen. The hero's `--header-veil` moved from `<html>` to the header for the same reason: a custom property on the root recalculates the whole document's style every frame of the hero.

**What remains.** Long tasks of 50–150 ms still appear through the scroll on this machine (82–100 over a 16–18 s pass at two viewports a second; 4 with WebGL unavailable), and the frame-rate monitor demotes the tier to LOW partway through every run (17–38 fps measured). A timeline trace of the same range shows the main thread nearly idle — 197 ms of tasks, 5 ms of paint — and 1.8 s on the compositor and GPU threads, which is where an integrated GPU pays for a page of full-bleed photographs and a live WebGL context. The numbers vary by a third between identical runs. That is the honest state: the page is smooth on the main thread and GPU-bound on a 2016 Intel laptop, and the tier monitor is doing what it is for.

## The S2H round, measured (18 Sep 2026)

Same instruments, same Intel HD 530, production build, 1440×900, headed, two runs each. The round added five pinned chapters (the study, the goldwork journey, the light, bespoke, and the gate before them), the emerald shader, the card system and the morph, and took the page from 20,542 px to 25,440 px.

| | Before (d699bd1) | After (S2H) |
|---|---|---|
| Worst scrolled frame | 133–300 ms | **117–133 ms** |
| Long tasks through a full scroll | 82–100 · 5.3–8.9 s | **67–68 · 4.0–4.1 s** |
| Frame rate through the scroll | 33–37 fps | **41.6–41.9 fps** |
| LCP (localhost) | 1.2–1.8 s | **1.1 s** |
| CLS after load | 0.000 | **0.000** |
| Base route JS (home, initial) | 317 kB gz | 323 kB gz (+6: four chapters and four moments; the GSAP Flip plugin no longer loads — the morph tweens its own clone) |
| Homepage settled | 447 kB | 435 kB |
| Leaks | clean | clean (nodes 0 %, listeners 0 %, heap +11 % over five loops and twenty concierge cycles) |

**The emerald costs less than the glass it replaces.** The stone's shader is a facet-plane ray march with Beer–Lambert absorption (`src/lib/three/emeraldMaterial.ts`) instead of drei's refraction tracer: GPU timer queries on the stone alone, 240 renders over the pin's orbit — drei MEDIUM 7.07 ms / HIGH 9.62 ms → **1.97 ms / 2.74 ms**, against 1.15 ms for the flat LOW stone. Its tier is decided once at compile, so a demotion mid-scroll never remounts the material. Nothing compiles during an active scroll: the canvas still holds `frameloop="never"` until every program is linked and mounts at the first still moment after the loader.

**The morph is transform-only.** One measurement of the source (clip-aware, object-fit-aware) and one of the target; one clone tweened from one state object; flights of 456–692 ms on every image door, landing within 0.1 px, no blank frame (`npm run flip:check`, headless, headed, 390×844 and reduced motion).

## What has not been measured

Be clear with anyone reading these numbers:

- **No Lighthouse or PageSpeed run has been recorded.** TBT and INP are unverified; LCP and CLS are from a Playwright observer on localhost, above.
- **No bundle analysis has been run.** The JS budgets in the first table are hand-set targets, not observations.
- **No field data.** There is no RUM, no analytics, no error reporting.
- **No frame-time capture on a phone.** Tier behaviour has been measured on an integrated-GPU laptop (above) and in the headless harness, not on a phone.
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

`src/lib/perf/fpsMonitor.ts` counts frames on the same `gsap.ticker` that drives every tween —
per wall-clock second, not over a ring — plus a `PerformanceObserver('longtask')` count for the
inspector. Two readings demote, and either is enough (21 Sep 2026):

- **two consecutive seconds under the floor** — 50 fps on a coarse pointer, 48 on a fine one,
  scaled to 80 % of the display's own rate (the best second seen while nothing scrolled), so a
  30 Hz screen is not demoted for being one;
- **three stalls** — frames of 120 ms or longer — inside any three-second window.

A second that was mostly one long frame (the craft object's compile, a large decode) is the
stall's business and does not count as a low second. The step is one tier: HIGH → MEDIUM → LOW →
the still (`demoteToStill`: WebGL withheld, `data-still` on `<html>`, so the craft chapter lets
its object go and shows the prerendered one). Once per session, never back up — a page that
promotes itself the moment it recovers oscillates, and the visitor sees the site change its mind.
`data-demoted` on `<html>` carries the fps that caused it, and `detectedTier` in the store keeps
what the device claimed, so the two can be told apart.

Held off where a low reading would be true and irrelevant: during the loading ritual, while
`html.is-transitioning`, for a second after any `ScrollTrigger.refresh()` (the one place a
stale-clock trap actually lives), for 700 ms after any hold lifts, and while the document is
hidden. REDUCED is never a demotion target — it is the visitor's own preference.

The tier itself is resolved earlier than it was: `TierResolver` (`src/lib/perf/TierResolver.tsx`)
runs `detect()` in the first layout effect of the page, before any chapter's `useGSAP`, so the
first ScrollTrigger, the first video source and the first figure's fidelity are decided against
the real tier rather than against `unresolved`. `detect()` runs once; a second call is a no-op
unless forced (reduced motion turned off), so it can never undo a demotion.

Not drei's `PerformanceMonitor`, which sees only R3F frames; this page's cost is DOM and
compositing, and the object it would watch is the smallest part of it.

Proven in a browser (21 Sep 2026, dev server, Intel HD 530): a scripted full-page scroll on
1440×900 demotes MEDIUM → LOW at 42–46 fps after two low seconds (`demotedAt` 4,644–7,020 px);
on a 390×844 headed window LOW → still at 22–25 fps; the touch-fling pass with Lenis's listeners
demoted at 48 fps and the same pass with native touch did not. `__wjFps()` on QA and dev builds
returns the per-second history, the display rate and the stall count, so the reading can be
watched rather than trusted.

## Final pass (21 Sep 2026)

Everything here was measured on the same Intel HD 530 laptop as the earlier sections — tier C
hardware, detected MEDIUM on 1440×900 and LOW on a 390×844 mobile window — against the **dev
server** on port 3300 (`next dev`; a production build was not permitted during this pass).
Dev-server numbers are worse than production's: React's development build, unminified chunks,
`checkShaderErrors` on (the craft object's shader compile is 1.7 s here and 0.4 s on the live
build). Compare the columns with each other, not with the S2H production table above. The
harnesses are in `.cache/s22/perf/` (gitignored); the scripted scroll is `slowfind.mjs`
(12 % of a viewport every 55 ms, the same pace as `vitals.mjs`).

### The finding that mattered: the bangle study

The first full-page pass at HEAD ran at **1 fps** with a 1,017 ms worst frame and 206 long
tasks (164 s of them): from the bangle chapter onward every `scrollTo` blocked the main thread
for ~950 ms in `LayerTreeHost::WaitForCommitCompletion`, with the compositor and GPU threads
idle — a compositor pathology, not script. Bisected by hiding elements and by injecting CSS: it
is `will-change: transform` on `.bangle-turn`, the `preserve-3d` element directly inside the
study's `perspective: 1400px` box (`src/semantic/moments/BangleStudy.tsx`). Removing that one
`will-change` (or the perspective) returns the page to 39–46 fps; removing the camera's
`will-change` alone does not. The fault is intermittent — one run in five passes the chapter
clean — and it poisons every subsequent scroll on the page, not just the chapter. The patch
belongs to the main session (the file is not this agent's); every "after" number below has
the equivalent CSS injected (`.bangle-turn{will-change:auto}`), and is marked so.

### Before / after

| Scenario | Before | After |
|---|---|---|
| 1440×900 headed, full scripted scroll, HEAD as found | **1 fps**, worst 1,017 ms, 206 long tasks / 163.8 s, demoted MEDIUM → LOW | — (needs the bangle patch) |
| 1440×900 headed, same, bangle CSS injected | 38.8–43.6 fps, worst 100–117 ms, 29–47 long tasks / 1.7–3.2 s (12,900 px runs) | **45.6–46.5 fps**, worst 83–117 ms, 9–22 long tasks / 0.5–1.3 s (full 24,900 px, three runs) |
| `vitals.mjs`, 1440×900 headed, bangle CSS injected | not run on the dev server before; S2H production: 41.6–41.9 fps, 117–133 ms, 67–68 / 4.0–4.1 s | 46.3 fps, worst 83 ms, 13 / 0.8 s; LCP 2.4 s (dev), CLS 0.000 after load |
| 390×844 headed (tier C: LOW with WebGL), full scripted scroll | 42.5 fps, worst 117 ms, 53 long tasks / 3.1 s | **48.9 fps**, worst 68 ms, 7 / 0.4 s |
| 390×844 headless (tier D: LOW, no WebGL) | 43.2 fps, worst 117 ms, 32 / 2.0 s | **54.5 fps**, worst 67 ms, 4 / 0.24 s |
| 390×844 headed, 15 thumb flings (touch events dispatched by CDP) | Lenis's window listeners: 53.6 fps, worst 117 ms, monitor demoted at 48 fps | native touch: 54.0 fps, worst 100 ms, no demotion; the main thread's touch handlers ≤ 1 ms in both |
| ScrollTriggers alive after load, 1440×900 | 49 (7 pins, 12 scrubs, 36 once-reveals) | **13** (7 pins, 12 scrubs, 0) |
| `gsap.ticker` callbacks at rest, 1440×900 | 6 everywhere (`updateRoot`, hero pointer, gate, worlds, SmoothScroll, monitor) + the craft invalidator once mounted | 6 away from the craft chapter, 7 within half a viewport of it; 4 once the hero and worlds tickers take the gate (patches below) |
| Videos held far from the viewport | every mounted clip kept its sources, decoder and buffer for the life of the page | let go 4 s after leaving a 150 % band, taken back on approach; measured: hero 2 sources → 0 twelve viewports down → 2 and playing again at the top |
| Leaks (`npm run leak:check -- http://localhost:3300`) | clean | clean — nodes −1 %, listeners 0 %, heap +10 % over five loops and twenty concierge cycles |

Load phase, for the record (same machine): the **live production build** (751bbe4, before this
pass) ran the loading ritual at 20 fps on the desktop window and 29 on the mobile one, with
11 / 4 long tasks (1.7 s / 0.8 s) before the loader left — hydration, the first
`ScrollTrigger.refresh()` and the craft object's environment compile, in that order. The
dev-server profile of the same phase puts 1.2 s in React's commit, 0.17 s in `_refreshAll`,
0.25 s in GSAP's computed-style reads and 1.7 s in three's `onFirstUse` (dev only: the sync
link-status query `checkShaderErrors` makes). That is what lazy hydration is for; see below.

### What changed, by lever

1. **Offscreen gating.** `src/lib/perf/onScreen.ts` — one IntersectionObserver per margin, and
   `gatedTicker(el, fn)`, a `gsap.ticker` callback that exists only while its element is within
   a viewport of the screen. The craft object's demand invalidator now goes through it
   (`useDemandInvalidate`, margin 50 %): the ticker is off the list four screens away, so a
   pointer moving over bespoke no longer has the ring easing its rotation to follow it. The
   moments and semantic figures were already inert off screen — a scrubbed ScrollTrigger calls
   `onUpdate` only when its progress changes — and were left alone. The hero's pointer ticker
   and the worlds' column ticker run everywhere on the page today; the one-line patches to put
   them on the gate are in this pass's report, for the files' owner.
2. **The tier monitor** — above. Demotes in two seconds instead of three, on stalls as well as
   on averages, resolves the tier before the chapters mount, and has one more step below LOW.
3. **Native touch.** Lenis registers `touchstart`, `touchmove`, `touchend` and `wheel` on the
   window with `passive: false`; with `syncTouch` off they did nothing on a phone but make the
   compositor wait for the main thread on every touch event. On a coarse pointer Lenis is now
   given an inert element as `eventsTarget`: it keeps following the native scroll (the nav, the
   tray and ScrollTrigger subscribe to it as before), `scrollTo()`, `stop()` and `start()` keep
   working, and the finger scrolls the page the way the platform does. Verified with CDP
   `DOMDebugger.getEventListeners`: no non-passive `touchmove` remains on the window or the
   document; the remaining non-passive `touchstart`/`pointerdown` on the window in the harness
   are Playwright's own injected script, not the site's. The main-thread benchmark is a tie
   (Lenis's handler costs a millisecond); the difference is that a 120 ms decode no longer
   freezes a drag. `?scroll=lenis` restores the listeners in development for comparison.
   Providers also stopped using `ReactLenis`: its context value is a new object after its
   effect runs, and a Suspense boundary still waiting for its chapter is client-rendered the
   moment a context above it changes (below). The instance is created once, on the client's
   first render, and the context value memoised on it.
4. **Lazy hydration** — `src/components/motion/LazyChapter.tsx`, `src/lib/perf/chapterGates.ts`.
   `lazyChapter(id, () => import(...))` wraps a chapter in a Suspense boundary whose `lazy`
   loader waits behind a gate; the server renders the chapter in full and streams it, the
   client leaves the boundary *dehydrated* (React keeps the server DOM untouched) until the
   chapter comes within 150 % of the viewport, or the page is idle after the ritual (one
   chapter per idle callback, top first), or a programmatic glide is requested — then the
   chunk is fetched and React attaches to the existing nodes in place. Proven in the tree on a
   scaffold route: the same DOM node before and after (`__ssrMark` preserved), the chapter's
   chunk requested only on approach, the section registered on hydration, reveals playing.
   Two things had to be true for that: no ancestor context may change while a boundary is
   dehydrated (React's `updateDehydratedSuspenseComponent` client-renders on
   `didReceiveUpdate`; `ReactLenis` did exactly that after its effect, which is why Providers
   owns the context now), and the wrapper must never hand the boundary a new element (it is
   memoised on the chapter's prop values, and the ritual is watched through the store's own
   subscription rather than React state). Only for chapters that do not pin — a pin spacer
   arriving late would move everything beneath it. **Not yet wired**: `Home.tsx` belongs to the
   main session; the wrapping is a five-line change described in the report, and the numbers
   for it are the next measurement, not this one.
5. **Reveals.** `useRise`, `useSplitReveal` and `useMaskReveal` watch their elements with one
   IntersectionObserver per scope instead of a ScrollTrigger per element (36 of the homepage's
   49). The root is extended 200,000 px upward, so an element jumped over — a deep link, a
   restored position, a fling — still enters the root and is shown composed, which is what
   ScrollTrigger's `once` gave for free. Verified at reading pace and after a jump to the
   bottom, on 1440×900 and 390×844: nothing left hidden, nothing replayed.
6. **Video.** Sources are let go 4 s after a clip leaves a 150 % band (never while a fetch is
   in flight, so nothing is aborted by us), and taken back on approach, where the still stands
   until the first frame as it did the first time. A re-fetch from a warm cache shows in a
   Playwright audit as one `net::ERR_ABORTED` on the clip — Chromium abandoning a range
   request it no longer needs, the same thing `scripts/dev/qa-sweep.mjs` and `shot.mjs`
   already classify as not a failure. The explicit `load()` after the `<source>` list mounts
   is now deferred one task, so it can never abort the resource selection that inserting a
   `<source>` already started.
7. **Images.** On a 390 px phone the bangle study's `sizes="(min-width: 768px) 110vw, 200vw"`
   resolves to 780 CSS px × DPR 2 = 1,560 → the 1600w variant (measured: `profile-1600w.webp`,
   both photographs). The phone should fetch 1080w at most; the change is in the chapters'
   `sizes` strings (patches in the report), not in this agent's files.
8. **The concierge trigger and the voice meter** already cost nothing at rest: the ring's
   ticker exists only in LISTENING and SPEAKING, the meter's only while a stream is open, and
   the only idle timer is the context ribbon's thirty-second clock. Verified by reading
   `VoiceStage.tsx` and `voice/meter.ts`; no change needed.

## The production numbers (21 Sep 2026, S2I)

Same Intel HD 530 laptop, same `vitals.mjs` scripted scroll (12 % of a viewport every 55 ms),
**production build** on port 3399, headed (the real GPU). The S2H row is the last production
measurement before this round; the middle row is this round with every lever above landed
(the bangle `will-change`, the gated tickers, the reveals on IntersectionObserver, native touch
scrolling, the video sources let go, lazy hydration of the five non-pinned chapters); the last
row adds one more lever, found by tracing what remained.

| | fps | worst frame | long tasks during the scroll | tier at the end |
|---|---|---|---|---|
| S2H production (751bbe4), 1440×900 | 41.6–41.9 | 117–133 ms | 67–68 / 4.0–4.1 s | demoted to LOW |
| S2I, every lever but the last, 1440×900 | 44 | 150–167 ms | 40–44 / 2.7–2.9 s | demoted to LOW at 32–34 fps |
| **S2I shipped, 1440×900** | **59.2–59.6** | **67–83 ms** | **0** | **MEDIUM, never demoted** |
| **S2I shipped, 390×844 headed** (tier C) | **59.8** | **50 ms** | **0** | LOW, never demoted |
| S2I shipped, 390×844 headless (tier D) | 59.8 | 50 ms | 1 / 60 ms | LOW |

Interactions, measured in isolation (`inp-probe.mjs`, event durations ≥ 16 ms): the gate's
pointer sweep 72–80 ms, the concierge trigger's click 88 ms. `vitals.mjs` reports a
1.2–1.3 s `pointerenter` in its interaction section; that event is the first pointer move after
the harness jumps 17,000 px from the bottom of the page to the gate in one `scrollTo`, and is
the cost of that jump, not of the gate.

### The last lever: the chrome's theme was written to `<html>`

A devtools trace with invalidation tracking over the gate → gold stretch showed
`UpdateLayoutTree` (style recalculation) at 1.3 s in 2.6 s of scrolling, with single recalcs of
65–73 ms, and after each one every element with a `transition-*` class on the whole page
animating for its duration (`reason=Animation`, hundreds of per-frame recalcs). The trigger was
`src/state/sections.ts` mirroring the chapter theme onto `<html data-theme>` at every chapter
boundary. A theme is a set of inherited custom properties; changing one on the root makes the
browser re-propagate it to every node of a 4,700-node page — 65 ms — and hands every
`transition-colors` on the page a colour to animate. The chapters already carry their own
`data-theme`; only the fixed chrome ever needed the flip. It is now written to two `[data-chrome]`
wrappers in Providers (`display: contents`, so nothing about the fixed chrome's layout changes);
`<html>` keeps its static `data-theme="dark"`. The nav, the orb, the salon and the cursor read
the chapter's register exactly as before (`theme-probe.mjs`: gold and heritage → ivory, the rest
dark), and the style recalculation at a chapter boundary is a few hundred nodes.

Two smaller reads went with it: `src/state/visibility.ts` published the visible pieces from
`getBoundingClientRect()` calls inside a rAF (122 ms of forced layout in the same trace); it
now keeps the rectangles the IntersectionObserver already measured, in page coordinates, so the
reading order costs no layout at all.

LCP on the desktop is 1.44–1.57 s on this build (S2H: 1.1 s); the mobile window's 2.8–3.6 s is
the hero film's poster on a 7 s cold load of the harness. CLS after load is 0.000 on every run.

## Mobile product page (S2J)

The client's P0 after the S2I deployment: the product page lags under the thumb on a phone.
Measured on the same Intel HD 530 laptop, 390×844 and 430×932 windows with `isMobile`,
`hasTouch` and DPR 2, headed (the real GPU) and headless, on four pages — the campaign piece
(`/jewellery/aks-e-noor-satlada-haar`, three frames, a close look), the three-frame priced ring
(`lavender-halo-ring-r11912`), a single packshot (`men-bracelet-br02334`) and two packshots
(`gold-bangles-k13798`). The gesture is a thumb drag with a fling, dispatched as CDP touch
events (`.cache/s22/pdp/fling.mjs`); the traces are `trace-fling.mjs` (devtools timeline with
invalidation tracking), `forced-stacks.mjs` (every style recalculation or layout forced from
script, with the JS stack that forced it) and `census.mjs` (what is alive on the page, and its
growth over five open → scroll → back loops). "Before" is the production build of e8c4132 on
port 3399; "after" is the dev server, whose JavaScript numbers run several times slower than
production's (React's development build, unminified chunks), so the columns compare structure
— reads, recalculations, observers, listeners — rather than milliseconds.

### What the page was doing under the thumb

On the production build the fling harness already ran at 58.7–60 fps on all four pages, with
no long task and touch handlers of 1 ms or less; the 1 fps reading taken earlier in the day (the
compositor waiting a second per commit) did not recur in nine runs on this machine, and the
three promoted photographs it was attributed to have no box on a phone at all — the desktop
frame grid is `display: none` below 768 px, and the layer tree shows them at 0 × 0. What the
traces did show, per scroll event, was main-thread work that a phone pays four times over:

1. **The section registry measured on every scroll event.** `src/state/sections.ts` called
   `getBoundingClientRect()` on every registered section in a rAF after each scroll — five
   reads on a product page, thirty-five forced style recalculations in four flings on the
   production build — and the read landed after the tickers' writes, so it forced a second
   style pass in the frame. On a coarse pointer the registry now never reads: the observer's
   own rectangles are kept in page coordinates, the scroll position is taken in the scroll
   event (where the listeners before it have already flushed layout), `innerHeight` — itself a
   layout read in Chromium — is cached until a resize, and one ResizeObserver on the body
   remeasures everything, once, when the page's height changes (an accordion opening above the
   rails moved them 187 px; the centre-line 40 px above the rail still read the section above
   it). Pinned chapters keep the live read; there are none on a product page. Verified on the
   homepage: the current section and the chrome's theme agree with the production build at
   every one of its fourteen chapters. `getBoundingClientRect` calls during four flings on a
   product page: **5–6 per scroll frame → 0**.
2. **The gallery's indicator read layout on the track's scroll.** `offsetLeft` of every slide
   and `scrollLeft` of the track, in a rAF per scroll event, with a React `onScroll` listener on
   the track. It is now one IntersectionObserver rooted on the track (thresholds at quarter
   widths), which reports the slide most in view only when it changes; the track has no scroll
   listener, no layout is read, and a vertical scroll of the page — which never moves the
   track's content — costs it nothing. The same observer drives the lightbox's count. The
   concierge's "the second photograph" (`setGalleryFrame`) still lands the frame and the
   indicator follows it (`check.mjs`: 12/12 on the campaign page, 12/12 on the ring, 8/8 on
   the packshot, 11/12 on the bangles — the twelfth asks for a third frame of a two-frame piece
   and is correctly refused).
3. **The rails and the close look hydrated with the page.** Three related rails (nine
   `PieceLink`s, each registering with the visibility observer, a rise reveal per card, a FLIP
   source) and the close look's semantic figure (a ScrollTrigger scrub, a promoted camera, a
   React state per beat) all mounted in the page's first commit and lived through the first
   scroll. They now go through `lazyChapter()` — server-rendered in full, hydrated on approach or
   in the first idle moment — so nothing below the piece's words exists as JavaScript during the
   first fling, and the semantic figure's chunk is fetched only by the ten pages that have a
   descriptor. Measured: at first paint every wrapper is dehydrated; 4 s later all are hydrated;
   the door in a rail still flies (`flip:check` at 390×844, "pdp related piece": landed, 0 px
   off, 527–563 ms flights, three runs).
4. **The frame-rate monitor read `scrollY` once a second from the ticker** — after the tweens'
   writes, so it forced a style pass of its own. It keeps a flag from a passive scroll listener
   instead.
5. **The inspect gestures bound on every device.** `InspectImage` built four `quickTo` setters
   per frame and attached six pointer handlers whether or not a pointer existed. On a coarse
   pointer (or under reduced motion) it now builds nothing and binds nothing; the frame is a
   photograph. (`will-change` was already withheld there by the main session.)
6. **Touch on the track.** `overscroll-behavior-x: contain`, so the last slide never hands the
   gesture to the browser's back swipe, and `touch-action: pan-x pan-y` — explicit, not `pan-x`
   alone: the photograph is most of the first screen and a thumb landing on it must still
   scroll the page.

### What was measured and left as it is

- **Lenis.** On a coarse pointer it is already an observer with an inert `eventsTarget`. Its
  cost on a product page, from the traces: `onNativeScroll` about 0.1 ms per scroll event in
  production; its `raf` inside the GSAP ticker, nothing while no glide runs; the `lenis` /
  `lenis-scrolling` classes toggled on `<html>` once per gesture (the invalidation reaches body
  and the four `[data-lenis-prevent*]` elements, not the tree); and one thing worth a patch —
  `SmoothScroll` bridges every Lenis scroll event to `ScrollTrigger.update()`, and ScrollTrigger
  already listens to the window itself, so each scroll event updates the triggers twice and the
  second read pays a style recalculation the first one's writes made necessary (10 + 18 forced
  recalculations of about 1 ms in four flings on the production build). The bridge is only needed
  where Lenis drives the scroll; on a coarse pointer it can be skipped (patch in the S2J
  report). Removing Lenis from the page altogether needs the nav's `useLenis` subscription
  moved to a native listener (`Nav.tsx`), and was not done here.
- **Tickers alive on a product page:** three — GSAP's own `updateRoot`, the frame-rate
  monitor's `tick`, Lenis's `raf` — none of them touching the DOM at rest. **ScrollTriggers:**
  none on the packshot pages; the close look's scrub on the ten pages that have one (the dev
  server registers it twice on one element under React's development double-mount; production
  writes the camera at the same rate, so it is a dev artefact to confirm in `SemanticFigure`).
  **Observers:** the section registry's, the visibility registry's, one per reveal scope, one per
  gallery track — all IntersectionObservers, all computed by the browser. **Scroll-blocking
  listeners:** none of the site's on the window, the document or the track (`DOMDebugger.
  getEventListeners`); the non-passive `touchstart` on the window in the harness is Playwright's.
- **Growth over five open → scroll → back loops** (`census.mjs`, department → piece → three
  flings → back): ScrollTriggers 0 → 0, tickers 3 → 3, IntersectionObservers 4 → 4,
  ResizeObservers 5 → 5, JS heap 25 → 25 MB, nodes +1 per loop (Next's `<link rel="preload">`
  for each route prefetched, bounded by the routes visited).
- **The lightbox** (production, in isolation): open 25 ms longest task, swipe 13 ms, close
  13 ms, no long task. **The return to the department** (`history.back()` from a piece opened
  through its door): one 608 ms task on the production build — the department grid's own render
  and layout on arrival (157 ms layout, 106 ms style), under the veil. It is the department
  page's cost, not the product page's, and is reported for its owner.
- **Compositor-side**, from the production traces: GPU tasks of up to 30 ms a frame and raster
  tasks of up to 31 ms as photographs come into view, which is the cost of 1080 px frames at
  DPR 2 and the same on every page; a CSS A/B (`ab.sh`) found no single element responsible —
  the nav's backdrop blur is off screen during a downward fling, the packshots' multiply blend
  made no difference, and taking `will-change` off the close look's camera doubled the raster
  work (its scrub then re-rasters every frame), so it stays.

### Before / after, per route and window

Fling harness, four to three flings per page, 390×844 headed unless noted. Production is the
"before"; the dev server is the "after" and is the slower build.

| Page | Before (prod e8c4132) | After (dev server) |
|---|---|---|
| Campaign, 390×844 headed | 59.2 fps, worst 33 ms, 0 over 50 ms | 58.4 fps, worst 50 ms, 0 over 50 ms |
| Campaign, 430×932 headed | 58.8 fps, worst 50 ms | 58.0 fps, worst 50 ms |
| Campaign, 390×844 headless | 59.8 fps, worst 33 ms | 60.0 fps, worst 17 ms |
| Ring, 390×844 headed | 59.9 fps, worst 34 ms | 58.9 fps, worst 50 ms |
| Ring, 430×932 headed | 58.5 fps, worst 50 ms | 59.9 fps, worst 33 ms |
| Bracelet (single), 390×844 headed | 59.4 fps, worst 50 ms | 59.2 fps, worst 33 ms |
| Bracelet, 430×932 headed | 59.9 fps, worst 33 ms | 59.6 fps, worst 50 ms |
| Bangles (two packshots), 390×844 headed | 59.8 fps, worst 33 ms | 59.0 fps, worst 50 ms |
| Bangles, 430×932 headed | 59.7 fps, worst 50 ms | 59.7 fps, worst 50 ms |

Long tasks during the flings: 0 in every run, both builds. Touch handlers: 1 ms or less. The
harness cannot see the difference at 60 Hz on this GPU; the structural table is where the
change is:

| Per fling, campaign page | Before | After |
|---|---|---|
| `getBoundingClientRect` calls per scroll frame | 5–6 (sections) + the slides on a swipe | 0 |
| Forced style recalculations from the section registry (4 flings) | 35 (prod) / 60 (dev) | 0 |
| Scroll listeners on the gallery track | 1 (React `onScroll`) | 0 |
| Layout reads on a swipe of the track | `offsetLeft` × slides + `scrollLeft`, per event | 0 |
| Hydrated at first paint below the piece's words | close look + 3 rails | nothing (markup only) |
| `quickTo` setters and pointer handlers on a phone | 12 + 18 | 0 |
| `scrollY` reads from the ticker | 1 / s | 0 |
