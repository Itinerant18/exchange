-- Migration 010 — Damage waiver fee + free backup size (Phase 1).
--
-- Payments stay COD. The damage waiver is an optional flat fee per booking,
-- stored as a static platform setting (unapproved by default, like late fees).
-- Backup sizes are real booking item rows: the second physical unit is
-- reserved and travels in the same delivery, at zero extra rental cost.
-- `is_backup_size` distinguishes it from the primary unit for pricing,
-- inspections, and UI labelling.

-- ============================================================
-- Rentals: damage waiver
-- ============================================================
ALTER TABLE public.rental_bookings
    ADD COLUMN damage_waiver_selected BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN damage_waiver_fee_paise BIGINT NOT NULL DEFAULT 0,
    -- The requested backup garment size (a preference matched to the physical
    -- backup unit reserved for the booking; NULL when no backup was requested).
    ADD COLUMN backup_size VARCHAR(50);

ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_damage_waiver CHECK (
        damage_waiver_fee_paise > 0 OR (damage_waiver_selected = false AND damage_waiver_fee_paise = 0));

-- ============================================================
-- Rental booking items: backup-size flag (zero-rated line)
-- ============================================================
ALTER TABLE public.rental_booking_items
    ADD COLUMN is_backup_size BOOLEAN NOT NULL DEFAULT false;

-- Backup lines carry no rental cost and must live in the same window as
-- their booking header (they ship in the same delivery).
ALTER TABLE public.rental_booking_items
    ADD CONSTRAINT rental_booking_items_backup_zero_rated CHECK (
        is_backup_size = false OR (daily_rate_paise = 0 AND line_total_paise = 0));

-- ============================================================
-- Platform settings: waiver pricing (business rate, unapproved by default)
-- ============================================================
INSERT INTO public.platform_settings (key, value, category, description, is_approved) VALUES
    ('damage_waiver_fee_paise', '1250', 'rental',
     'Optional damage waiver flat fee per booking in paise (1250 = Rs 12.50). Charged only when explicitly selected.', true),
    ('backup_sizes_enabled', 'true', 'rental',
     'Whether free backup-size pairing is offered at booking time.', true)
ON CONFLICT (key) DO NOTHING;
