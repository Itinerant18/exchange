-- Migration 016 — Support user-generated event photos in reviews ("Our Runway" Photo Community)
--
-- Renters can upload real photos of themselves wearing the garment at events
-- (weddings, galas, parties) alongside their body specs (height, weight, bust, size worn).

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
