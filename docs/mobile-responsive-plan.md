# Exchange — Mobile Responsive Design Plan

**Scope:** Every route, shared component, and global style in `frontend/src` (React 19 + Vite + CSS Modules).
**Target:** Responsive web on iOS Safari 16+ and Android Chrome 110+. Phones from 320px up to tablets at 1024px. The desktop experience stays as it is.
**Status of this document:** Plan only. No code has been changed yet.
**Date:** 2026-11-07

---

## 0. Decisions to confirm (each has a recommended default)

The plan below assumes these defaults. If you change one, only the section it points to changes.

| # | Decision | Recommended default | Alternative | Affects |
| --- | ---------- | --------------------- | ------------- | --------- |
| D1 | Phone primary navigation | **Bottom tab bar** (Home · Browse · Saved · Bag · Account) plus the existing hamburger for secondary links | Keep the hamburger only | §3 |
| D2 | PWA / offline support | **Out of scope for v1.** Keep the existing offline banner. Add a manifest and icons only, so "Add to Home Screen" looks right | Full service worker with a cached catalog | §8 |
| D3 | Admin suite on phones | **Usable but not optimised.** Tables become stacked cards and every action is reachable. No phone-specific redesign | Full phone redesign / desktop only | §4.12 |
| D4 | Breakpoint strategy | **Mobile-first `min-width`**, four canonical breakpoints | Keep `max-width` overrides | §2.1 |
| D5 | Video on mobile data | **Poster image only until the user taps play.** No autoplay on cellular or when Save-Data is on | Autoplay muted everywhere | §2.9, §7 |
| D6 | Tablet (768–1023px) | **Two-column layouts with a phone-style shell** (bottom bar hidden from 768px up) | Treat tablets as desktop | §2.1 |

---

## 1. Current-state audit

### 1.1 Inventory

- **16 routes** (`src/app/router.jsx`): `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/listings`, `/lend`, `/listings/new`, `/listings/:id`, `/favorites`, `/bookings`, `/bookings/:id`, `/orders`, `/profile`, `/disputes`, `/admin`.
- **About 30 CSS Modules, roughly 13,700 lines.** The largest are `CreateListingPage.module.css` (1,930 lines), `HomePage.module.css` (1,013) and `ListingDetailPage.module.css` (960).
- **Global overlays:** `BagDrawer`, `FilterModal`, `ReviewFormModal`, `ToastContainer`, the PDP lightbox and `CatwalkVideoPlayer`.
- **The viewport meta tag is present** (`width=device-width, initial-scale=1.0`) and `theme-color` is set to `#570020`.

### 1.2 Problems found

| # | Problem | Evidence | Mobile impact | Priority |
| --- | --------- | ---------- | --------------- | ---------- |
| A1 | **About 15 different breakpoints**, mixing `min-width` and `max-width` | 480, 500, 540, 640, 700, 719, 768, 860, 900, 960, 1024, 1100, 1200px and 48/64/72rem across 25 files | Layouts break unevenly between breakpoints, and fixes conflict | P0 |
| A2 | **`100vh` on full-height surfaces** | `BagDrawer.module.css:13`, `FilterModal.module.css:17-18`, `AppLayout.module.css:2`, `ListingDetailPage.module.css:869,885`, `CreateListingPage.module.css:1380`, `LendPage.module.css:3`, `AuthPages.module.css:3`, `RouteErrorBoundary.jsx:14` | iOS Safari's URL bar hides the bottom of drawers, including the "Show looks" and "Checkout" buttons | P0 |
| A3 | **Inputs below 16px** | `global.css:231` (14px), `CreateListingPage.module.css:221` (14px), `AdminPage.module.css:175` (0.85rem), `BackupSizeSelector.module.css:34`, `CoutureFittingEngine.module.css:143`, `Feedback.module.css:297` (12px) | iOS zooms the page when a field gets focus, and the layout jumps | P0 |
| A4 | **No safe-area handling** | No `viewport-fit=cover` and no `env(safe-area-inset-*)` anywhere | Sticky bars sit under the iPhone home indicator and the notch in landscape | P0 |
| A5 | **About 125 `:hover` rules with no hover-capability guard** | Top offenders: CreateListing (21), HomePage (16), ListingDetail (10), AppLayout (8) | Hover styles "stick" after a tap on touch screens | P1 |
| A6 | **Mouse-only interactions** | `onMouseEnter` in `ListingCard.jsx:180`, `ReviewFormModal.jsx` and the zoom in `ListingDetailPage.jsx` | Card video previews never play on touch, or load for no reason. Zoom is unreachable | P1 |
| A7 | **Touch targets under 44px** | 41 width/height declarations between 20 and 43px. Header icon buttons use `padding: 0.4rem 0.75rem` and are about 34px tall | Mis-taps in the header, on chips and on carousel dots | P0 |
| A8 | **The header is overcrowded at 360px** | `AppLayout.jsx`: hamburger, brand with subtitle, Search, Hearts, Bag, My Rentals, avatar and an inline "Sign out" | Overflows or wraps, and the brand gets squeezed | P0 |
| A9 | **Duplicate bag icon** | "My Rentals" (`AppLayout.jsx`) uses the same SVG as the Bag button, and labels are hidden below 860px | Two identical icons sit side by side with different meanings | P1 |
| A10 | **The hamburger menu is not accessible** | No `aria-expanded` or `aria-controls`, no Escape or outside-tap close, no scroll lock, no close on route change | Screen-reader confusion, and the page scrolls behind the open menu | P1 |
| A11 | **The announcement bar holds three messages** | `.topBarInner` uses `flex-wrap: wrap` | Wraps to 3–4 lines on a phone and pushes content below the fold | P1 |
| A12 | **The hero video preloads in full** | `HeroVideoShowcase.jsx:118` `preload="auto"` | Downloads megabytes on 4G in Tier 2/3 cities before anything else | P0 |
| A13 | **The hero aspect is 2560:948** | `DESIGN.md` §4 | A 360px-wide phone gets a strip about 133px tall | P1 |
| A14 | **`--section-pad-y` never goes below 80px** | `variables.css` `clamp(80px, 10vw, 120px)` | 160px of padding per section on a 640px-tall screen | P1 |
| A15 | **Body text is 14px at weight 300** | `variables.css` `--text-base: 0.875rem`, `DESIGN.md` body weight 300 | Hard to read outdoors and in bright sunlight | P1 |
| A16 | **Three data tables** | `AdminPage.jsx`, `DisputesPage.jsx`, `MoleculeComparisonTable.jsx` | Horizontal page overflow | P1 |
| A17 | **Turnstile is rendered at its default size** | `TurnstileWidget.jsx:27` passes no `size` | A widget about 300px wide overflows a 320px screen with 16px gutters | P1 |
| A18 | **Few images are lazy-loaded** | Only 8 `loading="lazy"`/`srcSet` usages across the app | Catalog pages load every image at full size | P1 |
| A19 | **`color-scheme: dark light`** on `:root` | `variables.css:2` | Native `type="date"` pickers may render dark on white cards when the phone is in dark mode | P2 |
| A20 | **The offline banner uses inline styles** | `AppLayout.jsx` | Can't be made responsive and gets no safe-area padding | P2 |
| A21 | **Few form-field hints** | 5 `autoComplete`/`inputMode` attributes across all auth pages | Wrong keyboards appear, and autofill doesn't work | P1 |
| A22 | **Z-index values are inconsistent** | BagDrawer uses `1000`, FilterModal uses `--z-modal: 9011`, the offline banner uses `10000` | Overlays stack unpredictably once a bottom bar is added | P2 |

> Note: `mobile_audit.py` from the mobile-design skill was run and reported "PASS" with 0 checks. It targets React Native and Flutter files, so it says nothing about this web app. The audit above was done by hand.

---

## 2. Phase 0 — Foundations (cross-cutting, do first)

Everything else depends on this phase. All of these are edits to existing files; no new dependencies are needed.

### 2.1 Canonical breakpoints (mobile-first)

| Token (comment only) | Value | Meaning |
| ---------------------- | ------- | --------- |
| `--bp-sm` | `min-width: 480px` | Large phones (Plus/Max), landscape phones |
| `--bp-md` | `min-width: 768px` | Tablet portrait. The bottom tab bar hides and two-column layouts begin |
| `--bp-lg` | `min-width: 1024px` | Tablet landscape and small laptops. Full desktop navigation appears |
| `--bp-xl` | `min-width: 1280px` | Desktop editorial layouts |

- CSS custom properties **cannot be used inside `@media`**. Record these values in a comment block at the top of `styles/variables.css` and use the literal values in each module. Don't add PostCSS just for this.
- **Base styles target a 360px phone.** Each module adds layers with `@media (min-width: …)`.
- **Migration rule per file:** convert existing `max-width` blocks into the base styles and move the current desktop rules into `min-width` blocks. Snap odd values to the nearest canonical breakpoint (500/540 → 480; 640/700/719 → 768; 860/900/960 → 1024; 1100/1200 → 1280).
- **Capability queries:** use `@media (hover: hover) and (pointer: fine)` for hover effects and `@media (pointer: coarse)` for touch-only enlargements. These are separate from width.

### 2.2 Safe areas (iPhone notch and home indicator)

- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Add these tokens in `variables.css`:

  ```css
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  ```

- Apply them to the sticky header (`padding-top`), the bottom tab bar, sticky CTAs, drawer footers, toasts and the offline banner.
- **Ship the meta change and the padding in the same commit.** `viewport-fit=cover` without the padding puts content under the notch.

### 2.3 Dynamic viewport height

Replace each `100vh` listed in A2 with:

```css
height: 100vh;          /* fallback */
height: 100dvh;         /* tracks the iOS/Android URL bar */
```

For `calc(100vh - X)`, use `calc(100dvh - X)` with the same fallback line before it.

### 2.4 Input sizing (stops iOS zoom on focus)

- Global rule in `global.css`: `input, select, textarea { font-size: max(16px, 1rem); }`.
- Remove or override the six sub-16px declarations listed in A3. On desktop they can go back to 14px inside `@media (min-width: 1024px)` if the design needs it.
- **Never** stop the zoom with `maximum-scale=1`. It blocks pinch-zoom for users with low vision.

### 2.5 Touch targets

- Add the token `--tap-min: 44px` and apply it as `min-height`/`min-width` on every interactive element: buttons, icon links, chips, pills, carousel dots, stepper +/-, close (×) buttons, checkbox and radio labels.
- **Small icons can stay visually small.** Grow the hit area with padding or a `::before` hit-box instead of enlarging the icon.
- Keep at least 8px between adjacent targets (chip rows, size selectors, date cells).
- Clear the 41 sub-44px declarations (A7). Each one either becomes a 44px hit area or is confirmed as decorative and non-interactive.

### 2.6 Hover and touch parity

- Wrap every `:hover` rule in `@media (hover: hover) { … }`. Do it module by module during the breakpoint migration so each file is touched only once.
- Give each hover effect a touch equivalent where it matters. `:active` gives tap feedback (a scale of 0.98 or an opacity change, under 100ms), and `:focus-visible` covers keyboard users.
- JS gating: add one helper, `const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches`. Use it in `ListingCard.jsx` (video preview), `ListingDetailPage.jsx` (zoom lens) and `ReviewFormModal.jsx`. On touch devices these handlers are never attached.

### 2.7 Mobile type and spacing scale

| Token | Current | Phone (base) | ≥1024px |
| ------- | --------- | -------------- | --------- |
| `--text-base` | 14px | **16px** | 15px |
| Body weight | 300 | **400** | 300 (editorial look kept) |
| `--text-micro` / eyebrows | 11px | 11px minimum, **never smaller** | 11px |
| `--text-hero` | clamp(36, 5vw, 44) | clamp(30px, 8vw, 36px) | as is |
| `--section-pad-y` | clamp(80, 10vw, 120) | **clamp(48px, 12vw, 80px)** | 120px |
| `--section-pad-x` | clamp(20, 5vw, 64) | **16px** (gutter) | 64px |
| Line height (body) | 1.3 | **1.5** | 1.4 |

- Support Dynamic Type / system text scaling: all sizes use `rem`, and nothing is clipped at 200% zoom. Check with iOS "Larger Text" and Android "Font size: Largest".
- Long couture names should wrap or use a 2-line clamp; never truncate prices or dates.
- Indian numbering (`₹1,50,000`) must never break across lines. Add `white-space: nowrap` on price elements.

### 2.8 Layering

Normalise z-index tokens in `variables.css` and replace the hard-coded values:

```
--z-base: 1 · --z-card: 5 · --z-sticky-header: 200 · --z-bottom-nav: 210
--z-sticky-cta: 220 · --z-drawer: 900 · --z-modal: 1000 · --z-toast: 1100 · --z-offline: 1200
```

Update BagDrawer (`1000`), FilterModal (`9011`) and the offline banner (`10000`) to use these tokens.

### 2.9 Media loading rules

- All `<img>` below the fold get `loading="lazy" decoding="async"`, plus `srcset`/`sizes` when the backend provides several widths. The first hero or PDP image gets `fetchpriority="high"`.
- All `<video>` elements get `playsInline muted`, a `poster`, and `preload="none"` (or `"metadata"` on desktop). Change `HeroVideoShowcase.jsx:118` from `preload="auto"` to these rules.
- **Data saver:** if `navigator.connection?.saveData` is true or `effectiveType` is `2g`/`3g`, show the poster only and skip autoplay. The Network Information API is Chromium-only, so Safari falls back to "poster until tap".
- Pause any off-screen video with `IntersectionObserver`. This saves battery and data.

### 2.10 Dark-mode guard

Leave `:root { color-scheme: dark light; }` in place, but set `color-scheme: light` on every light surface: cards, drawers, forms and the date picker. Native controls then render in light mode regardless of the phone's theme. Check this by emulating `prefers-color-scheme: dark`.

**Phase 0 acceptance criteria**

- [ ] No horizontal overflow on any route at 320, 360, 390 or 414px (`scrollWidth <= innerWidth`).
- [ ] No iOS zoom when focusing any field.
- [ ] No interactive element smaller than 44×44px (automated scan, §9).
- [ ] Drawer CTAs are fully visible with the iOS URL bar expanded and collapsed.
- [ ] Only the four canonical breakpoints remain (`grep -rhoE "@media[^{]*" src | sort -u`).

---

## 3. Phase 1 — App shell (`AppLayout.jsx` / `AppLayout.module.css`)

### 3.1 Phone layout (<768px)

```
┌──────────────────────────────────────┐ ← safe-top
│ ✦ Complimentary backup size  ›       │  announcement: one message, rotates every 5s, tap to pause
├──────────────────────────────────────┤
│ ☰   EXCHANGE                  🔍  👜• │  sticky header, 56px tall
├──────────────────────────────────────┤
│                                      │
│               content                │
│                                      │
├──────────────────────────────────────┤
│  ⌂      ▦       ♡ 3     👜      ◯     │  bottom tab bar, 56px + safe-bottom
│ Home  Browse  Saved   Bag   Account  │
└──────────────────────────────────────┘
```

**Header (56px, sticky, `--z-sticky-header`)**

- Left: hamburger (44×44).
- Center: the brand wordmark. Hide the "THE CLOSET IN THE CLOUD" subtitle below 480px.
- Right: Search (44×44) and Bag (44×44, with an indicator dot).
- Hearts, My Rentals, the avatar and Sign out move out of the header: into the bottom bar (D1) or into the menu.
- Reduce the backdrop blur, or switch to a solid `--color-canvas-alt`, on low-end Android. `backdrop-filter` on a sticky element causes scroll jank.
- Optional: hide the header on scroll down and show it on scroll up, using transform only. Only do this if the bottom bar exists.

**Bottom tab bar (new, phones only, D1)**

- Five destinations: Home `/`, Browse `/listings`, Saved `/favorites`, Bag (opens `BagDrawer`), Account (`/profile` when signed in, `/login` when not).
- Each tab is at least 44px tall with icon and label, and the bar is 56px plus `--safe-bottom`.
- The active tab uses the gold `#C8A251` icon and label; inactive tabs use `rgba(255,255,255,0.7)`.
- Badge counts for Saved and Bag. Use `aria-current="page"` on the active tab.
- Hide the bar while the on-screen keyboard is open (a `visualViewport` resize check) and while any drawer or sheet is open.
- Add `padding-bottom: calc(56px + var(--safe-bottom))` to `.main` so content isn't hidden behind the bar.

**Hamburger menu → full-height sheet from the left**

- Contents: Rent for Events · Weddings · Cocktail & Gala · Buy Pre-Loved · Lend Couture, then a divider, then My Rentals · Orders · Disputes · Admin (if admin), then Sign out (moved here from the header).
- Behaviour:
  - Set `aria-expanded` and `aria-controls` on the button.
  - Close on Escape, on a backdrop tap, on route change (`useLocation` effect) and on a swipe-left.
  - Lock body scroll while open (`overflow: hidden` on `<html>`).
  - Trap focus inside the sheet and return focus to the button on close.
- Rows are 52px tall with 16px side padding, 18px Playfair labels and gold dividers.

**Announcement bar**

- On phones, show one message at a time, rotating every 5 seconds with a crossfade. Respect `prefers-reduced-motion` (no rotation; show the first message only). A tap pauses it.
- Height is 32px. Truncate with an ellipsis rather than wrapping.

**Search**

- The search icon opens a full-screen search overlay containing an autofocused input (16px, `type="search"`, `enterkeyhint="search"`), recent searches, popular designers and occasion chips.
- Submitting goes to `/listings?q=…`. If `q` is not supported yet, link to `/listings` for now and note this as a backend follow-up.

**Footer (phone)**

- Keep the guarantees as one column (already done).
- Turn the link columns into **accordions** (`<details>`/`<summary>`, native and no JS), each row 48px tall.
- Add `padding-bottom` so the footer clears the bottom bar.

**Offline banner**

- Move the inline styles into `AppLayout.module.css` and give it `top: var(--safe-top)` and `--z-offline`.
- Shorten the text on phones: "Offline — reservations resume when you reconnect."

**Global overlays (shared rules)**

- On phones, every drawer or modal is **full-screen or a bottom sheet** with:
  - A grab handle.
  - A sticky header with a 44px close button.
  - A scrollable body (`overscroll-behavior: contain`).
  - A sticky footer CTA with `padding-bottom: calc(16px + var(--safe-bottom))`.
- Swipe down closes a bottom sheet, and there is **always a visible close button** as well (no gesture-only actions).
- Use only `transform` and `opacity` for animation, with the spring curve `cubic-bezier(0.16,1,0.3,1)` at 320–380ms. With `prefers-reduced-motion`, use a 0ms or opacity-only transition.

---

## 4. Phase 2 — Per-route designs

Priority order: **renter flow (4.1–4.5) → lender flow (4.6–4.7) → account (4.8–4.11) → admin (4.12)**.

### 4.1 Home `/` — `HomePage`, `HeroVideoShowcase`, `BrandTicker`, `MoleculeVisualNav`, `SlidingValueProps`, `CustomerFitGallery`, `MoleculeComparisonTable`, `HeroWithExpandableTextPills`

| Section | Phone (<768) | Tablet (768–1023) |
| --------- | -------------- | ------------------- |
| Hero video | **Portrait crop (4:5 or 9:16) through `<source media="(max-width: 767px)">` plus a portrait poster.** Headline sits over a bottom gradient scrim, with one gold primary CTA "Rent for an Event" (full width, 52px) and a secondary text link. Play/pause button 44px (WCAG 2.2.2). | 16:9 crop |
| Brand ticker | Keep the marquee. Pause it under `prefers-reduced-motion` and when off-screen | Same |
| Occasion carousel | Horizontal `scroll-snap-type: x mandatory`, cards about 72vw wide with a 3:4 aspect and the next card peeking 16px. No arrows; add a "View all" link | 3 visible cards |
| Trending grid | 2 columns, 12px gap, 3:4 cards | 3 columns |
| 4-pillar trust ribbon | 2×2 grid, icon above text, each block 44px+ tall | 4 columns |
| Sliding value props | Stack vertically, with no auto-sliding on phones | 2 columns |
| Customer fit gallery | Horizontal snap row of 9:16 tiles about 60vw wide. Tap opens a full-screen viewer | 3 columns |
| Catwalk motion showcase | Snap row of 9:16 reels. **Only the reel in view plays**, and only after a tap or on Wi-Fi. Posters otherwise | 3 columns |
| Comparison table | Becomes stacked comparison cards (one card per attribute, with "Exchange vs Retail" rows) | Table with a sticky first column |
| Expandable text pills | Pills wrap, each 44px tall. Expanded content pushes content below it down instead of overlapping | Same |

- **Performance budget:** Home LCP under 2.5s on a mid-range Android over 4G. Hero poster 60KB or less (AVIF/WebP). No video bytes before interaction on cellular.

### 4.2 Catalog `/listings` — `ListingsPage`, `ListingCard`, `FilterModal`

```
┌──────────────────────────────┐
│ Wedding Guest        124 looks│  title + count
│ [Lehenga][Gown][Saree][Anarkali]→ │  occasion chips: horizontal scroll, 36px visual / 44px hit area
├──────────────────────────────┤ ← sticky toolbar (top: 56px)
│ ⚙ Filter (3)    ⇅ Sort: Price ▾│  two 44px buttons, 50/50
├──────────────────────────────┤
│ ┌──────┐ ┌──────┐             │
│ │ 3:4  │ │ 3:4  │  2-col grid │
│ │   ♡  │ │   ♡  │  12px gap   │
│ └──────┘ └──────┘             │
│ Sabyasachi   Tarun T.         │
│ ₹4,500/day   ₹6,200/day       │
└──────────────────────────────┘
```

- **Grid:** 2 columns on phones, 3 at 768px, 4 at 1280px. Use `content-visibility: auto` on cards below the fold. Use infinite scroll with a "Load more" button fallback (accessible, and doesn't trap the footer).
- **ListingCard on touch:**
  - No hover video. Show the poster only.
  - The wishlist heart is 44×44 in the top-right with a frosted background, and toggles optimistically.
  - The title is clamped to 2 lines (serif, 15px), the designer is an 11px eyebrow, and the price/day stays on one line.
  - The strikethrough retail price goes on a second line below 360px.
- **Filter:** a full-screen sheet on phones (`width: 100vw; height: 100dvh`).
  - Accordion groups (Occasion, Silhouette, Size, Designer, Price, Rent/Buy) with 48px headers.
  - The price range uses two native number inputs (`inputmode="numeric"`) next to the slider, because sliders are imprecise with a thumb.
  - The sticky footer has "Clear all" (secondary) and "Show 124 looks" (gold, primary, live count) above `--safe-bottom`.
  - Applied filters appear as removable chips below the toolbar.
- **Sort:** a bottom-sheet radio list. On Android this could be a native `<select>`, but use the bottom sheet everywhere for consistency.
- **States:** a skeleton grid (6 cards, shimmer disabled under reduced motion); an empty state with an editorial message and a "Clear filters" CTA; an error state with "Retry".
- **Scroll restoration:** going back from the PDP returns to the same scroll position, with filters kept in the URL query.

### 4.3 Product detail `/listings/:id` — `ListingDetailPage`, `ModeSwitcher`, `RentalDatePicker`, `BackupSizeSelector`, `CoutureFittingEngine`, `DamageWaiverBadge`, `FitInsights`, `CustomerReviews`, `PincodeTransitCalculator`, `SterilizationGuaranteeInfographic`, `SustainabilityImpactCalculator`, `CatwalkVideoPlayer`

**Phone layout — one column; the conversion decisions sit in the thumb zone.**

```
┌──────────────────────────────┐
│ ‹ Back                ♡  ⇪   │  transparent over the gallery, then solid on scroll
│                              │
│      GALLERY 3:4 full-bleed  │  swipe between images (scroll-snap), dots 1/6
│                         ▶ 9:16│  catwalk video as one gallery slide
├──────────────────────────────┤
│ SABYASACHI                   │
│ Ivory Zardozi Bridal Lehenga │  serif, 24px
│ ★ 4.8 (32) · Showroom Pristine│
│ [  Rent  |  Buy  ]           │  ModeSwitcher, segmented, 44px
├──────────────────────────────┤
│ Size        [S][M][L][XL]    │  44px chips
│ Backup size  M → L  (free)   │
│ Dates       📅 12–16 Dec (4d) ›│  opens the date sheet
│ Pincode     [400050] Check   │  inputmode=numeric, maxlength 6
│ Festive Care ₹299       [◯]  │  44px toggle
│ Couture fitting          ›   │  opens the basting sheet
├──────────────────────────────┤
│ ▸ Details & fabric           │  accordions, 48px rows
│ ▸ Fit insights               │
│ ▸ 7-stage sterilization      │
│ ▸ Delivery & returns         │
│ ▸ Reviews (32)               │
└──────────────────────────────┘
┌──────────────────────────────┐ ← sticky CTA bar, --z-sticky-cta
│ ₹18,000 · 4 days   [Reserve ▸]│  64px + safe-bottom; gold primary
└──────────────────────────────┘
```

- **Sticky CTA bar:** shows the live total and a gold primary button ("Reserve" in Rent mode, "Buy Now" in Buy mode). It's disabled with a helper hint ("Select dates") until the form is valid. The bottom tab bar hides on this route so there's one bottom bar only.
- **Gallery:**
  - Native horizontal scroll-snap (no library), plus a pinch-zoom lightbox on tap.
  - The lightbox supports swipe, keeps its existing 48px prev/next buttons, has a 44px close button, closes on swipe-down, and uses `100dvh`.
  - The desktop hover zoom lens is disabled for `hover: none` (already partly done at `ListingDetailPage.module.css` line ~945; extend it to the JS handler).
- **Date picker (`RentalDatePicker`):**
  - Keep the native `<input type="date">` as the base. It gives the right OS picker on iOS and Android.
  - Present it inside a bottom sheet with 4-day / 8-day block presets as large chips, plus clash messaging in `--color-status-error`.
  - Set `color-scheme: light` on the sheet.
- **CoutureFittingEngine (basting):** a full-screen sheet. Bust, waist and hem steppers have 44px −/+ buttons and an `inputmode="decimal"` field; heel height is a segmented control. Replace the current 500px breakpoint with the canonical one.
- **Sections:** collapse long sections into accordions on phones and keep them expanded from 1024px up.
- **Infographics** (`infographics.module.css`): the 7-stage sterilization becomes a vertical timeline, and the sustainability calculator becomes a single column.
- **Reviews:** show the first 3, then "See all 32" opens a full-screen list. `ReviewFormModal` becomes full screen with a sticky Submit button, and star-rating targets are 44px each.
- **Tablet (768–1023):** gallery on the left at 55% and details on the right at 45%, with a non-sticky CTA inside the details column.

### 4.4 Bag / checkout — `BagDrawer`

- Phones: a full-screen sheet from the bottom (not the right), using `100dvh`.
  - Line items show the 3:4 thumbnail (72px), title, dates, size and backup size, with a 44px remove button.
  - The sticky summary footer shows the subtotal, Festive Care, the deposit (or "₹0 deposit, KYC verified"), the total, and a gold "Checkout" button above `--safe-bottom`.
- A clear **unverified KYC → deposit** explanation, with a link to verify.
- Empty state: an editorial line plus a "Browse the Archive" CTA.
- Payment step: use `autocomplete="cc-number"` and similar attributes. Prefer the gateway's mobile-optimised UPI intent / redirect flow, since UPI is primary in India.

### 4.5 Auth `/login`, `/register`, `/forgot-password`, `/reset-password` — `AuthPages`, `OAuthButtons`, `TurnstileWidget`

- Single column, 16px gutters. Hide the decorative image panel below 768px, or reduce it to a 120px banner.
- Field attributes:

  | Field | `type` | `autocomplete` | `inputmode` | `enterkeyhint` |
  | ------- | -------- | ---------------- | ------------- | ---------------- |
  | Email | `email` | `email` (`username` on login) | `email` | `next` |
  | Password (login) | `password` | `current-password` | — | `go` |
  | Password (register/reset) | `password` | `new-password` | — | `next`/`done` |
  | Name | `text` | `name` | — | `next` |
  | Phone | `tel` | `tel` | `tel` | `next` |
  | OTP (if any) | `text` | `one-time-code` | `numeric` | `done` |

- A 44px show/hide password toggle.
- Full-width 52px buttons. OAuth buttons are stacked and full width.
- **Turnstile:** pass `size: 'flexible'` (or `'compact'` below 360px) in `TurnstileWidget.jsx:27` so it fits a 288px content width.
- Errors appear inline below each field and are announced (`aria-live="polite"`). Focus the first invalid field on submit.
- When the keyboard opens, scroll the focused field into view (`scrollIntoView({block:'center'})` on focus). Make sure the submit button isn't hidden behind the keyboard: no fixed footer on auth screens.

### 4.6 Lender studio `/lend` — `LendPage`, `LenderIncomeCalculator`

- The hero is a short editorial headline with one CTA, "List an Outfit". Replace `min-height: 100vh` with content height.
- **Income calculator:** stacked inputs (retail price uses `inputmode="numeric"` with ₹ formatting as you type), and a large 32px result showing monthly yield. Slider plus numeric input, as in §4.2.
- "How it works": a vertical 3–4 step timeline.
- A sticky bottom CTA, "Start Listing", appears after the user scrolls past the hero.

### 4.7 Create listing `/listings/new` — `CreateListingPage` (1,628 lines JSX / 1,930 lines CSS)

The biggest mobile risk is a long single page with STEP 01–0N sections.

- **Phones: one step per screen (a wizard).** The same component renders sections conditionally; no route change is needed.
  - The sticky top shows a progress bar and "Step 2 of 5 · Discovery Intel".
  - The sticky bottom has "Back" (secondary) and "Next" (gold) above `--safe-bottom`. Next validates the current step only.
  - Desktop (1024px and up) keeps the current long-form layout with a sticky side summary.
- **Draft persistence:** save form state to `localStorage` on change, with a "Restore draft?" prompt. Phones get interrupted (calls, app switching), and Tier 2/3 networks drop.
- **Media step:**
  - `<input type="file" accept="image/*,video/*" multiple>` with separate "Take photo" (`capture="environment"`) and "Choose from library" buttons.
  - Thumbnails go in a 3-column grid, reordered with long-press drag **plus** ↑/↓ buttons (no gesture-only actions).
  - Upload progress per file, with retry on failure.
  - Compress images on the client (canvas, longest edge 2048px, about 0.82 quality) before upload.
  - Warn when a video is larger than about 50MB on cellular.
- **10-point condition grader (`ConditionRatingScale`):** one row per criterion with a 44px segmented control. Avoid tiny radio buttons.
- **Preview step:** shows the listing as a ListingCard and a PDP preview at phone width.

### 4.8 Favorites `/favorites` — `FavoritesPage`

- 2-column 3:4 grid, matching the catalog. Remove a look with the 44px heart (undo appears in a toast for 5 seconds).
- Empty state: an editorial illustration line plus a "Discover looks" CTA.

### 4.9 Bookings `/bookings`, `/bookings/:id` — `MyBookingsPage`, `BookingDetailPage`

- **List:**
  - The role toggle (Renter/Provider) is a full-width segmented control, 44px, sticky under the header.
  - Status filters are horizontally scrolling chips.
  - Each booking is a card: thumbnail, title, dates, a status pill (Pending / Confirmed / Active / Completed with semantic colours), and the deposit amount.
  - Pull-to-refresh is not added (browsers already handle overscroll). Provide a refresh button in the toolbar instead.
- **Detail:**
  - The lifecycle is a **vertical stepper** on phones (it's horizontal on desktop).
  - The return courier date uses the native date input (`BookingDetailPage.jsx:450`) inside a sheet.
  - Provider actions (Accept / Reject / Start / Mark returned) go in a **sticky bottom action bar**. The primary action is gold. Destructive actions (Reject/Cancel) are secondary, placed on the left away from the thumb's resting spot, and need a confirm bottom sheet (not `window.confirm`).
  - Booking reference hashes use the mono font with a 44px copy-to-clipboard button.

### 4.10 Orders `/orders` — `MyOrdersPage`

- Card list as in 4.9, with order status, item, ₹ total and date. Tapping expands inline details (accordion) on phones.

### 4.11 Profile `/profile` and Disputes `/disputes` — `ProfilePage`, `DisputesPage`

- **Profile:** grouped settings list (iOS-style rows, 52px tall): Personal info, Fit & measurements, KYC status (with a badge), Addresses, Payment, Sign out. Each row opens its own sub-screen or sheet.
  - Measurement fields use `inputmode="decimal"` and show units.
  - KYC document capture uses `accept="image/*" capture="environment"`.
- **Disputes:** the table (A16) becomes cards on phones. The new-dispute form is a single column with an explicit Booking-or-Order selector (a segmented control) and evidence photo upload as in 4.7.

### 4.12 Admin `/admin` — `AdminPage` (1,650 lines) — default D3: usable, not optimised

- **Tabs** (Disputes, KYC queue, Audit log, Reconciliation): horizontally scrolling tab bar, sticky, with 44px tabs.
- **Tables:** below 768px, each row becomes a card (label: value pairs) using a `data-label` attribute with CSS `::before`, which needs no extra JS. Wide reconciliation tables can instead use a horizontal scroll wrapper (`overflow-x: auto`, sticky first column, edge-fade shadow hint).
- **Actions:** the resolve/reject dispute form opens in a bottom sheet with a textarea (16px) and a sticky submit. KYC approve/reject buttons are 44px and stacked.
- Raise inputs from 0.85rem to 16px (A3).

### 4.13 Error and protected routes — `RouteErrorBoundary`, `ProtectedRoute`

- The error screen uses `100dvh` instead of inline `100vh`, has 16px gutters and a full-width "Go home" / "Retry" button.
- The ProtectedRoute redirect to login keeps the return URL, so a phone user returns to the same PDP after signing in.

---

## 5. Route × concern coverage matrix

✓ = covered by this plan · — = not applicable

| Route / component | Breakpoints | Safe area | dvh | 16px inputs | 44px targets | Hover gate | Sheet/drawer | Sticky CTA | Media loading | States (load/empty/error) |
| ------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| AppLayout (header/nav/footer) | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ menu | — | — | ✓ offline |
| `/` Home | ✓ | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ |
| `/listings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ filter/sort | ✓ filter | ✓ | ✓ |
| `/listings/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ dates/fit/lightbox | ✓ reserve | ✓ | ✓ |
| BagDrawer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ checkout | ✓ | ✓ |
| Auth (×4) | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ |
| `/lend` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `/listings/new` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ wizard | ✓ upload | ✓ |
| `/favorites` | ✓ | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ |
| `/bookings`, `/bookings/:id` | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ confirm/date | ✓ actions | ✓ | ✓ |
| `/orders` | ✓ | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ |
| `/profile` | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ KYC | ✓ |
| `/disputes` | ✓ | — | — | ✓ | ✓ | ✓ | — | — | ✓ evidence | ✓ |
| `/admin` | ✓ | — | — | ✓ | ✓ | ✓ | ✓ resolve | — | — | ✓ |
| FilterModal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| ReviewFormModal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| ToastContainer | ✓ | ✓ | — | — | ✓ | — | — | — | — | — |
| CatwalkVideoPlayer | ✓ | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ |
| TurnstileWidget | ✓ | — | — | — | — | — | — | — | — | ✓ |
| RouteErrorBoundary | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | ✓ |

---

## 6. Interaction, gesture and accessibility rules

| Rule | Spec |
| ------ | ------ |
| Thumb zone | The primary CTA on every transactional screen sits in the bottom third (sticky bar). Destructive actions go to the top or left, never next to the primary action |
| Gestures | Swipe is always optional. Every swipe (gallery, sheet dismiss, menu close, reorder) has a visible button equivalent |
| Tap feedback | `:active` gives a scale of 0.98 or an opacity of 0.85 within 100ms. Remove `-webkit-tap-highlight-color` and replace it with brand feedback |
| Focus | `:focus-visible` gold outline, 2px, offset 3px (already used in the lightbox; make it global) |
| Contrast | White on `#570020` is fine. Gold `#C8A251` on `#570020` is about 6.1:1, which passes AA at every size. Recheck any translucent white text (`rgba(255,255,255,0.6)` in the footer, inactive tabs) at a minimum of 4.5:1 |
| Motion | All animations use transform and opacity. `prefers-reduced-motion` turns off the marquee, carousel autoplay, the announcement rotation and spring overshoot |
| Screen readers | Sheets use `role="dialog" aria-modal="true"` with a labelled heading. Tab bar uses `<nav aria-label="Primary">`. Status pills include text, not colour alone |
| Orientation | Every screen works in landscape. Full-screen video and the lightbox use landscape space; forms stay single column, max-width 560px |
| Zoom | Works at 200% browser zoom and with the largest OS text size. Pinch-zoom is never disabled |
| Language | Copy keeps the couture vocabulary from PRODUCT.md. Shorter mobile variants are allowed in announcements and banners |

---

## 7. Performance and network (Tier 2/3 India)

| Metric (mid-range Android, Moto G-class, Fast 4G, Lighthouse mobile) | Budget |
| -------------------------------------------------------------------- | -------- |
| LCP (Home, `/listings`, PDP) | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 (reserve aspect ratios on all media using `aspect-ratio` tokens) |
| JS shipped on first load | ≤ 200KB gzip. Route-level `React.lazy` for `/admin`, `/listings/new` and `/lend` |
| Hero poster | ≤ 60KB AVIF/WebP |
| Video bytes before interaction on cellular | 0 |

- Fonts: Playfair and Inter are loaded from Google Fonts with `display=swap`. Subset the weights to only those used (currently 5 Inter + 5 Playfair). Consider self-hosting to drop the third-party connection.
- Turnstile script: it's `async defer` but loaded on every page. Load it only on auth routes.
- Lists over about 60 items: `content-visibility: auto` is enough. Don't add a virtualization library unless profiling shows a need.
- Caching: `Cache-Control` for images and posters via Cloudflare (already in the stack), with immutable hashed assets.

---

## 8. PWA-lite (D2 default)

- Add `manifest.webmanifest`: name, short_name, `theme_color: #570020`, `background_color: #570020`, `display: standalone`, 192/512 icons, and a maskable icon.
- Add `apple-touch-icon` (180px) and `apple-mobile-web-app-status-bar-style: black-translucent`. This works with the safe-area tokens.
- No service worker in v1. Revisit if analytics show repeat mobile visits on poor networks.

---

## 9. Testing and verification

`@playwright/test` is already a devDependency. Add `frontend/playwright.mobile.config.js` with device projects:

| Project | Device | Viewport |
| --------- | -------- | ---------- |
| `android-small` | Custom (Galaxy A-series class) | 360×640, DPR 3, touch |
| `iphone-se` | `devices['iPhone SE']` | 320 CSS px wide (worst case) |
| `iphone-15` | `devices['iPhone 15']` | 393×852 |
| `ipad` | `devices['iPad (gen 7)']` | 810×1080 |
| `desktop` | Desktop Chrome | 1440×900 (regression guard) |

**One spec, `tests/mobile/responsive.spec.mjs`, run against every route in §1.1:**

1. **No horizontal overflow:** `expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)`.
2. **Tap-target scan:** query `a, button, input, select, textarea, [role=button], [tabindex]:not([tabindex="-1"])`, filter to visible elements, and fail if any `getBoundingClientRect()` is smaller than 44×44 (with an allowlist for inline text links inside paragraphs).
3. **Input font size:** every visible `input/select/textarea` has a computed `font-size` of at least 16px on phone projects.
4. **Screenshot per route per device** with `toHaveScreenshot`, to catch visual regressions.
5. **Critical flows on `android-small` and `iphone-15`:** browse → filter → PDP → select dates → reserve → bag shows the item; login form submit; create-listing wizard Next/Back.

Protected routes use a seeded test user from the existing `tests/integration` helpers.

**Manual checks (real devices, release gate):**

- An iPhone with a notch, in Safari and as a home-screen app (safe areas, URL bar collapse, date picker, upload with camera).
- A mid-range Android in Chrome (scroll jank on the sticky header, video data use, back-button behaviour closing sheets).
- Dark-mode phone (native controls render light), 200% text size, VoiceOver and TalkBack on the PDP and Bag.
- Network throttled to "Slow 4G" in DevTools: Home and PDP stay usable, and posters appear before video.

**Tooling:** the chrome-devtools MCP (`emulate`, `resize_page`, `lighthouse_audit`) can run emulation and Lighthouse mobile audits per route during development.

---

## 10. Delivery roadmap

| Phase | Scope | Main files | Estimate | Exit criteria |
| ------- | ------- | ------------ | ---------- | --------------- |
| **P0 Foundations** | §2: breakpoints doc, safe areas, dvh, 16px inputs, tap tokens, hover gating helper, type and spacing scale, z-index, media rules | `index.html`, `styles/variables.css`, `styles/global.css`, `styles/reset.css` | 2–3 days | Phase 0 checklist passes, Playwright overflow and font-size checks pass on all routes |
| **P1 Shell** | §3: header, bottom tab bar, menu sheet, announcement, search overlay, footer accordions, offline banner, shared sheet pattern | `AppLayout.jsx/.module.css`, new `BottomNav` inside AppLayout (no new file unless it exceeds about 80 lines), `BagDrawer`, `FilterModal` | 3–4 days | Shell works at 320–1440px; menu accessible; no overlap with the bottom bar |
| **P2a Renter flow** | §4.1–4.5: Home, Listings, PDP, Bag, Auth | Home components, `ListingsPage`, `ListingCard`, `ListingDetailPage` and rental components, `AuthPages`, `TurnstileWidget` | 6–8 days | Critical-flow E2E passes on phones; LCP budget met |
| **P2b Lender flow** | §4.6–4.7: Lend, Create Listing wizard, media upload | `LendPage`, `LenderIncomeCalculator`, `CreateListingPage`, `ConditionRatingScale` | 4–5 days | Listing created end-to-end on a phone, including a camera upload |
| **P2c Account** | §4.8–4.11, 4.13 | Favorites, Bookings, Orders, Profile, Disputes, RouteErrorBoundary | 3–4 days | All account routes pass the automated scans |
| **P2d Admin** | §4.12 | `AdminPage` | 2 days | All admin actions reachable at 360px |
| **P3 Polish & perf** | §6–§8: reduced motion, a11y sweep, font subsetting, lazy routes, manifest, real-device QA | various | 2–3 days | Lighthouse mobile ≥ 90 Performance and ≥ 95 Accessibility on Home, Listings and PDP |

**Total: about 22–29 working days for one frontend engineer.** Do P0 and P1 first, in order. P2a–P2d can run in parallel across engineers once P1 has landed.

**Working rules for implementation**

- Migrate each CSS Module **once**: breakpoints, hover gating, tap targets and dvh together, to avoid touching 13.7k lines repeatedly.
- Keep the desktop look identical. The desktop Playwright project's screenshot diff must stay at zero unless a change is intended.
- No new runtime dependencies are needed. Scroll-snap, `<details>`, native date/file inputs, `matchMedia`, `IntersectionObserver` and `dvh` cover everything here.

---

## 11. Out of scope / later

- A native iOS/Android app (React Native or Flutter). If one is wanted later, this plan's IA (bottom tabs, sheets, sticky CTAs) carries over directly.
- A service worker with an offline catalog and background sync (D2).
- Push notifications for return reminders. Web Push on iOS works only for home-screen PWAs, so revisit together with D2.
- A full redesign of Admin for phones (D3).
