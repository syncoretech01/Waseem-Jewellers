# Design System — Waseem Jewellers

Everything in this document is declared in `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/*`, `src/components/media/*`, `src/components/chrome/Monogram.tsx` and `src/concierge/orb/*`. Motion (GSAP, Lenis, ScrollTrigger, the transition layer) is documented separately in `MOTION_SYSTEM.md`.

Tailwind v4 reads the tokens directly from `globals.css` — there is no `tailwind.config`. `@theme` tokens generate utilities (`bg-ink`, `text-champagne`, `px-gutter`, `text-display-m`); `:root` tokens do not, and are used through `var()`.

---

## 1. Palette

Declared in `@theme`, so each is available as a Tailwind colour utility (`bg-ink`, `text-ivory`, `border-champagne`, …).

| Token | Value | What it is for |
| --- | --- | --- |
| `--color-ink` | `#0b0a09` | The dark ground. `<html>` background, `#page-root` background, the viewport theme colour, the selection text colour. |
| `--color-charcoal` | `#161412` | The second dark surface — a plane lifted off ink without a border. Also the secondary foreground on ivory. |
| `--color-ivory` | `#f4efe6` | The light ground and the foreground on dark. |
| `--color-pearl` | `#ede6d8` | The second light surface, and the tile that packshots multiply into (see `Img`). |
| `--color-champagne` | `#d8c3a5` | Secondary foreground on dark; the source of `--line` / `--line-strong` in the dark theme. |
| `--color-gold` | `#a8894f` | Mid gold. Selection background, the accent in the ivory theme, a stop in the metal gradients. Not used as flat text on dark. |
| `--color-gold-hi` | `#e4cfa3` | The light of gold: focus outlines, the hairline core, the concierge glow, `--accent` on dark. |
| `--color-gold-deep` | `#6e5527` | The shadow of gold: the darkest stop in the metal gradients, and the scrollbar thumb. |
| `--color-burgundy` | `#5a1f2b` | Error and refusal (field errors, the concierge `ERROR` tint), and `--accent-text` on ivory. |
| `--color-emerald` | `#12463a` | The Rang-e-Jamal accent. |
| `--color-lilac` | `#b9afc9` | The Dewan accent. |

Burgundy is the state colour and never decorates chrome. Emerald and lilac are world colours: the tokens are the record of the value, and the world palettes in `src/data/worlds.ts` carry the same hex inline (`accent: '#12463a'` for Rang-e-Jamal, `accent: '#b9afc9'` for Dewan). Neither token is used as a utility anywhere.

---

## 2. Gold is light, not a fill

Gold in this house is a material catching light, so it is authored as gradients on `:root`, never as a flat paint bucket.

| Token | Shape | Used by |
| --- | --- | --- |
| `--gold-metal` | `linear-gradient(105deg, …)` across gold-deep → gold → gold-hi → `#b8975a` → `#f1e2bf` → `#8a6d3a` | The `text-gold` utility. |
| `--gold-conic` | `conic-gradient(from 210deg, …)` through five stops, gold-deep → gold-hi → gold → `#f1e2bf` → gold-deep | The concierge bezel (which repeats the gradient literally in `.wj-orb-bezel`). |
| `--gold-hairline` | `linear-gradient(90deg, transparent, gold-hi 40%, #f1e2bf 50%, gold-hi 60%, transparent)` | The `hairline` utility. |

**`hairline`** sets `height: 1px` and that background. It sets no width and no position, so callers supply those. The house pattern is a 1px span pinned to an edge, drawn on interaction:

```tsx
<span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left scale-x-0
  transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/btn:scale-x-100" />
```

That figure appears on the `hairline` Button variant, the nav selection, `SaveButton` and the collection index rows; `PieceLink` runs the same span along its top edge. `ChoiceRow` and the menu overlay use the same draw driven by selection rather than hover. `<Hairline />` in `src/components/ui/primitives.tsx` is the static full-width version.

**`text-gold`** paints `--gold-metal` at `background-size: 220% 100%` and clips it to the glyphs. It is for one short string. In Stage 1 it is used exactly once — the consultation reference number on the success panel of `src/components/commerce/ConsultationModal.tsx`, which is an ivory dialog, so the gradient carries its own dark stops rather than relying on the ground. It is never used for running text, and the `sheen` keyframe is never run across type.

Two cautions:

- `text-gold` is the gradient utility and shares its name with the flat colour utility Tailwind would generate from `--color-gold`. Do not reach for `text-gold` expecting flat `#a8894f`. For gold-toned flat text use `text-gold-hi`, `text-champagne` or the semantic `text-accent`.
- Flat gold as text on ivory fails contrast, which is why the ivory theme sets `--accent-text: var(--color-burgundy)`.

---

## 3. Theme system

Two registers, `dark` (the default) and `ivory`, selected by a `data-theme` attribute on any element. Semantic tokens are redefined under each:

| Semantic | dark | ivory |
| --- | --- | --- |
| `--bg` | ink | ivory |
| `--bg-2` | charcoal | pearl |
| `--fg` | ivory | ink |
| `--fg-2` | champagne | charcoal |
| `--fg-muted` | ivory at 58% | ink at 60% |
| `--line` | champagne at 22% | ink at 14% |
| `--line-strong` | champagne at 45% | ink at 32% |
| `--accent` | gold-hi | gold |
| `--accent-text` | champagne | burgundy |
| `--veil` | `rgb(11 10 9 / 0.62)` | `rgb(244 239 230 / 0.7)` |
| `--surface` | `#0f0e0c` | pearl |
| `color-scheme` | `dark` | `light` |

Mixes use `color-mix(in oklab, …)`, so muted foregrounds and lines stay true at both ends.

`@theme inline` re-exports ten of these as Tailwind utilities: `bg-bg`, `bg-bg-2`, `text-fg`, `text-fg-2`, `text-fg-muted`, `border-line`, `border-line-strong`, `text-accent`, `text-accent-text`, `bg-surface`. `--veil` is not re-exported and is currently unused — dialogs paint their veil with `bg-ink/70`.

`@custom-variant ivory` gives an `ivory:` prefix that matches inside an ivory subtree. `@custom-variant hover-fine` gives a `hover-fine:` prefix gated on `(hover: hover) and (pointer: fine)`; it is declared but not used in Stage 1.

### How a chapter sets the theme

Every chapter and page section calls `useChapter({ id, theme, pinned })` (`src/motion/hooks/useChapter.ts`) and puts the returned `ref` on its root; the hook also returns `ready()`, which pinned chapters call once their pin exists. The fixed footer is the exception — it stamps `data-section="footer"` itself and is handled by the registry's fallback below. `registerSection` in `src/state/sections.ts` then:

1. stamps `data-section="<id>"` and, if the element does not already carry one, `data-theme="<theme>"`, so the section styles itself;
2. observes the element and, on scroll, picks the section whose rect straddles the viewport centre-line — a pinned section wins over an unpinned one at the same line;
3. mirrors that section's theme onto `<html data-theme>` and sets the active section in `siteStore`.

The mirror is what lets the fixed chrome — the nav and the concierge orb's label — read as though it belongs to the chapter beneath it, because that chrome styles itself from the semantic tokens (`text-fg`) rather than from literal colours. Below `#page-root` (the fixed footer), the registry falls back to `footer` and `dark`.

Chapter themes as shipped: hero, craft, diamond, collections, bespoke, the collection opening and the product gallery are `dark`; the window, gold, bridal, men and kids, heritage, the concierge invitation and the collection intro/index/details are `ivory`. Two sections take their theme from a prop or from data: the "worn together" rail is `ivory` on the product route and `dark` on the collection route, and the collection story chapters carry the theme set on each chapter in `src/data/collections.ts`. `Dialog` opens its panel with its own `data-theme` (the consultation modal and the selection ledger are both `ivory` islands).

`layout.tsx` renders `<html lang="en" data-theme="dark">` with `suppressHydrationWarning`, and a synchronous script stamps three more attributes before hydration: `data-rm` (reduced motion), which the CSS in §8 reads directly; `data-visited` (a `wj:visited` timestamp under 24h old), which the loader reads; and `data-coarse` (coarse pointer). `qualityStore` later adds `data-tier` with the lower-cased tier name. Components read pointer and tier from `qualityStore`, not from the attributes.

The `body` transitions `background-color` and `color` over `600ms var(--ease-silk)`, so a theme flip reads as a dip rather than a cut.

---

## 4. Typography

Three faces, loaded through `next/font/google` in `src/app/layout.tsx`.

| Face | Loading | Variable |
| --- | --- | --- |
| **Bodoni Moda** | variable weight, `normal` + `italic`, `axes: ['opsz']`, latin | `--font-display` |
| **Instrument Sans** | variable weight, `normal` + `italic`, latin | `--font-sans` |
| **Noto Nastaliq Urdu** | variable weight, arabic subset, `preload: false` | `--font-urdu` |

The Urdu face is deliberately not preloaded: it exists for two verified accents only. The base layer sets `[lang="ur"] { font-family: var(--font-urdu); line-height: 2 }`.

**Urdu is used in exactly two places**, both verified against published house material: `دیوان` on the Dewan world (`src/data/worlds.ts`) and `نقش گل` in the bridal interlude (`src/data/collections.ts`). `UrduAccent` renders nothing when no string is supplied, which is why passing an unverified accent is a code change and not a content edit.

### Scale

| Token | Value |
| --- | --- |
| `--text-display-xl` | `clamp(4.25rem, 1.5rem + 11.5vw, 15rem)` |
| `--text-display-l` | `clamp(3rem, 1.25rem + 6.5vw, 8.5rem)` |
| `--text-display-m` | `clamp(2.125rem, 1.25rem + 3.25vw, 4.75rem)` |
| `--text-heading` | `clamp(1.5rem, 1.15rem + 1.3vw, 2.375rem)` |
| `--text-lead` | `clamp(1.125rem, 1.05rem + 0.35vw, 1.375rem)` |
| `--text-body` | `1.0625rem` (17px, the `body` size) |
| `--text-small` | `0.9375rem` |
| `--text-caption` | `0.75rem` (12px, the eyebrow size) |
| `--text-micro` | `0.6875rem` (11px, the floor) |

Metrics: `--leading-display: 0.92`, `--leading-heading: 1.08`, `--leading-body: 1.55`, `--tracking-display: -0.01em`, `--tracking-caption: 0.18em`, `--tracking-micro: 0.24em`.

Chapters that need a headline tuned to one composition use an inline `text-[clamp(…)]` rather than bending the scale. Most of the home chapters do this, along with the footer wordmark and the menu items.

### Type utilities

| Utility | Declares |
| --- | --- |
| `display` | `font-display`, weight 400, `line-height: 0.92`, `letter-spacing: -0.01em`, `font-variation-settings: "opsz" 96` |
| `serif` | `font-display`, `font-variation-settings: "opsz" 14` |
| `eyebrow` | `font-sans`, 12px, `0.18em` tracking, uppercase |
| `micro` | `font-sans`, 11px, `0.24em` tracking, uppercase |

The optical size axis is the point of the `display` / `serif` pair: `opsz 96` gives the high-contrast, tight-jointed Bodoni that large headlines need; `opsz 14` keeps small serif text readable. Using the raw `font-display` utility sets the family but leaves `opsz` at its default, so the codebase sets `fontVariationSettings` inline to match the optical size to the type size — `"opsz" 12` through `"opsz" 32` on small and mid serif text, `"opsz" 96` on the collection opening headline. The `serif` utility is declared but not applied by class anywhere; it is the fixed `opsz 14` case only.

Nothing functional renders below 11px.

---

## 5. Spacing and the gutter

| Token | Value | Utility |
| --- | --- | --- |
| `--spacing-gutter` | `clamp(1.25rem, 4vw, 4.5rem)` | `px-gutter`, `p-gutter`, `pl-gutter`, `gap-gutter`, `w-gutter` |
| `--spacing-section` | `clamp(6rem, 12vw, 14rem)` | `py-section`, `pb-section` |
| `--spacing-measure` | `34em` | `max-w-measure` — declared, not currently used |
| `--nav-h` | `72px` | `var(--nav-h)`, via `calc()` in the nav, the menu overlay and product page offsets |

The gutter is the single horizontal margin of the site. Full-bleed chapters bleed; everything measured sits inside `px-gutter`. Horizontal rails scroll with `no-scrollbar`; the concierge result tray also sets `scrollPaddingLeft: var(--spacing-gutter)` so a snapped tile lines up with the gutter.

Easing and duration tokens (`--ease-out-expo`, `--ease-in-out-quart`, `--ease-silk`, `--ease-luxe`, `--duration-micro|ui|scene|cinema`) are mirrored for JS in `src/lib/motion/easings.ts` as `EASE` and `DUR`; see `MOTION_SYSTEM.md`.

---

## 6. Surface utilities

| Utility | Declares | Notes |
| --- | --- | --- |
| `hairline` | `height: 1px` + `--gold-hairline` | Gold light. See §2. |
| `rule` | `height: 1px` + `var(--line)` | Structural divider; theme-aware, not gold. `<Rule />` is the full-width component. |
| `grain` | `isolation: isolate` only | The film is a separate `.grain::after` rule: the 256px tile at `/assets/waseem/brand/grain-256.png`, `opacity 0.035`, `mix-blend-mode: overlay`, `z-index: 2`. |
| `vignette` | `isolation: isolate` only | The falloff is `.vignette::before`: a radial gradient to `rgb(11 10 9 / 0.55)` at the corners, `z-index: 2`. |
| `no-scrollbar` | `scrollbar-width: none` + a `::-webkit-scrollbar { display: none }` rule | For the mobile rails and the concierge result tray. |
| `is-spotlit` | A state class, not a style utility | See below. |

**The trap:** `grain` and `vignette` set `isolation`, not `position`. Their pseudo-elements are `position: absolute; inset: 0`, so they land on the nearest positioned ancestor, which may not be the element you put the class on. Every use in the codebase applies them to an element that is itself positioned — `<div className="absolute inset-0 grain vignette">` in the menu overlay and the collection opening, `<div className="grain pointer-events-none absolute inset-0" />` in the hero and the bridal inset. Follow that pattern. The `isolation: isolate` is there so `mix-blend-mode: overlay` blends against the chapter and not against whatever sits behind it.

Both pseudo-elements are `pointer-events: none` and sit at `z-index: 2` within their stacking context, above imagery and below chapter UI.

**`is-spotlit`** is how the concierge points at something on the page. Adding the class to a section makes a gold-hi sheen sweep across `[data-reveal-inner]` (or the first child `div`) twice over 1.6s, at `z-index: 3`. It is light and lines only — it never transforms the element, so it cannot disturb a pinned composition. It is added and removed on a timer by `src/concierge/tools/executeTool.ts` (2600ms) and `src/components/collection/CollectionExperience.tsx` (2400/2600ms).

Related scoped classes also live in `globals.css`: `.wj-ring-light` (the drawn arc on the concierge invitation) and the `[data-webgl="1"]` rules that hide the drawn craft object once the WebGL one — or its rendered still — is up.

---

## 7. Base layer

- `html`: ink background, `scrollbar-gutter: stable`, a thin `--color-gold-deep` scrollbar, `-webkit-text-size-adjust: 100%`.
- `body`: semantic `--bg` / `--fg`, sans, 17px, `1.55` leading, antialiased, `overflow-x: clip`, and the 600ms theme transition.
- `::selection`: gold on ink.
- `:focus-visible`: `1px solid var(--color-gold-hi)` at `4px` offset — one focus ring for the whole site, visible on both themes. Components whose focus should hug the target set `outline-none` and use `focus-visible:ring-1 focus-visible:ring-gold-hi` instead: the concierge orb, the result-tray cards, the recap thumbnails, the world tiles and `InspectImage`.
- `a` inherits colour and drops underlines; `button` is reset to inherited type with `cursor: pointer`; `img` and `video` are `display: block; max-width: 100%`.

`#page-root` is `position: relative; z-index: 1`, painted ink, with `margin-bottom: 100svh` — the footer is fixed beneath the page and revealed as the last chapter lifts off it. Under `html[data-rm="1"]` that margin is removed and the footer returns to normal flow at `min-height: 100svh`.

Two global state classes: `html.has-cursor` (set by `CursorLayer`, and dropped again while the pointer is over an `input`, `textarea`, `select` or `iframe`) hides the native cursor with `cursor: none !important`, and `html.is-transitioning` (set in `src/lib/motion/transition.ts`) makes `#page-root` non-interactive during a route transition.

---

## 8. Reduced motion

`data-rm="1"` is stamped on `<html>` by the pre-paint script in `layout.tsx`, before hydration, so the reduced-motion layout is pure CSS and cannot mismatch on the client.

The block does structural work, not just animation suppression. The one chapter whose desktop composition is only traversable by scroll falls back to its stacked reading order: `#ch09` (bespoke) loses its pinned height, `.bespoke-stage` is hidden and `.bespoke-stack` becomes flex. The concierge orb core and the invitation ring stop animating.

There is also a `@media (prefers-reduced-motion: reduce) { .sheen { animation: none } }` rule; no element currently carries a bare `sheen` class (the keyframe is used by name), so this rule is inert.

---

## 9. z-index ladder

One list on `:root`, so a new layer is decided here rather than guessed at a call site.

| Token | Value | Layer |
| --- | --- | --- |
| `--z-chapter` | 1 | Chapter content |
| `--z-chapter-ui` | 5 | UI inside a chapter |
| `--z-nav` | 20 | Nav bar |
| `--z-orb` | 40 | Concierge orb |
| `--z-ledger` | 50 | Selection ledger |
| `--z-menu` | 60 | Full-screen menu |
| `--z-concierge` | 70 | Concierge panel and result tray |
| `--z-modal` | 75 | Dialogs |
| `--z-transition` | 80 | Route transition curtain |
| `--z-loader` | 90 | Loading ritual |
| `--z-cursor` | 100 | Custom cursor |

Referenced as `var(--z-…)` by the nav (which raises itself to `calc(var(--z-menu) + 1)` while the menu is open), the menu overlay, the loader, the cursor layer, the transition layer, `Dialog`, the concierge orb, panel and result tray. `--z-chapter`, `--z-chapter-ui`, `--z-orb` and `--z-ledger` describe the ladder but are not referenced by name — those layers use literal values (`z-[5]` inside chapters, `zIndex={50}` on the ledger) and the orb sits at `--z-concierge`. Read the table as the intended order and keep new literals consistent with it.

---

## 10. Component primitives

### `Button` — `src/components/ui/Button.tsx`

One button, three variants. Always uppercase sans at `0.22em` tracking; `sm` is 11px, `md` (default) is 12px.

| Variant | Figure |
| --- | --- |
| `bracket` (default) | `[ LABEL ]` with Bodoni brackets at 60% opacity that breathe apart 4px on hover or focus. |
| `hairline` | Tracked label over a `bg-line-strong` rule, with a gold `hairline` drawing left-to-right beneath it on hover or focus. |
| `text` | The label alone, 80% → 100% opacity. |

Props: `variant`, `size` (`'sm' | 'md'`), `className`, `cursor`, plus either button attributes or `href` (with optional `kind: 'curtain' | 'veil'`, `onNavigate`, `target`). A `tone` prop is declared on the props type but is not read by the component and is not passed anywhere. With `href` it renders a `TransitionLink` and runs the route transition; without, a `type="button"` element. `cursor` writes `data-cursor`, which the custom cursor reads for its state and its word — the vocabulary is `COPY.cursor` (`view`, `explore`, `open`, `ask`, `listen`, `save`, `saved`, `close`, `drag`, `inspect`, `compare`, `play`, `pause`; see "The cursor"). Hover and focus-visible are always styled together.

### `Field` and `ChoiceRow` — `src/components/ui/Field.tsx`

`Field` is a hairline-underlined input with no box: Bodoni at 18px on a transparent ground, `border-b border-line` moving to `border-line-strong` on focus and `border-burgundy` on error. The label is the input's `placeholder` and a floating `micro` caption, animated with the `peer-placeholder-shown` / `peer-focus` pair. `useId()` wires `aria-describedby` to either the error or the hint, and `aria-invalid` follows `error`. Props: `label`, `error`, `hint`, `multiline`, `rows` (default 2), plus native input attributes.

`ChoiceRow` is a `role="radiogroup"` of tracked words with a gold hairline sliding under the chosen one — no pills, no chips. Props: `label`, `options: {value,label}[]`, `value`, `onChange`, `error`.

### `Dialog` — `src/components/ui/Dialog.tsx`

Props: `open`, `onClose`, `label`, `variant` (`'center' | 'sheet' | 'right'`), `theme` (`'dark' | 'ivory'`, default dark), `className`, `zIndex` (default `var(--z-modal)`), `veilClassName`.

While open it stops Lenis (`stopScroll`), sets `inert` on `#page-root`, binds Escape, and traps focus inside the panel on the next frame (`src/lib/focusTrap.ts`); the cleanup reverses all four. The panel carries `role="dialog"`, `aria-modal`, the supplied `aria-label`, its own `data-theme` and `data-lenis-prevent`. Motion per variant: `center` fades and rises 24px; `sheet` slides from the bottom edge; `right` opens by animating `clip-path: inset(0 0 0 100%)` to zero, so the panel is revealed rather than pushed.

### `primitives.tsx` — `src/components/ui/primitives.tsx`

| Component | Props | What it renders |
| --- | --- | --- |
| `Eyebrow` | `children`, `numeral?`, `className`, `…p` | The `eyebrow` line in `text-fg-2`, with an optional Bodoni roman numeral 4 units to its left at 70% opacity. |
| `Hairline` | `className` | `aria-hidden` full-width gold hairline. |
| `Rule` | `className` | `aria-hidden` full-width `--line` rule. |
| `SrOnly` | `children` | `sr-only` span. |
| `UrduAccent` | `text?`, `className` | Returns `null` unless `text` is present; otherwise a `lang="ur" dir="rtl"` span in `text-fg-2`. |
| `TravellingLight` | `active`, `className` | A 24×1px `bg-line` track with a gold-hi quarter running the `travel-light` keyframe (1.4s, infinite) when `active`, parked off-track and transparent when not. |

`TravellingLight` is the house's working indicator — there are no spinners. It runs while the concierge is `THINKING` or `EXECUTING_ACTION` (`ConciergePanel`, `Exchange`), and per tool call with `bg-gold-hi/70` on completion and `bg-burgundy` on failure. `ConsultationModal` uses a pulsing `hairline` on submit for the same reason.

### `Img` — `src/components/media/Img.tsx`

Wraps `next/image` and binds it to the generated asset map, so a call site names an asset id and never a path. `getImage(id)` supplies `src`, real `width`/`height`, `alt`, a blur `blurDataURL`, a `focal` point and a `role`.

Props: `id`, `sizes` (**required** — every image declares how wide it renders), `fill` (default `true`), `priority`, `quality` (`70 | 82`, default 82), `className`, `style`, `draggable` (default false), `alt` (override, `""` for decorative), `onLoad`, `plain`, `eager`, `data`.

Behaviour worth knowing:

- The asset's focal point becomes `object-position`, so crops keep the subject.
- Assets with `role: 'packshot'` are white-background studio shots. They are placed on a `bg-pearl` tile and composited with `mix-blend-mode: multiply`, so they read as objects on paper rather than cut-outs.
- `plain` renders a bare `<img>` with no blur placeholder and no `next/image` wrapper — this is the form FLIP transitions need, because a stable `currentSrc` is required to hand an element from one route to the next. (A packshot with `fill` still gets its pearl tile.) It lazy-loads unless `priority` or `eager` is set; `eager` is the `loading="eager"` case without the preload hint `priority` adds, for tiles inside pinned stages, and it has no effect outside `plain`.
- `data={{ 'flip-source': '…' }}` becomes `data-flip-source`, the hook chapters use to mark FLIP participants.
- If the asset has no `src`, the component renders nothing rather than a broken frame.

### `Video` — `src/components/media/Video.tsx`

Also asset-map bound (`getVideo(id)`). Always `muted`, `playsInline`, `loop`, poster-first, with `disablePictureInPicture` and `disableRemotePlayback`, and with **no** `autoplay` attribute — playback is started from an effect once the quality tier is known. A portrait source is served under `(max-width: 767px) and (orientation: portrait)`; the landscape source is 720p on the `LOW` tier and 1280p otherwise. An `IntersectionObserver` at `25%` root margin plays it in view and pauses it out of view, and it never plays on the `REDUCED` tier or when the visitor has paused media. `onFirstFrame` fires from `requestVideoFrameCallback`, falling back to the `playing` event and a 2500ms timeout. Props: `id`, `className`, `style`, `autoPlayInView` (default true), `preload` (default `'none'`), `onFirstFrame`, `ref` (a `VideoHandle` of `el` / `play` / `pause`), `ariaLabel` (absent means `aria-hidden`), `portrait` (default true — set false to skip the portrait source).

Video sits under film: the hero and the bridal inset lay a `grain` plane over the frame (the hero adds its own radial `.hero-vignette`), and the collection opening, the menu overlay's item preview and the collection interlude put the video inside a `grain` / `grain vignette` box.

### `WaseemMark` / `WaseemLockup` — `src/components/brand/`

Waseem's own mark as inline SVG, generated from the brand master by `scripts/brand` and
gated by `npm run brand:check`. `WaseemMark` covers `crest`, `monogram` and
`crest-monogram`; `WaseemLockup` adds the two-line wordmark and lives in a separate module
so ~10 kB of letterform paths stay out of chunks that only show the mark.

`tone`: `gold` (a horizontal metallic sweep sampled from the artwork), `current`
(inherits `currentColor`, so the mark follows a chapter's theme), `ink`, `ivory`.
`title` names it for assistive technology; `null` marks it decorative. `animatable`
inlines addressable `data-mark` groups, a stroked twin of each silhouette for
draw-on, and a travelling specular band.

Always drawn with `fill-rule="evenodd"` — without it the counters fill in. Never put a
Tailwind `translate-*` or `scale-*` class on a `[data-mark]` element. See **BRAND.md**
for the pipeline, the fidelity gates and the sign-off record.

---

## 11. The concierge trigger

Waseem's crest on a small disc, bottom-right: 56px on a desktop with the crest at 24px, a 48px touch target on a phone with the crest at 22px. One hairline ring, a soft inner shade beneath the disc, and a lift shadow — no glow halo, no sphere, no canvas, no microphone glyph. Composed in `src/concierge/orb/Orb.tsx` as `disc / ring(line, light) / mark`, styled by the `.wj-orb` block in `globals.css`, mounted by `src/concierge/ui/ConciergeOrb.tsx` (which also carries the hover caption and the compact "steps aside" ticket).

The crest is the generated geometry (`CREST` from `src/components/brand/markGeometry.ts`), assembled in `src/concierge/orb/OrbCrest.tsx` with the same `data-mark` vocabulary as `WaseemMark animatable` — `crest-fill`, `crest-draw`, `crest-specular`, and `specular` on the gradient — but with a `currentColor` fill, because `WaseemMark`'s travelling specular exists only in its gold tone and the trigger takes the chapter's colour. Three concessions to the size: the stroked twin carries `pathLength="100"` so the trace is a stylesheet keyframe and `getTotalLength()` is never called; its weight is a hairline (22 mark units) rather than the artwork's 12; and the specular band is spread 1.8× so it is seven pixels wide rather than four. The medallion is optically centred: its own centre sits 3.7% above the box's because the finial hangs beneath it, so the mark is set `translate: 0 3.5%` — measured on the geometry, not judged by eye.

**Theme.** The trigger is fixed chrome and reads `[data-theme]` the way the nav does, through custom properties on `.wj-orb`: on the dark chapters a charcoal disc (`#211d18 → #0f0d0b`), the crest in champagne, the ring in `--line-strong`, the light and the lit ring in gold-hi; on the ivory chapters a pearl disc, the crest in ink, the ring a gilt edge (gold-deep at 42%, warmer than the grey `--line-strong` would be there), the lit ring in `--color-gold`. `--orb-sweep` sets how bright the hover's light may get — 0.85 through champagne, 0.42 through ink, where a near-white band would read as a scratch.

**States** are the ring's, or a trace round the crest's outline; the mark itself never changes shape, size or colour.

| `data-state` | Reads as |
| --- | --- |
| `IDLE` | the ring in `--orb-ring`, still |
| `HOVER`, `OPENING` | the ring lights and steps out 2px (`scale(1.07)` over 700ms `--ease-out-expo`); a band of light passes once through the crest — the `specular` gradient's `gradientTransform` tweened from `translate(-1.2 0)` to `translate(1.2 0)` over 1.1s, the way the ritual moves it |
| `CHAT`, `VOICE_READY`, `RESULT` | the ring lit at 75%, still |
| `LISTENING` | the ring lit at 55%; the same light that travels the hero invitation's ring (`ring-light`, `pathLength="100"`, dash `14 86`) travels this one at 3.2s; the crest steady |
| `THINKING` | a precision trace: the outline drawn once round and out again (`orb-trace`, dash `100 100`, offset 100 → −100, 2.6s linear), over the fill held at 38% |
| `EXECUTING_ACTION` | the same trace at 1.3s |
| `SPEAKING` | the ring alone breathes — `orb-ring-pulse`, scale to 1.05 and opacity 0.7 → 1, 1.8s — never the mark |
| `ERROR` | still, the ring in `--line` |

**Writers.** One per property: the stylesheet's keyframes and transitions own the ring and the trace; the trigger's one GSAP timeline owns the specular band alone (its opacity and the gradient's transform), because a `gradientTransform` cannot be keyframed from a stylesheet, and it is killed and cleared when the hover ends. Motion handles the mount and unmount opacity of the whole corner and nothing else. Nothing reads `voiceMeter` — the live envelope belongs to the voice stage's ring, not the trigger.

**Reduced motion** (`html[data-rm="1"]`): no travelling light, no trace, no pulse, no step-out, no sweep — a state is the ring's colour only. The mark stays finished.

**Accessibility.** A `<button>` with `aria-label` built from `CONCIERGE.name` ("Open the Waseem Concierge" / "Close …"), `aria-haspopup="dialog"`, `aria-expanded`, `data-cursor="ask"`, `data-concierge-orb`. Focus is the house `:focus-visible` outline — a second hairline 4px outside the disc — and focus also puts the store in `HOVER`, so the keyboard sees what the pointer sees. The corner hides while the hero invitation, the menu, the ledger, a dialog or the full desktop rail is up, and until the loading ritual is done.

Shared keyframes in `globals.css`: `sheen`, `breathe`, `travel-light`, `ring-light`; the trigger's own: `orb-trace`, `orb-ring-pulse`. `preloadOrbCanvas` in `Orb.tsx` is a no-op kept for the two invitations that still call it.

---

## 12. Copy register

The register is held in `src/data/copy.ts`, `src/concierge/copy.ts` and the concierge system prompt (`src/concierge/prompt.ts`).

- No exclamation marks. Anywhere, including concierge replies.
- No superlatives, no "shop now", no software vocabulary in consumer-facing strings.
- Heritage facts only as published by the house. Nothing about 1952, the showrooms or the family is invented.
- No general karat or grade claims. Per-piece specifications come only from that piece's own data.
- Prices are on request unless the piece's data carries a fixed figure, in which case it is labelled indicative and subject to the gold rate.
- The concierge answers in the visitor's language, English or Roman Urdu, in one or two sentences, and never invents a piece, price, specification or history.
- Urdu script appears only where the house's own material shows it — the two accents in §4.
- No counts where a visitor reads. The hero's department doors, the chapter titles, the window's tiles and the kinds lists name what Waseem makes, never how many are in the back; counts stay on the department and category pages, where a visitor is choosing among them.
- Every claim on a jewellery moment is a plain fact about the piece or what Waseem publishes about it (`src/data/moments.ts`, `src/data/semantic.ts`). "Crafted to endure" is the only line the craft chapter closes on; no "made only once", no "unique".

## 13. The window and the gate

**The window by kind** (`Ch02Kinds`) is a shop window, not a grid: nine tiles in a twelve-column composition read in three rows, the first kind large and the rest set off one another with offsets of a few svh, so the eye travels. A tile is one kind on one real packshot — the bridal tile on a jewellery-only crop of a suite, never a bride's face — with the kind's name in the display face and *Explore* beside it; a second piece of the kind fades in over the first under the hand or on focus, the tile scales 1.035 over a second, and a hairline sweeps its top edge. Beneath, the piece is named in micro type with its published tag and is a door of its own. A kind the concierge was asked about is lit for a moment with a gold hairline frame (`data-lit`). On a phone the composition stacks to two columns, the first tile spanning both.

**The gate** (`Ch03Gate`) is dark ink between the ivory window and the ivory gold chapter: one frame, two materials. Gold beneath (the satlada haar on velvet, `p05-macro`), diamond above (`p07-macro`, the sapphire pendant and its pavé) behind a mask whose edge follows the pointer and breathes ±2.5% at rest. GOLD sits upper-left and DIAMOND lower-right at `clamp(3rem, 8.5vw, 9.5rem)` so they never collide; their weight (`wght` 400–580) and scale follow the split. Each side carries a one-line description, *Enter Gold / Enter Diamond*, and an *In frame* credit naming the piece photographed, which opens the piece. Choosing a side lets it fill the frame, lifts its word, and the curtain carries the visitor into the department. On a phone the split is horizontal and follows the scroll through the chapter; under reduced motion the frame is held at the middle and the two sides are two doors. The studio film is deliberately not used here: its only jewellery-only stretch is under three seconds and the rest is a face.

---

## Not in Stage 1

There is no visitor-facing theme switch (the register is chosen by the chapter), no localised UI beyond the two Urdu accents, and no checkout or pricing surface beyond "on request" and the appointment request.

## The concierge

**A word about the word.** "Salon" is the internal name of the concierge's *register* — the
`[data-salon]` token set that gives the rail its own paper or ink, and the `.salon-tile` frame.
It is never shown to a visitor: the copy says showroom, appointment, viewing, and
`scripts/dev/copy-guard.mjs` fails the build on a customer-facing "salon" (or "Private
consultation", or "House of Waseem"). The concierge is a private room, not a chat window. Three
zones, always in the same place:

| Zone | What it is | What belongs in it |
|---|---|---|
| **The rail** (right, `--rail-w`, 560px at ≥1280; a full sheet below) | the associate | words and state — the crest masthead, the piece in view on a plate, the exchange with its facts, the context ribbon, the composer, the voice stage |
| **The vitrine** (bottom band) | the jewellery | `ResultTray`: the pieces as tiles with verified facts and View / Save / Compare, the comparison table, the "brought for" terms |
| **The stage** | the page | the department, the piece, the campaign — it steps aside via `html[data-rail="1"]` |

The rail follows the chapter's theme through `[data-salon]` tokens: paper on the ivory chapters,
ink on the dark ones. On a phone the sheet is modal, the tray sits inside it (`TrayBody compact`,
at most 47dvh), and the exchange scrolls to the newest turn.

**The rail never shows an image larger than a 44px thumbnail.** It once rendered the same four
pieces as a grid of 4:5 photographs directly above the tray already showing them, larger and
better — two copies of one answer, and the taller copy pushed the concierge's own sentence out
of view. If the visitor is looking at pieces, they are looking at the vitrine.

**Results do not collapse the rail.** Only an action that takes over the *stage* — opening a
piece, navigating, the consultation — does that, and each says so with `compact` on its own
outcome. Collapsing on results took the composer away too, so "Show me 21K gold rings under 15
grams" and then "Now bracelets" cost an extra click every time.

Anything that reserves room beside the rail derives it from `--rail-w`
(`xl:pr-[calc(var(--rail-w)+2.75rem)]`), never a written-out pixel value: the hard-coded ones
were tuned for a 468px rail and silently became too narrow the moment it widened.

### The rules that keep it a salon

No avatars. No bubbles. No timestamps. No "typing…". No emoji. No icons beyond `→` and the mic
ring. No unread badges. No suggestion *chips* — suggestions are underlined italic serif lines.
No scroll-to-bottom button. No delivery ticks. One accent (`--gold-hi`), used only for the
listening ring and focus. The voice stage is a hairline ring with the crest at its centre and a
second ring that breathes with the voice — no waveform, no sphere. Every voice condition is also
a sentence beneath the ring, so the ring is never the only signal.

## The nav's surface

The nav is text and the crest, with no ground of its own at the top of a page. Once the page
has moved beneath it (past 120px) and it returns on scroll-up, it brings a surface with it —
`.wj-nav-surfaced`: the chapter's own `--bg` at 86% with a blur and a `--line` rule — so the
mark is never floating over a photograph. While shown it publishes `--nav-offset` (its height,
else `0px`) and the department refine bar sticks to that, standing beneath the nav rather than
under it. Nothing else may sit in the nav band: chapter eyebrows begin at
`calc(var(--nav-h) + 1.25rem)`, and a department masthead names the place ("LAHORE · SINCE
1952"), not the brand the crest already says.

## The cursor

Fine pointers only. A 6px bead in `--accent` (gold-hi on ink, gold on paper) with a 1px `--bg`
keyline; over a control it becomes a 14px hairline ring and a word appears beside it in a quiet
`--bg` tag; while dragging it is a 22px ring in `--fg` and the word withdraws. Nothing grows,
nothing springs, nothing is magnetic. The word for each state lives in `COPY.cursor` — view,
explore, open, ask, listen, save, saved ("Kept"), close, drag, inspect, compare, play, pause —
and a target chooses one with `data-cursor`. Touch, pen, coarse pointers and reduced motion keep
the native cursor; on a hybrid device the bead steps aside the moment a finger or pen moves and
returns with the mouse.
