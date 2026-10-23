-- 009: Replace the earnings ledger dedupe index with an exact-match form for
-- ON CONFLICT inference from `ledger.service.js`. The original index from 008
-- included an optional source_id term that no runtime path uses (source_id
-- entries must supply an idempotency key instead), and ON CONFLICT inference
-- must mirror the index expression verbatim.

BEGIN;

DROP INDEX IF EXISTS public.ledger_source_type_unique;

CREATE UNIQUE INDEX ledger_source_type_unique
    ON public.earnings_ledger (COALESCE(rental_booking_id::text, order_id::text), entry_type)
    WHERE rental_booking_id IS NOT NULL OR order_id IS NOT NULL;

COMMIT;
