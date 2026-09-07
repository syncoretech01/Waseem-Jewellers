# Site Architecture — Waseem Jewellers (Stage 1)

## Stack
Next 16.3 (App Router, Turbopack) · React 19.2 · TypeScript 5.9 · Tailwind 4 · three 0.185 + R3F 9.7 + drei 10.7 · GSAP 3.15 · Lenis 1.3 · Motion 13 · Zustand 5. npm only. `npm run dev` → http://localhost:3300.

## Routes
| Route | Notes |
|---|---|
| `/` | homepage chapters CH00–CH10 |
| `/collections/[slug]` | SSG; only `bridal` exists in Stage 1 (`notFound()` otherwise) |
| `/jewellery/[slug]` | SSG from `src/data/products.ts` |
| `/api/concierge/realtime-token`, `/api/concierge/tool` | 503 stubs reserved for the future OpenAI Realtime provider |

Query state (`?world=`, `?edit=`, `?material=`) is published by `RouteTracker` as `{ pathname, search, navEpoch }`; experiences derive their state from the store, never from a one-time `window.location` read.

## Providers (`src/app/providers.tsx`)
QualityDetector → GSAP configuration → ReactLenis → SmoothScroll · RuntimeBridge · RouteTracker · StoreHydrator → `#page-root` → persistent chrome (Footer, TransitionLayer, Nav, Menu, Concierge, Selection ledger, Consultation modal, Loader, Cursor).

## State (`src/state/`)
- `siteStore` — route / section / product context, wishlist (persisted as `wj:selection:v1`, hydrated after mount), chrome flags, one-shot requests (spotlight, pending section, duality bias).
- `conciergeStore` — 11-state FSM with a legal-transition table, turns, results, transcript.
- `qualityStore` — tier (HIGH / MEDIUM / LOW / REDUCED), DPR cap, orb renderer.
- `runtime.ts` — imperative handles (Lenis, transition, router) + `scrollTo()`.
- `sections.ts` — section registry, centre-line current section, theme mirroring, `sectionsReady()`.
- `visibility.ts` — visible-product registry in reading order.

## Data (`src/data/`)
Hand-authored content (`products.ts`, `collections.ts`, `worlds.ts`, `heritage.ts`, `menu.ts`, `site.ts`, `copy.ts`); assets referenced by id from the generated `generated/asset-map.ts`. Adding a product or a collection is data-only.

## Assets
`scripts/assets/manifest.mjs` → `encode-videos.mjs` (ffmpeg) + `localize.mjs` (sharp) → `public/assets/waseem/**` (committed) + `ASSET_MANIFEST.md`.

## Deferred (Stage 2+)
Authentication, accounts, checkout, payments, order history, full catalogue, Shopify integration, CMS, admin, store locator, blogs, analytics, live OpenAI integration, appointment backend, sitemap / robots / JSON-LD.
