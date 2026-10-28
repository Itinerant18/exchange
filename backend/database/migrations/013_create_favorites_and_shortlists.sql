-- Migration 013 — User favorites and shortlists ("Hearts" / Curations Phase 6).
--
-- favorites: simple per-user saved listings (hearting a piece on PLP/PDP).
-- shortlists: user-created moodboards / occasion curation lists (e.g. "Summer Weddings 2026").
-- shortlist_items: listings added to a specific user shortlist.

CREATE TABLE IF NOT EXISTS public.favorites (
    user_id    UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_listing_idx ON public.favorites (listing_id);

CREATE TABLE IF NOT EXISTS public.shortlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shortlists_user_idx ON public.shortlists (user_id);

CREATE TABLE IF NOT EXISTS public.shortlist_items (
    shortlist_id UUID NOT NULL REFERENCES public.shortlists (id) ON DELETE CASCADE,
    listing_id   UUID NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (shortlist_id, listing_id)
);

CREATE INDEX IF NOT EXISTS shortlist_items_listing_idx ON public.shortlist_items (listing_id);
