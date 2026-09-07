# Design System — Waseem Jewellers (Stage 1)

Living document, updated at the end of every milestone.

## Intent
Heritage, craftsmanship, rarity, materiality, intimacy, ceremony, desire, prestige, Pakistani luxury, timelessness. Never a Shopify template, SaaS, tech demo, gaming site or black-and-gold cliché.

## Palette (`src/app/globals.css` → `@theme`)
ink `#0B0A09` · charcoal `#161412` · ivory `#F4EFE6` · pearl `#EDE6D8` · champagne `#D8C3A5` · gold `#A8894F` · gold-hi `#E4CFA3` · gold-deep `#6E5527` · burgundy `#5A1F2B` · emerald `#12463A` · lilac `#B9AFC9` (Dewan world only).

**Gold is a material or a light source, never a flat fill.** Use `--gold-metal`, `--gold-conic`, `--gold-hairline`. The `text-gold` utility is reserved for the monogram and the consultation reference; the `sheen` animation never runs on type.

## Themes
Semantic tokens (`--bg --bg-2 --fg --fg-2 --fg-muted --line --line-strong --accent --accent-text --veil --surface`) flip under `[data-theme="dark"|"ivory"]` on chapter roots and are exposed to Tailwind utilities through `@theme inline` (`bg-bg`, `text-fg`, `border-line`, …). The chrome mirrors the active chapter through `<html data-theme>` (section registry). Ivory swaps accent text to burgundy because gold on ivory fails contrast as text.

## Typography
- Display: **Bodoni Moda** (variable, opsz 6–96, italics). `display` utility = opsz 96, weight 400, leading 0.92. Italics carry mood lines and ledes.
- UI: **Instrument Sans** (variable). `eyebrow` = 12px, tracking .18em, uppercase; `micro` = 11px, tracking .24em.
- Accents: **Noto Nastaliq Urdu**, only for verified names (دیوان Dewan, نقش گل Naqsh-e-Gul). `lang="ur" dir="rtl"`, line-height ≥ 2.
- Scale: display-xl `clamp(4.25rem, 1.5rem + 11.5vw, 15rem)` · display-l `clamp(3rem, 1.25rem + 6.5vw, 8.5rem)` · display-m `clamp(2.125rem, 1.25rem + 3.25vw, 4.75rem)` · heading · lead · body 17px · caption 12px · micro 11px. Functional text never below 11px.

## Spacing, easing, layers
`--spacing-gutter` clamp(1.25rem, 4vw, 4.5rem) · `--spacing-section` clamp(6rem, 12vw, 14rem) · measure 34em.
`wj.out` cubic-bezier(.16,1,.3,1) for reveals · `wj.inOut` / `expo.inOut` for travel · `power3.out` for pointer following. Durations: micro .3–.45s, component .6–.9s, cinematic 1.2–1.8s.
z ladder: chapter 1 · chapter-ui 5 · nav 20 · orb 40 · ledger 50 · menu 60 · concierge 70 · modal 75 · transition 80 · loader 90 · cursor 100.

## Materials
`grain` (tiled 256px PNG overlay, opacity .035), `vignette`, `hairline`, `rule`. Every video surface carries grain + vignette so 720p footage reads as film, not compression.

## Copy register
No exclamation marks, superlatives, "shop now", or consumer-facing demo/prototype/mock language. Heritage facts only as published on waseemjewellers.com. No general karat or grade claims; per-piece specs only from that piece's data.
