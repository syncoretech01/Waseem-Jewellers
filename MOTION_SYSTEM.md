# Motion System

Stage 1 runs four animation systems in the same page. This document says which one owns what, how they are wired together, and the contracts a chapter or route must honour to sit inside them.

## Who owns what

| System | Owns | Entry point |
|---|---|---|
| GSAP | Scroll timelines, pins, cinematic chapter choreography, route-transition timelines, pointer-driven continuous values (`quickTo` / `quickSetter`) | `src/lib/motion/gsap.ts` |
| Motion (`motion/react`) | Discrete UI states — nav, menu overlay, dialogs, save button, concierge panel and result tray, collection index | imported directly in those components |
| Lenis | Smooth scrolling only. It never animates anything | `ReactLenis` in `src/app/providers.tsx`, bridged by `src/components/motion/SmoothScroll.tsx` |
| R3F / three | Every WebGL surface, each in its own isolated `<Canvas>` with its own frame loop | `src/components/three/craft/CraftScene.tsx`, `src/components/loader/LoaderGem.tsx` |

### One writer per element per property

An element's property has exactly one owner for the life of the page. Where two systems would want the same value, they meet at a numeric proxy that a single writer reads.

- Motion never animates `transform` on an element GSAP transforms; Motion lives on a wrapper, GSAP on the leaf (or the reverse), never both.
- `Ch04Worlds` is the clearest case: five column offsets live as five keys on one proxy object, one tween carries all five when a column is hovered, the scrub drives a `progress` on the same proxy, and one `gsap.ticker` callback is the only code that writes the columns' `y`.
- `Ch02Craft` publishes its scrub progress to `craftProgress` (a plain module object, not React state); the R3F scene reads it in its own frame loop and damps every value there.
- `gsap.defaults({ overwrite: false })`. Event-driven tweens that must cancel a predecessor opt in explicitly with `overwrite: 'auto'` (the menu recede, the `useRise` batch); scrubbed tweens never do.

## The single GSAP module

`src/lib/motion/gsap.ts` is where the `gsap` package is imported and configured for the whole of `src/`. It registers `useGSAP`, `ScrollTrigger`, `SplitText` and `CustomEase`, defines the two house eases, and sets the defaults:

```
gsap.defaults({ ease: 'wj.out', duration: 0.8, overwrite: false });
```

`wj.out` (`M0,0 C0.16,1 0.3,1 1,1`) is the settle of a heavy object coming to rest and is used for every reveal; `wj.inOut` (`M0,0 C0.76,0 0.24,1 1,1`) carries the curtain and other symmetrical travel. Both are created behind a `typeof window` guard and a `CustomEase.get` check, so the module is SSR-safe and idempotent.

The rule is enforced, not merely stated. `eslint.config.mjs` applies `no-restricted-imports` to `src/**/*.{ts,tsx}` — blocking `gsap`, `gsap/all`, `@gsap/react` and the `gsap/*` pattern — and exempts exactly two files: `src/lib/motion/gsap.ts` and `src/lib/motion/lazyPlugins.ts`.

`src/lib/motion/lazyPlugins.ts` holds the two plugins only some surfaces need. `loadFlip()` and `loadObserver()` each memoise a dynamic import and register the plugin on first use. `TransitionLayer` warms Flip on a 1500 ms timer after mount; nothing on the homepage loads Observer since the spatial slider left (16 Sep 2026) — the loader stays for a drag surface that needs it.

Non-GSAP easing lives in `src/lib/motion/easings.ts`: the `EASE` cubic-bezier arrays that the Motion components use, a `DUR` duration scale, and the plain easing functions `expoOut`, `quartOut` and `expoInOut`. `snapWithLenis` hands Lenis `expoOut`; `scrollTo()` uses its own copy of `quartOut` in `runtime.ts`.

Configuration that must run on the client sits in the `Providers` effect, not at module scope:

```
history.scrollRestoration = 'manual';
ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });
ScrollTrigger.clearScrollMemory('manual');
gsap.ticker.lagSmoothing(0);
```

## The Lenis bridge

`ReactLenis` wraps the whole tree in `Providers` with `{ autoRaf: false, lerp: 0.09, smoothWheel: true, syncTouch: false }`. `autoRaf` is off because Lenis must not own a loop.

`SmoothScroll` is the entire bridge:

```
gsap.ticker.add((time) => lenis.raf(time * 1000));
lenis.on('scroll', () => ScrollTrigger.update());
```

One RAF drives the DOM layer: `gsap.ticker` → `lenis.raf` (Lenis wants milliseconds, GSAP's ticker gives seconds) → `ScrollTrigger.update`. There is no second loop anywhere in the DOM layer; chapters that need per-frame work add their own callback to `gsap.ticker` and remove it on cleanup. The R3F canvases run their own loops, deliberately isolated.

`lagSmoothing(0)` is required: with smoothing on, a long frame makes GSAP shorten its delta, Lenis under-integrates, and the page visibly stalls behind the wheel. The cost of turning it off is the stale-clock trap described below.

`SmoothScroll` also publishes the instance to `runtime.lenis`, which is how everything else reaches it.

Scrollable regions inside the page opt out of Lenis by attribute: `data-lenis-prevent` on anything that owns both axes (menu overlay, dialogs, the concierge panel and its transcript, the result tray, the gallery's lightbox strip) and `data-lenis-prevent-wheel` on horizontal strips that must still pass vertical wheel through to the page (the gallery's mobile frame rail, the worn-together rail, the result tray's rail).

`scrollTo()` in `src/state/runtime.ts` is the only sanctioned programmatic scroll. It passes `force: true` so it works while Lenis is stopped (which it always is during a transition), defaults to `quartOut` over 1.4 s, collapses to an immediate jump under the reduced tier, and falls back to `window.scrollTo` / `scrollIntoView` if Lenis is not mounted yet. `stopScroll()`, `startScroll()` and `currentScroll()` sit alongside it.

`src/lib/motion/snapWithLenis.ts` handles settling. ScrollTrigger's own `snap` is never used under Lenis — the two fight over the same scroll position. `snapWithLenis(target)` drives Lenis with `force: true, lock: true` and `expoOut`, holds a module-level flag that `snapLocked()` exposes so pointer and wheel handlers stand back, and releases on `onComplete` or a `duration + 120 ms` watchdog, whichever comes first. A new snap always supersedes an in-flight one.

## The section registry and the `useChapter` contract

`src/state/sections.ts` keeps one `Map` of registered sections. `registerSection(el, id, theme, pinned)` stamps `data-section` and `data-theme` on the element, observes it with a shared `IntersectionObserver` (thresholds `[0, .25, .5, .75, 1]`), adds one passive `scroll` listener for the whole registry, and returns an unregister function.

Evaluation is rAF-coalesced. The current section is the registered element whose rect straddles the viewport centre line; when two qualify — which happens constantly, since a pinned chapter overlaps its neighbours — the one registered with `pinned: true` wins. The winner's id goes to the site store (nav label, chapter index) and its theme is mirrored onto `<html data-theme>` so the chrome inverts with the page. Below the bottom of `#page-root` the fixed footer is what the visitor sees, so the registry reports `footer` and a dark theme.

`useChapter({ id, theme, pinned })` is the hook every chapter and page section uses. It returns `{ ref, ready }`.

**Readiness.** An entry is born `ready: !pinned`. An unpinned section is structurally complete the moment it mounts. A pinned one is not: its pin ScrollTrigger — and therefore the pin spacer that gives the document its real height — does not exist until the chapter's `useGSAP` body has run and chosen a `matchMedia` branch. So every pinned chapter must call `ready()` on every branch it can take: desktop, mobile and reduced alike. `markSectionReady` debounces 80 ms and resolves `sectionsReady()` once every registered entry is ready; the promise is replaced by the first registration into an empty registry, so each route gets a fresh one.

Ordering matters here, and the hook handles it: `useGSAP` runs as a layout effect, so a chapter's `ready()` fires *before* `useChapter`'s own registration effect. `useChapter` records that in a `readyEarly` ref and replays it against the element once registration completes.

**Why it matters.** Scroll restoration is manual (`history.scrollRestoration = 'manual'`, `ScrollTrigger.clearScrollMemory('manual')`). The transition controller restores a remembered offset only after `await Promise.race([sectionsReady(), 1200 ms])`, then calls `scrollTo(saved, { immediate: true })` and `ScrollTrigger.refresh()`. Restoring before the pins exist would scroll into a document several viewports shorter than it is about to become and land the visitor in the wrong chapter. A pinned chapter that forgets `ready()` on one branch degrades every restore on that route to the 1200 ms timeout.

`useFocusScroll(scope, positionFor)` closes the keyboard gap the pins create. Inside a pinned chapter a focused control may be at a scroll position rather than a place on screen, so the chapter supplies a `positionFor` mapping — the worlds map every column to the pin's middle. Without one, the hook falls back to scrolling the element into view when it is off-screen.

## Reveal hooks

`src/motion/hooks/useReveals.ts` holds the shared entrance vocabulary. All four are `useGSAP` hooks scoped to a ref and keyed on `reduced`. Under the reduced tier the three entrance hooks set their targets to the composed state; `useParallax` builds nothing at all, so its elements stay where the layout puts them.

| Hook | Marker | Behaviour |
|---|---|---|
| `useSplitReveal` | `[data-split]` | SplitText with `autoSplit` and `aria: 'auto'`; masked lines / words / chars rise from `yPercent: 110`, once, `start: 'top 85%'` |
| `useMaskReveal` | `[data-reveal]` wrapper, `[data-reveal-inner]` (or the first `img`/`video`) | The wrapper unclips from a directional `inset()`, the inner settles 1.06 → 1 |
| `useParallax` | `[data-parallax="0.2"]` | Scrubbed `yPercent` travel of ±`factor * 40` across the parent's passage |
| `useRise` | `[data-rise]` | `ScrollTrigger.batch` fade-up, 24 px default, `stagger: 0.08`, `overwrite: 'auto'` |

The three entrance hooks consult `landsComposed(el)`, which is true only during a *settled arrival* — the window opened by `markSettledArrival(2500)` in `src/state/runtime.ts` when a back/forward or restored navigation lands at a non-zero offset. Elements already inside the viewport at that moment are set to their finished state (or their tween is jumped to `progress(1)`) instead of playing an entrance the visitor never asked for; everything below the fold still reveals normally.

`settleReveals()` in `transition.ts` is the coarse companion: it walks `ScrollTrigger.getAll()` and, for every `once` trigger already reached, forces the attached animation to `progress(1)` or sets `[data-rise]` triggers directly. It runs twice — immediately and on the next rAF — because a refresh may create triggers between the two passes.

## Route transitions

`src/lib/motion/transition.ts` holds `TransitionController`; `src/components/motion/TransitionLayer.tsx` mounts its three fixed elements once, outside the routed tree, and publishes the controller to `runtime.transition`.

The layer is a single `pointer-events-none fixed inset-0` div at `--z-transition` containing, in order: the **veil** (ink, opacity 0), the **flip layer** (empty host for clones), and the **curtain** (ink, with a hairline and a champagne gradient along its leading edge).

### Choosing a kind

```
kind = REDUCED                                        -> 'veil'
     : opts.kind === 'flip' && sourceEl && HIGH|MEDIUM -> 'flip'
     : opts.kind ?? 'curtain'
```

A `flip` that cannot find an `<img>` with a `currentSrc` inside its source element downgrades itself to `curtain` before the timeline is built.

### The cover half

`navigate(href, opts)` supersedes any flight in progress, increments the epoch, records the new flight, then:

1. writes the current scroll position to `sessionStorage` under `wj:scroll`, keyed by `pathname + search`;
2. calls `stopScroll()`, adds `is-transitioning` to `<html>`, sets `inert` on `#page-root`, and closes the menu;
3. builds one timeline. **Curtain**: `yPercent 100 → 0` over 0.7 s on `wj.inOut`, router push at 0.35. **Veil**: opacity 0 → 1 over 0.35 s, push at 0.2. **Flip**: the source `<img>` is cloned into the flip layer as a fixed element at its exact rect (copying `object-position`), the source is hidden with `visibility`, the veil fades up over 0.6 s, and the clone flies to `getFlipFrame(key)` over 0.9 s with the push at 0.3;
4. awaits the cover timeline's completion. That await is also resolvable from outside through `coverResolve`, so a supersede that kills the timeline does not leave the caller hanging.

`navigate()` returns when the page is covered. `whenReady()` returns a separate promise that resolves when the arrival has finished — or rejects with `SupersededError` if another navigation took over.

### Guards

Two guards decide whether a late callback is still allowed to act.

- **Epoch.** Every flight carries an integer epoch, and every deferred callback — the router push, the forced timer, the arrival timeline's `onComplete`, the async body of `ready()` — re-checks `this.epoch !== epoch` and returns if the number has moved on.
- **Target.** `ready()` compares `window.location.pathname + search` against the flight's recorded target and ignores reports from a page that is not the one being navigated to. A destination that mounts late, after the visitor has already gone elsewhere, cannot lift the curtain on the wrong route.

`supersede()` kills the running timeline, resolves the pending cover await, clears the forced timer, rejects `whenReady()`, removes the clone and restores the hidden source, and leaves the curtain or veil fully covering — so the next navigation starts from a covered page rather than a flash.

### `ready()`

The destination reports its arrival. `ready(flipKey?, targetEl?, force = false)`:

- returns immediately if there is no flight;
- **is force-able**: with `force = true` it skips the target check. Two callers use this — the same-page path and the forced-reveal timer — because in both cases the URL may never match what was recorded;
- **counts once per flight.** `flight.readied` is set on the first accepted report. A FLIP hero image that finishes decoding *after* the 1600 ms fallback in `useFlipTarget` already fired must not restart the arrival.

Once accepted it clears the forced timer, then asynchronously: waits on `Promise.race([sectionsReady(), 1200 ms])`, restores scroll (calling `markSettledArrival()` first if the saved position is non-zero), refreshes ScrollTrigger, runs `settleReveals()` for a restored position, and plays the reveal timeline. **Flip**: the clone flies to the real destination rect over 0.45 s, the destination image's visibility is restored at 0.4, the clone fades and the veil lifts. **Curtain**: `yPercent 0 → -100` over 0.8 s. **Veil**: opacity to 0 over 0.45 s. All three call `startScroll` partway through the reveal, and the `onComplete` removes `is-transitioning`, clears `inert`, drops pointer events on the covers, and resolves `whenReady()`.

### The forced-reveal timer

A 4000 ms timeout is armed with every flight. If it fires it calls `ready(flipKey, null, true)` — the last resort that releases the page even when the URL never matched the target or the destination never mounted a reporter. It is cleared by the first accepted `ready()` and by `supersede()`. A stuck curtain is the one failure this system will not tolerate.

### Same-page query navigations

When the new href has the same pathname as the current one — `/collections/bridal?edit=gold` from `/collections/bridal`, which the menu's Gold and Diamond entries and the concierge's `showGold` / `showDiamond` tool both issue — no destination remounts and nothing will ever call `ready()`. The controller detects this at `navigate()` time and schedules its own forced ready on the cover timeline: 0.55 s for a curtain, 0.35 s otherwise.

### Scroll memory

`wj:scroll` in `sessionStorage` maps `pathname + search` to a scroll offset. It is written on every `navigate()`. It is *read* only when `popPending` is set, which a `popstate` listener does — so a forward navigation to a route you have seen before starts at the top, while a back navigation returns you to where you were. The flag is consumed on read.

### Arrivals that did not go through `navigate()`

`TransitionLayer` watches `pathname` from the site store; a change it did not initiate calls `arrivePlain(pathname)`. That plays the reveal half only: the veil is set opaque, the readiness wait (capped at 1000 ms here) and the same scroll restoration run, and the veil fades over 0.45 s. `arrivePlain` bails if a flight is in progress.

### Call sites

| Helper | Use |
|---|---|
| `TransitionLink` | `next/link` that intercepts plain left clicks (no modifier, no `_blank`) and routes them through the curtain, keeping prefetch. External and `mailto:` / `tel:` hrefs render as plain anchors |
| `useFlipNavigate()` | FLIP when given a source element and key, curtain otherwise; falls back to a router push before the layer has mounted |
| `useOpenProduct()` | `useFlipNavigate` plus recording the opened slug for the concierge and back-link logic |
| `navigateTo(href, { kind })` | Imperative curtain or veil navigation from outside React |
| `useFlipTarget(key)` | Destination side. No-ops unless a flight is in progress; on a FLIP flight it hides the hero image in a layout effect, awaits `decode()` (or a 1600 ms timeout), then calls `ready(key, el)`. Used by `CollectionOpening` and the product `Gallery` |
| `<Arrive />` | Destinations with no FLIP hero (home, 404). Calls `ready()` on mount so the curtain lifts |

## FLIP frames

The clone starts flying before the destination exists, so it needs a destination rect in advance. `src/lib/motion/flipFrames.ts` computes one from the viewport alone:

- `collection-hero` — a centred portrait box, 62 × 82 % of the viewport on desktop, 78 × 70 % below 768 px;
- `product-hero` — gutter-aligned under the 72 px nav, 62 % of the grid at ≥ 1280 px and 55 % below, capped to a 4:5 ratio; full-bleed on mobile.

Destinations size their hero box with the same rules, so the predicted frame is close. `ready()` then absorbs whatever delta remains by flying the clone to the real element's measured rect over 0.45 s before it fades.

## The pointer model

`src/lib/motion/pointer.ts` is one shared, mutable pointer record: raw `x`/`y`, normalised `nx`/`ny` (−1…1 from the viewport centre), velocity, a derived specular `angle`, and the `active` / `fine` flags. `bindPointer()` is idempotent — the first chapter that needs it binds one passive `pointermove` listener for the page. Mouse events only; touch never writes to it.

Nothing in this module touches the DOM. Consumers read it inside their own `gsap.ticker` callback and write through `quickTo` / `quickSetter`: the hero drifts its type ±10 px and counter-drifts its media ±1.2 %, and the craft object turns a few degrees toward it. `pointerIn(el)` gives the same normalised reading relative to a single element.

The custom cursor (`CursorLayer`) is the one consumer with its own listener, because it needs the raw event to hit-test `[data-cursor]` targets. It is fine-pointer only, absent under coarse pointers and the reduced tier, steps aside for a pen or a finger on a hybrid device, and is never a dependency — every target it labels is a real control. Its states and words are in DESIGN_SYSTEM.md, "The cursor".

## Pins

**The fixed-pin ancestor rule.** A pinned ScrollTrigger positions the pinned element `fixed`. Any ancestor carrying `transform`, `filter`, `perspective`, `will-change`, `contain`, `backdrop-filter` or `container-type` becomes its containing block, and the pin silently detaches. So none of those properties appear on `body`, `#page-root`, a chapter `<section>`, or anything between them. When the menu overlay recedes the page it does not scale `#page-root`; it selects the at most two in-view `#page-root .recede` leaves and scales those.

Chapter pins are created eagerly on mount with `invalidateOnRefresh: true` and `end` values expressed as viewport percentages — `+=100%` for the hero (no spacing), `+=155%` for the craft stage (140% on a phone), `+=70%` for the worlds, and `min(110, 50 + 20 × holds)` % for bespoke (110% for its three). Only four chapters pin; the window, the departments, bridal, men and kids, heritage and the concierge invitation are read at the pace of a page. The craft chapter pins an inner stage rather than its section, so the coda beneath it scrolls in when the pin releases. The document height is therefore correct from the first frame. The one piece of content deferred past mount is the WebGL object: `Ch02Craft` mounts `CraftScene` only once its own `IntersectionObserver` (`rootMargin: '100% 0px'`) says the chapter is within a viewport of the visitor. Pinned chapters are measured in `svh`, and every media box carries an explicit `aspect-ratio` so images never change layout on load and never force a refresh.

Every chapter's scroll animation lives inside its own `useGSAP` scope — and, where it branches by viewport, its own `gsap.matchMedia` context — and reverts itself. The one ticker that lives outside a GSAP context (the hero's pointer drift) is removed in its effect cleanup. Nothing kills triggers globally.

## Reduced motion

There are two independent layers, because one of them has to work before any JavaScript has run.

**1. Pre-hydration CSS.** An inline script in `src/app/layout.tsx` stamps `data-rm="1"` on `<html>` when `(prefers-reduced-motion: reduce)` matches, alongside `data-visited` and `data-coarse`. A chapter whose composition is only traversable by scroll would be unreachable if the pin were never built, so `globals.css` gives it a stacked reading order under `html[data-rm="1"]` — no JavaScript involved, and no hydration mismatch possible. Bespoke (`#ch09`) loses its fixed height and overflow and its stage is hidden while its stack becomes the visible layout; `#page-root` drops its `100svh` bottom margin and the footer stops being fixed.

**2. Per-chapter GSAP.** Every pinned chapter's `mm.add()` carries a `reduce: '(prefers-reduced-motion: reduce)'` condition alongside `desktop` and `mobile`, combined with the store's tier:

```
const still = reduce || reduced;
```

The media query is the source of truth — GSAP reverts the other branch when it flips — and the store covers the case where the tier was reduced for another reason. The `still` branch builds no pin, no scrub and no timeline. It sets the composed end state (`Ch02Craft`: the object lit, every label named, one closing note; `Ch04Worlds`: the columns in place, the paper gone) and calls `ready()`. The unpinned chapters have no such branch: the reveal hooks set their targets to the finished state, and the heritage facade's monochrome-to-colour scrub is simply not built.

Beneath that: `MotionConfig reducedMotion="user"` covers every Motion component, `scrollTo()` collapses to an immediate jump, `CursorLayer` does not render, WebGL does not mount (`CraftScene` gives way to a still of the same object, rendered once by `scripts/assets/craft-poster.mjs`), and route transitions use the plain veil. `QualityDetector` follows the media query live, so toggling the OS setting re-tiers the running page.

## Traps we hit

**Tailwind v4's `translate` is not `transform`.** Tailwind v4 compiles `-translate-y-full` to the independent `translate` CSS property, which composes *on top of* `transform` rather than being part of it. GSAP writes `yPercent` into `transform`. A translate utility on the curtain therefore adds a viewport of offset to whatever GSAP is animating, and the curtain covers the wrong thing. The curtain carries no translate utility at all; its off-screen start is `gsap.set(curtain, { yPercent: 100 })` in `TransitionLayer`'s layout effect, and GSAP is the only writer of that transform. The cursor uses the same fact deliberately in the other direction: the bead's centring lives in Tailwind's `translate` while GSAP's `quickTo` owns `transform`, and the label — whose `xPercent` GSAP must flip when it crosses the right edge — carries no utility and is positioned entirely by `gsap.set(label, { xPercent: 0, yPercent: -50 })`.

**Composite properties do not survive `quickTo`.** `quickTo` caches one reusable tween per named property and needs that property to be a single number. Shorthands such as `scale` are not — GSAP expands them into `scaleX` / `scaleY`, and the cached tween ends up writing something the next call cannot update. `InspectImage` therefore keeps two `quickTo`s, on `scaleX` and `scaleY`, behind a small `s(v)` helper that calls both. (`quickSetter('scale')` is fine — the trap is specific to `quickTo`.)

**GSAP's clock goes stale during the hydration stall.** With `lagSmoothing(0)` — which Lenis requires — GSAP does not clamp a long frame's delta. Hydration is a long frame. A tween created during it inherits a clock already hundreds of milliseconds behind and jumps most of the way through on its first tick. The loading ritual is therefore not built in the mount effect: it is built inside `gsap.ticker.add(fn, true)`, on the tick *after* mount and after GSAP's own root update, with `lagSmoothing(500, 33)` switched back on for the duration of the ritual and restored to `0` at the hand-off. Scrolling is frozen throughout, so the smoothing has nothing to interfere with.

**`overwrite: true` in a loop kills its own siblings.** `overwrite: true` kills other tweens *of the same target*, not merely of the same property. `Ch04Worlds` eases five column offsets that live as five keys on one proxy object; five overwriting tweens created in a loop meant each one killed the four before it and only the last column moved. The fix is one tween carrying all five keys.

## Not in Stage 1

Chapter-by-chapter timeline reference tables, and any route-transition vocabulary beyond curtain / FLIP / veil, are Stage 2.

## Semantic figures — motion that teaches

`src/semantic/` is the one place in this project where motion is asked to explain the
jewellery rather than to present it. It exists because of a fact about the photography:
Waseem has **one high-resolution frame per piece**. `p03-hero`, `p03-macro` and `p03-detail`
are not three photographs; they are three `derive.crop` rectangles of a single 4500px source,
cut by sharp at build time. So what exists is one picture containing every named part as a
region — and that decides what can honestly be built.

**Terminology is a correctness rule, not a style preference.** Where an interaction only moves
attention between regions of a finished photograph, nothing — code, copy, labels, docs — may
describe it as how a piece was *constructed*, *assembled* or *put together*. It is composition,
not process. No process imagery exists (no band before its stone, no empty setting), so that
vocabulary would be describing something nobody has photographed. `scripts/dev/copy-guard.mjs`
enforces it alongside the "House" rules.

| Family | What it does | What it claims | Where |
|---|---|---|---|
| `craft-detail` | attention travels to named regions of one frame and holds | these rectangles are parts of this photograph | Bridal, the choker beside the suite (Pearl Blossom Choker); PDPs |
| `composition` | the same mechanism at the scale of a suite — tikka, earrings, choker, haar named in place | the same, one scale up | Bridal, the suite that opens the chapter (Rang-e-Jamal emerald suite) |
| `goldwork` | the scale ladder — collar, pendant, earring, nearer each time | this is the same picture, nearer | Gold, closely — the figure that closes the gold chapter (the gold Rang-e-Jamal set); PDPs |
| `setting` | the anatomy of one setting as photographed — stone, halo, shank | these are the parts of this setting, where they sit | the craft coda (Lavender Halo Ring) |
| `pair` | the two of a pair across one frame — crowns, bells, drops — and the pull-back side by side | the right earring is the right earring; nothing is mirrored | Bespoke (Emerald Tassel Earrings) |

Five families, one mechanism. Ring anatomy from teardown photography, layering compositors and
loose-stone setting sequences were all considered and all rejected for the same reason: each
needs the jewellery shown in a state it was never photographed in. The drawn ring in CH02 stays
what it is — a drawing — and the coda beneath it answers with the photograph.

**Two kinds of rectangle live in `src/data/semantic.ts`.** The first kind is one Stage 1 already
cut, published and reviewed (`reviewed: true`). The second was placed by looking at the
photograph and naming what is plainly in it — the four claws on a ring, the two crowns of a pair
— and carries `reviewed: false` until Waseem confirms the naming; `AWAITING_REGION_SIGN_OFF`
lists them by name. No note says anything the photograph and the published specification do
not already support. There is still no family that scales without a person writing about the
jewellery, which is why the file covers nine pieces rather than six hundred; a piece with no
descriptor shows its photograph, as before.

**A figure is a door.** On the homepage every figure sits inside a `PieceLink` (its `figure`
slot), so looking closely and opening the piece are one gesture, and the FLIP flies from the
figure's own image (`flipSource`). The piece's name and published facts stand beneath it.

**One writer, structurally.** The camera element's `transform` is composed as a single string
by one callback in `SemanticFigure`; there is no second setter and no Tailwind `translate` or
`scale` utility anywhere near it. Labels are lit with `data-lit` and faded by CSS transitions,
and GSAP never touches them.

**Fidelity is resolved, not guessed — and the camera is capped by the negative.** `resolveFigure`
reads `gsap.matchMedia`'s `reduce` condition — the media query, not the quality store — and
drops any region under 420 source pixels on its shorter side. How close the camera goes is then
decided per region against the box's real rendered width: `honestScale` is the smaller of the
scale that fills the box and the scale at which the region's source pixels equal the screen
pixels they are shown across (never more than 3.2×). So no region is ever magnified past its own
pixels, whatever the display. LOW tiers and coarse pointers (`reduced`) move the camera but cap
it at 1.35×. A family that cannot be supported does not render as a degraded family: the caller
shows its ordinary image, and there is no broken lesson.

**The static form is the acceptance test.** With motion removed, `StaticSequence` shows each
region as its own frame with the same words. If the lesson does not survive that, the lesson
was the camera move — which is spectacle wearing a caption.

**No pin of its own.** Left alone, a figure reads as it travels through the viewport — a pinned
figure inside a product page would fight the sticky information column. A chapter that owns a
pin passes `driven` and calls `apply(progress)` on the figure's handle from its own scrub, so
the holds sit inside the chapter's choreography (Bespoke does this; its words are lit in step
through `onLit`).
