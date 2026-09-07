# Performance Budget — Waseem Jewellers (Stage 1)

Budgets are targets, not blockers. Mandatory for Stage 1: no obvious jank, no memory leaks (ScrollTriggers, ticker functions and GL resources steady across route changes and concierge cycles), no broken responsive behaviour.

| Target | Value |
|---|---|
| Base route JS | ≤ 170 kB gz |
| three + R3F + drei chunk | ≈ 220 kB gz, loaded once, never on REDUCED |
| Homepage first load | ≤ 400 kB gz including three |
| Images | ≤ 2000 px webp (2880 px for full-bleed roles) |
| Video | ≤ 25 MB total, muted, faststart |
| CLS | 0 (aspect boxes + blur placeholders) |

## Tiers
REDUCED (prefers-reduced-motion) · LOW (coarse pointer, saveData, ≤ 4 GB, < 768px, software GL) · MEDIUM (integrated GPU or small max texture) · HIGH. DPR caps 1.75 / 1.5 / 1 / 1. Development override: `?tier=high|medium|low|reduced`.

## Rules
Animate only transform / opacity / clip-path / custom properties; one RAF (`gsap.ticker`) for the DOM layer; isolated canvases with demand / never frameloops, disposed on unmount; `backdrop-filter` only on the concierge panel (HIGH, idle) and the modal veil; `window.__wj` (development only) reports triggers, tweens and GL memory.
