# Waseem Jewellers — Digital Flagship · Stage 1

A high-fidelity local prototype of the next-generation Waseem Jewellers experience: the complete cinematic homepage, the Bridal House collection route, a reusable product experience, full-screen navigation, and the Waseem Concierge (chat + voice) — all running locally without any credentials.

## Requirements

- Node.js 22 or newer (developed on Node 24) and npm.
- A modern browser (Chrome, Edge, Safari 16.4+, Firefox 111+).
- ffmpeg is only needed if you regenerate the media (`npm run assets`); it is not needed to run the site.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3300.

## What to try

- The loading ritual, then the homepage chapters: hero, craft object, 1952, the collection worlds, bridal cinema, the jewellery wall, the spatial slider, Gold / Diamond, bespoke, footer.
- MENU (top right) for the full-screen navigation.
- `/collections/bridal` — the Bridal House, and any piece from it, e.g. `/jewellery/lavender-halo-ring-r11912`.
- The Waseem Concierge: the invitation in the hero, or the jewel at the bottom right. Try "Show me bridal necklaces", "Open the second one", "Save this piece", "Book a private consultation", "Take me to bridal", "Tell me about Waseem".
- Voice: press the mic. Speech recognition is used where the browser offers it; otherwise "Let me show you" plays a spoken example. Everything works with the microphone denied.
- Reduced motion (OS setting) and mobile widths are supported.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | development server on port 3300 |
| `npm run build` / `npm start` | production build / server |
| `npm run typecheck` / `npm run lint` / `npm run check` | verification |
| `npm run assets` | regenerate localised media from the manifest (needs ffmpeg + network) |

Development-only: `?tier=high|medium|low|reduced` forces a quality tier; `node scripts/dev/shot.mjs <url>` inspects a page headlessly.

## Media

Originals live in `media-originals/` (git-ignored, preserved untouched). Localised, optimised media is committed under `public/assets/waseem/`. See `ASSET_MANIFEST.md` for every file, its source and anything that could not be localised.

## Environment

None required. `.env.example` documents the variables reserved for the future OpenAI Realtime concierge; the default provider is the keyless mock.

## Documentation

`DESIGN_SYSTEM.md` · `MOTION_SYSTEM.md` · `SITE_ARCHITECTURE.md` · `CONCIERGE_ARCHITECTURE.md` · `ASSET_MANIFEST.md` · `PERFORMANCE_BUDGET.md` · `PROGRESS.md`
