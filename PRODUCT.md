<!-- impeccable:product-schema 1 -->
# Exchange — Luxury Occasion-Wear Rental & Circular Resale Platform

## Platform
web

## Users
1. **Occasion & Event Renters**: High-intent individuals across India attending weddings, sangeets, black-tie galas, cocktails, and milestone celebrations who seek authenticated designer couture (Sabyasachi, Tarun Tahiliani, Manish Malhotra, Badgley Mischka, Reformation) without the burden of full retail acquisition or one-time wear waste.
2. **Wardrobe Lenders & Consignors**: Fashion collectors and couture owners monetizing archival, pristine ensembles through automated rental yield calculations (6.5% base fee, 20% platform commission) and white-glove consignment handling.
3. **Operations & Master Tailor Atelier**: Logistics coordinators and tailors managing pincode-specific transit schedules, reversible custom basting adjustments, and clinical 7-stage ozone sterilization guarantees.
4. **Platform Administrators**: Compliance and verification officers managing dispute arbitrations, KYC identity verification, and multi-ledger financial reconciliations.

## Product Purpose
Exchange is a luxury circular fashion marketplace and peer-to-peer wardrobe monetization engine tailored for the Indian occasion-wear market. It bridges the gap between high-fashion couture and accessible event dressing by providing:
- Risk-free luxury rental in 4-day and 8-day event blocks with complimentary second backup sizing.
- Turnkey peace of mind via ₹299 Festive Care covering accidental stains, tears, and seam distress with zero security deposit hold for KYC-verified users.
- Reversible couture fitting engine allowing custom bust, waist, and hem length basting aligned with client heel heights.
- Certified hospital-grade 7-stage ozone sanitization and 365nm UV micro-scanning before sealed doorstep delivery.
- Passive income calculation and verified authentication scoring (10-point condition grader) for wardrobe lenders.

## Operating Context
- **Environments**: Responsive modern web application optimized across desktop, tablet, and mobile browsers (iOS Safari, Android Chrome).
- **Network & Geography**: Variable network conditions across Tier 1, Tier 2, and Tier 3 Indian cities with real-time pincode logistics verification (metro express 24–48h transit vs regional 72h buffers).
- **Time-Sensitive Event Cycles**: Tight event weekend deadlines requiring strict calendar reservation snap, automated return reminders, and instant courier dispatch coordination.

## Constraints & Requirements
- **Currency & Locale**: All pricing throughout the platform must be strictly denominated in Indian Rupees (`₹` / INR) formatted with standard Indian numeral grouping via `Intl.NumberFormat('en-IN')` (e.g., ₹1,50,000). Foreign currency indicators ($ / USD / EUR / GBP) are strictly prohibited.
- **Dual-Mode Transaction Matrix**: Complete separation of transactional logic between Rent Mode (rental duration, backup size selection, reversible basting, Festive Care waiver, return satchel tracking) and Buy Mode (outright circular archive purchase).
- **Design System Fidelity**: Canvas background anchored in Deep Royal Burgundy / Magenta (`#570020`), Kajal Noir (`#1A1A1A`), Raw Silk (`#F8F8F8`), and Antique Zari Gold (`#C8A251`).
- **Authentication & KYC Security**: Tiered deposit requirement where KYC verification unlocks zero-deposit reservations while unverified accounts require refundable deposit authorizations.
- **Micro-Interaction Standards**: Fluid editorial transitions, spring-physics motion curves (`cubic-bezier(0.16, 1, 0.3, 1)`), 9:16 vertical catwalk video integration, and 3:4 portrait aspect ratios for catalog exploration.

## Key Workflows & Surfaces
1. **Editorial Landing Page (`/`)**: Cinematic full-coverage video showcase hero, brand marquee ticker, curated occasion carousel, trending couture grid on deep burgundy canvas, luxury 4-pillar trust ribbon, animated value props, customer runway gallery, and multi-video 9:16 Haute Couture catwalk motion showcase (Bridal lehengas, evening gowns, concept drapes).
2. **Couture Catalog & Multi-Axis Filter Drawer (`/listings`)**: 3:4 portrait product grid with hover video previews, dynamic silhouette filters, occasion pills, and price-per-day sorting in INR.
3. **Product Detail Page (`/listings/:id`)**: Dual-mode Rent vs Buy switcher, date-picker calendar, complimentary backup size selector, couture fitting basting drawer, and Festive Care micro-insurance toggle.
4. **Lender Studio & Monetization Hub (`/lend`, `/listings/new`)**: Passive income yield calculator, 10-point condition grader, vertical video uploader, and earnings tracker.
5. **Renter Booking Management (`/rentals/me`, `/rentals/:id`)**: Real-time rental lifecycle tracking (Pending -> Confirmed -> Active -> Completed), security deposit visibility, and return courier scheduling.
6. **Dispute Arbitration & Admin Suite (`/disputes`, `/admin`)**: Validated dispute resolution portal, audit logging, KYC verification queue, and automated ledger reconciliation.

## Voice & Persona
- **Tone**: Understated luxury, authoritative editorial fashion voice, warm Indian hospitality, and reassuring clinical precision regarding garment hygiene.
- **Vocabulary**: Prefers couture terminology ("Atelier", "Archive", "Heirloom", "Basting", "Zari", "Festive Care", "Showroom Pristine") over generic retail jargon ("cheap", "discount", "used", "second-hand").

