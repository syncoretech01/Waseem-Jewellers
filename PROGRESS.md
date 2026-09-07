# Progress — Waseem Jewellers Stage 1

| Milestone | Status | Verified |
|---|---|---|
| M0 Scaffold | done | 2026-09-07 — `npm i` clean (ESLint pinned to 9.x: eslint-config-next's React plugin is not yet ESLint-10 compatible), typecheck + lint pass, dev server on :3300 with zero runtime errors, canvas + pinned ScrollTrigger + Lenis verified headlessly |
| M1 Assets | in progress | |
| M2 Data + routes | pending | |
| M3 Chrome + concierge shell | pending | |
| M4 Homepage chapters | pending | |
| M5 WebGL | pending | |
| M6 Concierge intelligence | pending | |
| M7 Responsive + tiers | pending | |
| M8 QA + docs | pending | |

## Decisions log
- Port 3300 for the dev server (3000 is used by another project on this machine).
- Display font: Bodoni Moda (variable, opsz). Cormorant Garamond documented as the alternative.
- Heritage copy restricted to facts published on waseemjewellers.com; Urdu accents only for Dewan and Naqsh-e-Gul (visible on the campaign title cards).

## Known upstream notices
- `THREE.Clock: This module has been deprecated` is logged once by @react-three/fiber 9.7 with three 0.185; harmless, upstream.

## Pending verification with the client
- Urdu spellings and meanings of the other collection names.
- Archival photography from the house (none exists online).
