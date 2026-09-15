# The Waseem Jewellers mark

## What the mark is

A vertical lockup in gold on transparent, in three parts:

1. **The crest** — a circular knotwork medallion: a broken outer ring with inward-curling
   volutes ending in round eyes, a four-point star at each shoulder, a pointed vesica at
   twelve o'clock, an interlaced **triquetra** with a centre dot, and a spearpoint finial
   at six o'clock.
2. **The ligature** — a thin-stroke didone **WJW**, two W's flanking a J whose stem
   descends between them and hooks left.
3. **The wordmark** — **WASEEM JEWELLERS**, two lines of geometric caps, wide tracked.

Its gold is a *horizontal metallic sweep*, not a vertical ramp: a specular peak at about
29% of the width and a trough at about 73%. Those stops are sampled from the artwork in
`src/components/brand/gold.ts`, so the site's mark is the colour Waseem already uses.

## Where it came from, and the one thing to know

**There is no vector master.** The best artwork that exists anywhere is a **999 × 291**
transparent PNG, in which the crest is only **73 pixels wide**. This was established, not
assumed:

- `https://www.waseemjewellers.com/cdn/shop/files/waseem-logo.png?width=2000` returns a
  file byte-identical to the unparameterised one — Shopify has no larger original.
- The three house films were checked frame by frame. Their opening logo cards render the
  lockup at roughly 245–310px tall against the master's 271px, so they are **not** a
  better source.

The master is committed at `scripts/brand/master/waseem-logo.png` so the pipeline runs
from a fresh clone.

> **Open request to Waseem — the highest-value asset in Stage 2.** The original
> **AI / EPS / SVG / print-ready PDF**. It would replace the reconstruction below with the
> real thing and remove every caveat on this page.

## How the digital mark was made

Traced, not redrawn. Reconstructing Celtic knotwork by hand from a 73px source risks
exactly what the brief forbids — redesigning the identity into something adjacent — so the
pipeline follows Waseem's own geometry and only simplifies how it is expressed.

```
npm run brand          # build + check
npm run brand:build    # extract → assemble → icons
npm run brand:check    # the fidelity gate + review sheet
```

| Stage | File | What it does |
|---|---|---|
| 1 | `scripts/brand/extract.mjs` | Cuts the master into its four bands and upscales each 8× as a black-on-white matte. The shape lives in the **alpha** channel; tracing colour would trace the gradient. Re-measures the band boxes every run, so drift in the master is visible. |
| 2 | `scripts/brand/trace.mjs` | potrace → cubic Béziers. An **underlay**, never the deliverable. |
| 3 | `scripts/brand/assemble.mjs` | svgo at integer precision, splits each band into silhouette + counters, emits the geometry modules. |
| 4 | `scripts/brand/icons.mjs` | `icon.svg` and `apple-icon.png`, from the authored mark. |
| — | `scripts/brand/verify.mjs` | The fidelity gate and the review sheet. |

Coordinates are **integers in 8× master-pixel space** (1 unit = ⅛ of a master pixel), so
every variant shares one geometry and no float reaches the bundle.

### Measurements behind the choices

- **Threshold 128 is optimal, and was measured, not guessed.** It reproduces the master's
  native ink coverage to within 0.1%. Higher thresholds thin the strokes and cost fidelity
  (t=160 drops ink-IoU from 0.973 to 0.926). Thresholding at native resolution before
  upscaling is far worse (0.90) — it discards the sub-pixel information in the alpha.
- **Node count is inherent, not tracer noise.** Across the whole potrace parameter space
  the crest never falls below ~416 nodes while IoU stays flat at ~0.973. The knotwork
  genuinely has that many segments. svgo then halves it losslessly (2231 → 1022 total).
- **The mark is one filled shape with holes**, not a set of strokable lines. That decides
  how it animates: the same geometry is stroked with `fill="none"` so every contour draws
  itself — the interior linework is what makes it read as engraving rather than a traced
  silhouette — and light travels through the gradient. Sub-groups are not separately
  fillable without destroying the counters.

## Fidelity

`npm run brand:check` measures two things, because one is not enough:

- **ink-IoU** — the shape. Catches drift in the geometry.
- **hole-IoU** — the negative space. Catches the failure ink-IoU hides: a trace can dilate
  strokes until fine gaps close and still score well, because closed gaps offset shrunken
  tips.

| Band | ink-IoU | gate | hole-IoU | gate | mean \|Δα\| |
|---|---|---|---|---|---|
| crest | 0.9633 | 0.95 | 0.9708 | 0.96 | 2.34% |
| monogram | 0.9743 | 0.96 | 0.9916 | 0.97 | 0.80% |
| word-1 | 0.9671 | 0.955 | 0.9747 | 0.96 | 1.62% |
| word-2 | 0.9792 | 0.97 | 0.9864 | 0.97 | 1.28% |

Gates are **calibrated from measurement, not assumed** — the numbers the faithful trace
achieves at the size it ships, with headroom so a regeneration nudge passes but real drift
fails. Node ceiling 1100 (currently 1022).

### The gate is necessary, not sufficient

A mark can pass both metrics and still read wrong. During this work the automated gate
passed while the mark still looked heavy under magnification — the investigation showed the
geometry was faithful (ink coverage 46.9% against the master's 46.9% in the region under
suspicion) and that the apparent weight came from comparing a soft antialiased raster
against a crisp vector, which is a rendering difference rather than a defect. **Only looking
settled it.**

So `brand:check` also writes a review sheet:

- `.cache/brand/verify/review-sheet.png` — master beside reconstruction at 1×, 6× and 14×,
  each rendered the way it is actually seen
- `.cache/brand/verify/review-sizes.png` — the crest at 16/20/32/48/64/128px
- `.cache/brand/verify/diff-*.png` — red = master only, green = ours, gold = agreement

**The reconstructed mark is not the production identity until a person has reviewed that
sheet and signed off here.**

| Reviewed | By | Verdict |
|---|---|---|
| _pending_ | _Waseem_ | _—_ |

**Known honest difference:** the reconstruction is marginally bolder than the master at
large magnification, because the master is soft antialiased artwork whose faded edges read
as shadow, while a vector renders its full extent crisply. At the sizes the mark is
actually used (20–128px) the two are near-indistinguishable, and the vector is sharper.

## Using it

```tsx
import { WaseemMark } from '@/components/brand/WaseemMark';
import { WaseemLockup } from '@/components/brand/WaseemLockup';

<WaseemMark variant="crest" tone="current" className="h-6 w-auto" />
<WaseemLockup tone="ink" className="h-28 w-auto" />
```

`WaseemMark` covers `crest`, `monogram` and `crest-monogram`. `WaseemLockup` adds the
wordmark and lives in its own module, because the letterforms are ~10 kB of path data that
only the full lockup needs — this keeps them out of every chunk that only shows the mark.

`tone`: `gold` (the sampled sweep) · `current` (inherits `currentColor`, so the mark follows
a chapter's theme) · `ink` · `ivory`. `title` names the mark for assistive technology;
`null` marks it decorative. `animatable` inlines addressable `data-mark` groups plus a
stroked twin of the linework and a travelling specular band; `drawWeight` (default 12,
matching the artwork's own stroke) sets the engraved line's weight.

The draw and specular layers ship at `opacity: 0`, so the static mark is correct on its own
— under reduced motion no timeline ever runs.

Only the crest and the ligature engrave. A word band is set type, not linework: its largest
contour is just its widest letter, so drawing it would trace a stray W. The wordmark rises
instead.

### The loading ritual

Waseem's mark is server-rendered, but the timeline that draws it cannot run until React has
hydrated. Showing the finished mark and then resetting it to draw reads as a fault, so the
waiting state — set in `globals.css` on `#loader:not([data-built])` — is the **engraved
outline**: the brand is present from the first paint and the ritual completes it. The crest
fills, the ligature follows, the two lines of type rise, and a band of light travels through
the gold. Under reduced motion the finished mark simply fades in and `getTotalLength()` is
never called.

### Where it appears

| Place | Variant | Why |
|---|---|---|
| Nav | `crest`, 24px, `current` | The crest alone is legible at nav scale and follows the chapter theme; the ligature turns to mush below ~20px. Three rules of behaviour: it never floats over a photograph — once the page has moved beneath it the nav brings a surface in the chapter's own paper or ink; nothing sits in the nav band beneath it — chapter eyebrows begin below `--nav-h`, and a department masthead names the place, not the brand; and it is the crest alone — the wordmark is set in type beside it only on the hero, before the page has moved. |
| Footer | `crest`, 32px, gold | The name is already set in type beside it — the crest completes the pair without saying it twice. |
| Heritage watermark | `crest`, `ink`, 5% | A crest reads at 5% opacity; a full lockup does not. |
| Heritage seal | `lockup`, `ink` | A seal should be the true lockup. |
| Favicon / app icon | `crest` | Generated from the authored mark by `icons.mjs`. |

## Rules

- **Never hand-edit `markGeometry.ts` or `wordmarkGeometry.ts`.** They are generated;
  change the pipeline and re-run `npm run brand`.
- No Tailwind `translate-*` or `scale-*` class on any `[data-mark]` element — Tailwind v4
  emits an independent `translate` property that fights GSAP transforms.
- The mark is always drawn with `fill-rule="evenodd"`; without it the counters fill in.
- Under `prefers-reduced-motion` the mark never draws — it renders finished and fades.
