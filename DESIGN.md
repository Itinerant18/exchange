---
name: Exchange Luxury Rental & Resale Design System
description: Indian luxury fashion rental, circular resale, and couture wardrobe monetization visual system

colors:
  canvas: "#570020"
  canvas-subtle: "#420022"
  canvas-alt: "#29000B"
  surface: "#FFFFFF"
  surface-silk: "#F8F8F8"
  surface-alabaster: "#FAF9F6"
  brand-burgundy: "#570020"
  brand-burgundy-hover: "#400017"
  brand-burgundy-subtle: "#FBEBF0"
  gold-zari: "#C8A251"
  gold-champagne: "#F4EBD9"
  gold-border: "rgba(200, 162, 81, 0.35)"
  ink-light: "#FFFFFF"
  ink-dark: "#1A1A1A"
  ink-secondary: "#4D4B47"
  ink-muted: "#7C7A75"
  ink-soft: "#CCCCCC"
  status-success: "#1B663E"
  status-warning: "#B36B00"
  status-error: "#BA2222"
  status-info: "#1B4B73"

typography:
  display:
    fontFamily: "Playfair Display, Canela, Didot, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 300
    lineHeight: 1.0
    letterSpacing: "-0.03em"
  body:
    fontFamily: "GT-America-Standard, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 300
    lineHeight: 1.3
  extended:
    fontFamily: "GT-America-Extended, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Space Mono, SF Mono, JetBrains Mono, monospace"
    fontSize: "0.8125rem"

rounded:
  none: "0px"
  xs: "12px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "40px"
  full: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "64px"

components:
  button-primary:
    backgroundColor: "{colors.gold-zari}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.full}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.gold-champagne}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-light}"
    border: "1px solid rgba(255, 255, 255, 0.35)"
    rounded: "{rounded.full}"
    padding: "12px 28px"
  card-luxury:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-burgundy}"
    rounded: "{rounded.sm}"
    border: "1px solid rgba(200, 162, 81, 0.25)"
    shadow: "0 12px 32px -8px rgba(0, 0, 0, 0.08)"
  badge-rental:
    backgroundColor: "rgba(87, 0, 32, 0.88)"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    border: "{colors.gold-border}"
---

# 1. Overview
The Exchange visual design system establishes a quiet-luxury editorial environment specifically calibrated for high-value Indian designer fashion. The aesthetic avoids generic SaaS patterns (such as standard purple-to-blue gradients, dense card-within-card stacking, and default Inter typography) in favor of high-fashion magazine cadence, generous editorial spacing (80–120px section padding), deep lacquer surfaces, and warm metallic embellishments.

The foundational identity is anchored in **Deep Royal Burgundy / Magenta (`#570020`)**, reflecting royal velvet, bridal kumkum, and Mughal lacquer. Elevated content cards emerge from this deep canvas in pure white and warm raw silk, framed by delicate Antique Zari Gold borders and frosted glass scrims.

# 2. Colors
The color palette separates into dark canvas anchors, elevated light surfaces, and metallic accents:

- **Primary Canvas Anchor (`#570020`)**: The signature Deep Royal Burgundy / Magenta canvas. Applied to global application backgrounds, hero frames, and primary interactive badges.
- **Deep Tonal Backings (`#420022` / `#29000B`)**: Used in secondary navigation bars, editorial process ribbons, and footer shells to generate deliberate tonal stacking without harsh contrasts.
- **Elevated Surfaces (`#FFFFFF` / `#F8F8F8` / `#FAF9F6`)**: Reserved for listing cards, filter drawers, checkout summaries, and calculation widgets. High-contrast Kajal Noir (`#1A1A1A`) and Espresso Slate (`#4D4B47`) typography are deployed strictly on these light surfaces.
- **Antique Zari Gold (`#C8A251`)**: Metallic 24k Zari gold used for authenticity seals, active tab indicators, primary conversion CTAs, and verified tailor guarantees. Paired with Champagne shimmer (`#F4EBD9`) for hover states.
- **High-Contrast Canvas Inks (`#FFFFFF` / `#CCCCCC`)**: Crisp white and silver typography rendered directly against the deep burgundy canvas to maintain AAA accessibility standards.
- **Semantic Status Inks**: Forest Emerald (`#1B663E`) for verified stock and sterilized status; Amber Ochre (`#B36B00`) for low booking slots; Crimson Ruby (`#BA2222`) for date clashes.

# 3. Typography
The typographic hierarchy merges classical high-fashion display serifs with crisp, technical grotesk sans-serifs:

- **Editorial Display Serif (`Playfair Display`, `Didot`, `Canela`)**: Employed for primary page headings, occasion collection titles, and product detail anchors. Set with light optical weight (300) and tight negative tracking (`-0.025em` to `-0.035em`) for an authentic magazine headline feel.
- **Modern Grotesk Body (`GT-America-Standard`, `Inter`)**: Deployed for long-form descriptions, sizing instructions, hygiene specifications, and logistical notes. Styled with comfortable line height (1.3 to 1.6) and high legibility.
- **Luxury Extended Eyebrows (`GT-America-Extended`)**: Used for category tags, verification badges, uppercase section eyebrows, and micro-labels. Rendered with wide letter tracking (`0.14em` to `0.18em`) and semibold weight (600).
- **Technical Monospace (`Space Mono`, `SF Mono`)**: Deployed for pincode transit calculations, booking reference hashes, and financial ledger figures.

# 4. Layout
Layouts adhere to an unhurried, editorial cadence with breathing room between thematic sections:

- **Max Content Width**: Standard container width capped at `90rem` (`1440px`), expanding to `1540px` for cinematic media showcases.
- **Section Spacing Rhythm**: Large editorial vertical spacing (`clamp(80px, 10vw, 120px)`) between home sections, eliminating cluttered visual crowding.
- **Aspect Ratio Taxonomy**:
  - `3:4 Portrait` (`--aspect-product: 3 / 4`): Mandatory for listing catalog cards, occasion carousels, and lookbook imagery.
  - `9:16 Vertical Runway` (`--aspect-runway-vertical: 9 / 16`): Reserved for catwalk motion reels and user fit showcases.
  - `2560:948 Ultra-Wide Cinematic`: Employed on the landing page hero video container.

# 5. Elevation & Depth
Elevation is achieved through tonal color shifts and frosted glassmorphism rather than heavy drop shadows:

- **Level 0 (Base Canvas)**: Deep Royal Burgundy (`#570020`) matte field.
- **Level 1 (Subtle Banding)**: Lacquer Noir (`#29000B`) and Wine Silk (`#420022`) bands creating gentle horizontal divisions.
- **Level 2 (Elevated Surfaces)**: Crisp Pure White (`#FFFFFF`) and Raw Silk (`#F8F8F8`) cards featuring hairline Antique Gold borders (`rgba(200, 162, 81, 0.25)`).
- **Level 3 (Floating Overlays & Drawers)**: Frosted translucent glass (`rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(12px)`) for wishlist buttons, filter slide-overs, and quick-size drawers.
- **Ambient Lighting**: Diffusion shadows using warm burgundy undertones (`rgba(87, 0, 32, 0.18)`) instead of synthetic grey casts.

# 6. Shapes
Geometry combines sharp architectural structure with soft pill elements:

- **Pill Geometry (`border-radius: 9999px`)**: Primary action buttons, category filter chips, trust badges, and floating status tags.
- **Architectural Radii (`16px` to `24px`)**: Outer card corners, video viewport wrappers, and modular calculation panes.
- **Hairline Borders (`1px`)**: Fine borders in Antique Gold (`var(--color-gold-border)`) and Burgundy hairline (`var(--color-hairline)`) providing tailored definition without visual weight.

# 7. Components
- **Primary Luxury Action Button**: Antique Zari Gold (`#C8A251`) fill with Kajal Noir (`#1A1A1A`) typography, full pill radius (`9999px`), and gentle spring lift (`transform: translateY(-2px)`) on hover.
- **Secondary Ghost Button**: Transparent background with fine white or gold border (`1px solid rgba(255, 255, 255, 0.35)`), white text, and subtle translucent hover fill.
- **Couture Listing Card**: 3:4 portrait aspect ratio, 2-line clamped editorial serif title, frosted glass wishlist morph button, live video hover preview, and INR daily rental price with retail anchor strikethrough.
- **Filter Slide-Over Drawer**: Right slide-over panel with frosted backdrop blur, grouped accordion sections for occasion and silhouette, and sticky bottom CTA displaying real-time look count.
- **Trust & Infographic Modules**: 4-pillar trust ribbon, 7-stage hygiene guarantee cards, CO2e circular sustainability calculator, and couture measurement basting guide.

# 8. Do's and Don'ts
- **DO** keep the primary application background anchored in the signature Deep Royal Burgundy / Magenta (`#570020`).
- **DO** render text on the magenta canvas in pure white (`#FFFFFF`) or metallic gold (`#C8A251`) to guarantee high contrast.
- **DO** format every single price in Indian Rupees with the `₹` symbol and Indian numbering format (e.g., `₹1,25,000`).
- **DO** maintain 3:4 portrait aspect ratios for all garment product imagery to celebrate full-length couture drapes.
- **DON'T** convert the background canvas to plain white or generic grey, as it strips the distinctive luxury Indian bridal and evening wear aesthetic.
- **DON'T** display foreign currency symbols (`$`, `USD`, `EUR`, `GBP`) on any surface.
- **DON'T** use generic SaaS drop shadows or neon gradient fills; all shadows must carry warm ambient undertones.
- **DON'T** stack cards inside cards without a clear shift in elevation and background tone.
