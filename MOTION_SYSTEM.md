# Motion System — Waseem Jewellers (Stage 1)

## Ownership matrix
| Owner | Owns |
|---|---|
| GSAP (`@/lib/motion/gsap`) | scroll timelines, pins, cinematic reveals, route-transition choreography, pointer-driven continuous values (`quickTo` / `quickSetter`) |
| R3F / three | every WebGL scene (isolated `<Canvas>` per scene) |
| Lenis | smooth scrolling only, ticked by `gsap.ticker` |
| Motion (`motion/react`) | nav, dialogs, cards, buttons, discrete micro-states |

**One writer per element per property.** Values touched by two systems go through a numeric proxy with a single writer. Motion never animates `transform` on an element GSAP transforms (Motion lives on child wrappers). `gsap.defaults({ overwrite: false })`; event tweens pass `overwrite: 'auto'` explicitly against non-scrubbed targets.

## Infrastructure
- `src/lib/motion/gsap.ts` — the only GSAP import site (ESLint enforced); registers ScrollTrigger, SplitText, CustomEase and the `wj.out` / `wj.inOut` eases.
- `src/lib/motion/lazyPlugins.ts` — Flip and Observer register on first use.
- `src/components/motion/SmoothScroll.tsx` — `gsap.ticker → lenis.raf(t * 1000)`, `lenis.on('scroll', ScrollTrigger.update)`, `lagSmoothing(0)`.
- `src/state/runtime.ts` — `scrollTo()` is the only programmatic scroll (`force: true`, immediate under reduced motion).
- Providers effect: `history.scrollRestoration = 'manual'`, `ScrollTrigger.clearScrollMemory('manual')`, `ScrollTrigger.config({ ignoreMobileResize, limitCallbacks })`.

## Rules
1. Structure eager, content lazy: pin ScrollTriggers are created on mount with viewport-only `end` values; SplitText, batches, quickTos, tickers and canvases are created at first intersection.
2. Fixed-pin ancestor rule: no transform / filter / perspective / will-change / contain / backdrop-filter / container-type on `body`, `#page-root`, chapter sections or any ancestor of a pin. Recede effects transform `.recede` leaves only.
3. Never `ScrollTrigger.normalizeScroll`; never ScrollTrigger `snap` under Lenis (use `snapWithLenis`).
4. `data-lenis-prevent` on every fixed scroller, `data-lenis-prevent-wheel` on horizontal strips.
5. Every chapter reverts its own `gsap.context`; nothing kills triggers globally.
6. `100svh` for pinned chapters; explicit `aspect-ratio` on every media box (media never triggers refresh).
7. Reduced motion = composed static states with 200–400ms crossfades: no pins, no autoplay, no canvases.
8. Every animation must communicate craftsmanship, materiality, heritage, rarity, discovery, ceremony or depth — otherwise it is removed.

## Chapter timelines
Documented per chapter as they are built (M4 / M5).
