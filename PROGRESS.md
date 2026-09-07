# Progress — Waseem Jewellers Stage 1

| Milestone | Status | Verified |
|---|---|---|
| M0 Scaffold | done | 2026-09-07 — `npm i` clean (ESLint pinned to 9.x: eslint-config-next's React plugin is not yet ESLint-10 compatible), typecheck + lint pass, dev server on :3300 with zero runtime errors, canvas + pinned ScrollTrigger + Lenis verified headlessly |
| M1 Assets | done | 2026-09-07 — `npm run assets`: 48 images (19.3 MB) localised with blur placeholders, 5 clips encoded in 1280 / 720 / portrait variants with posters (31.2 MB; the 25 MB figure stays a target, not a blocker), watermark cropped from the menu ambient, asset map + `ASSET_MANIFEST.md` generated, 0 undocumented failures |
| M2 Data + routes | done | 2026-09-07 — 10 products, bridal collection (8 pieces, 4 chapters), 5 worlds, heritage set, menu, site facts; `/jewellery/[slug]` and `/collections/bridal` render with mask reveals, Nastaliq accent, PRICE ON REQUEST on 8 / `Rs.` on 2, 404 route; refresh on deep links and `?edit=` soft navigation verified |
| M3 Chrome + concierge shell | done | 2026-09-07 — nav (wordmark → monogram, SELECTION count, ASK, MENU/CLOSE above the menu), full-screen menu with ambient clip and hover media, cursor bead with side-aware labels, curtain + FLIP transitions (collection → product, product → product), back/forward arrival at the saved position with reveals landing composed, fixed footer reveal, selection ledger (persisted), consultation modal (success + reference), concierge jewel / unfolding panel / editorial transcript / composer / voice stage / result tray / compact ticket, all 11 states previewable via `?concierge=STATE`; commands verified end to end: search → tray, ordinal open → FLIP, ENQUIRE → specs reply, scripted "Let me show you" on desktop and mobile, microphone denied → on-brand message; menu ×6 and concierge ×6 open/close loops leave trigger and tween counts steady; zero console errors on every page |
| M4 Homepage chapters | pending | |
| M5 WebGL | pending | |
| M6 Concierge intelligence | pending | (mock command table, tools, voice adapters and TTS already in place from M3; M6 completes the command matrix, spotlight consumption and the WebGL orb hand-off) |
| M7 Responsive + tiers | pending | |
| M8 QA + docs | pending | |

## Decisions log
- Port 3300 for the dev server (3000 is used by another project on this machine).
- Display font: Bodoni Moda (variable, opsz). Cormorant Garamond documented as the alternative.
- Heritage copy restricted to facts published on waseemjewellers.com; Urdu accents only for Dewan and Naqsh-e-Gul (visible on the campaign title cards).
- Manifest crops are `[x, y, w, h]` fractions of the source (the monogram crop was corrected to the crown + WJW mark).
- Concierge results always step the panel aside (desktop: compact ticket beside the jewel; mobile: the jewel carries the last line as a fading caption) so the tray is never hidden behind the sheet.
- After a scripted example the microphone never auto-resumes; auto-resume only follows a real spoken turn.
- Spoken cadence for streamed replies applies only when the reply is actually voiced (spoken replies on and synthesis available); otherwise words arrive at reading pace.
- On back/forward and deep-link arrivals at a saved scroll position, once-only reveals already reached land in their composed state beneath the lifting veil instead of replaying.

## Known upstream notices
- `THREE.Clock: This module has been deprecated` is logged once by @react-three/fiber 9.7 with three 0.185; harmless, upstream.
- In development, the router's fetch on back/forward can take up to a second before the destination mounts; the arrival veil covers it (the wait is bounded at 1 s). Production builds are faster.

## Pending verification with the client
- Urdu spellings and meanings of the other collection names.
- Archival photography from the house (none exists online).
