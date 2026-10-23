-- 007: Loosen `payments_type_entity_match` so that `commission` and `payout`
-- rows may reference either a rental booking or a sales order. The original
-- constraint (migration 005) forced commissions onto bookings only, which
-- cannot represent commissions earned on sale orders.
--
-- Immutability note: migrations 001-006 are already applied and stay untouched;
-- this is a new, additive migration.
--
-- Old shape:
--   rental/deposit/commission  -> booking only
--   sale                       -> order only
--   refund/payout              -> booking or order
--
-- New shape:
--   rental/deposit             -> booking only
--   sale                       -> order only
--   refund/commission/payout   -> booking or order

BEGIN;

ALTER TABLE public.payments
    DROP CONSTRAINT payments_type_entity_match;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_type_entity_match CHECK (
        (payment_type IN ('rental', 'deposit') AND rental_booking_id IS NOT NULL) OR
        (payment_type = 'sale'                 AND order_id IS NOT NULL) OR
        (payment_type IN ('refund', 'commission', 'payout')
             AND (rental_booking_id IS NOT NULL OR order_id IS NOT NULL))
    ) NOT VALID;

ALTER TABLE public.payments
    VALIDATE CONSTRAINT payments_type_entity_match;

COMMIT;
