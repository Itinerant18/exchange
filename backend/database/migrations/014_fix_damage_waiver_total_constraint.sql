-- Migration 014 — Update rental_bookings total constraint to include damage waiver fee
--
-- The damage waiver fee is added to total_amount_paise when damage_waiver_selected = true.
-- Update rental_bookings_total_matches to ensure total_amount_paise = subtotal_amount_paise + deposit_amount_paise + damage_waiver_fee_paise.

ALTER TABLE public.rental_bookings
    DROP CONSTRAINT IF EXISTS rental_bookings_total_matches;

ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_total_matches CHECK (
        total_amount_paise = subtotal_amount_paise + deposit_amount_paise + damage_waiver_fee_paise);
