-- Migration 012 — Structured listing attributes for faceted discovery
-- (Phase 3).
--
-- Listings gain a validated JSONB `attributes` bag: facet keys to arrays of
-- enum values (occasion, neckline, sleeve, length, print, embellishment,
-- stylePersona, seasonality, maternity). Values are governed by the shared
-- facet taxonomy enforced in the service layer; the database guards the
-- coarse shape only — PostgreSQL CHECK constraints cannot contain subqueries,
-- so key/value enum validation happens on the write path before persistence.
-- Discovery filters use a GIN index (jsonb_path_ops) on the same column.

ALTER TABLE public.listings
    ADD COLUMN attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.listings
    ADD CONSTRAINT listings_attributes_shape CHECK (jsonb_typeof(attributes) = 'object');

CREATE INDEX listings_attributes_gin_idx
    ON public.listings USING gin (attributes jsonb_path_ops);
