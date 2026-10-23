-- Migration 006 — Trust and administration: KYC, reviews, audit logs.
--
-- Reviews: enforced through a simple CHECK for no-self-review and a CHECK requirement that exactly one qualifying transaction target be provided. Duplicate per-transaction reviews prevented by partial indexes.
-- KYC: multiple attempts per user with masked provider references only. Audit logs are append-only with no generic FK to the entity (entity_id references vary) but retain the acting user's FK via RESTRICT for auditability.

-- ============================================================
-- KYC verifications (multiple attempts; private data; masked references)
-- ============================================================
CREATE TABLE public.kyc_verifications (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    verification_type    VARCHAR(30) NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider             VARCHAR(100),
    -- Masked/set by verification provider — FULL DOCUMENT NUMBERS ARE NEVER STORED.
    provider_reference   VARCHAR(255),
    document_url         VARCHAR(500),
    attempt_number       INTEGER     NOT NULL DEFAULT 1,
    expires_at           TIMESTAMPTZ,
    reviewed_by_user_id  UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    reviewed_at          TIMESTAMPTZ,
    rejection_reason     TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT kyc_verification_type_allowed CHECK (verification_type IN ('aadhaar', 'pan', 'passport', 'driver_license')),
    CONSTRAINT kyc_status_allowed CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
    CONSTRAINT kyc_attempt_positive CHECK (attempt_number >= 1),
    CONSTRAINT kyc_rejection_has_reason CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL),
    CONSTRAINT kyc_unique_attempt UNIQUE (user_id, attempt_number)
);

CREATE INDEX kyc_verifications_user_idx  ON public.kyc_verifications (user_id, created_at DESC);
CREATE INDEX kyc_verifications_status_idx ON public.kyc_verifications (status);

-- ============================================================
-- Reviews (rental-provider and renter reputation)
-- ============================================================
CREATE TABLE public.reviews (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    reviewee_user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    -- Exactly one qualifying transaction source.
    qualifying_rental_booking_id UUID REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    qualifying_order_id          UUID REFERENCES public.orders (id) ON DELETE RESTRICT,
    rating                       INTEGER     NOT NULL,
    comment                      TEXT,
    status                       VARCHAR(20) NOT NULL DEFAULT 'published',
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- no self review
    -- CHECK for exactly one qualifying transaction target (booking XOR order)
    CONSTRAINT reviews_self_review CHECK (reviewer_user_id <> reviewee_user_id),
    CONSTRAINT reviews_qualifying_target CHECK (
        (qualifying_rental_booking_id IS NOT NULL AND qualifying_order_id IS NULL) OR
        (qualifying_rental_booking_id IS NULL AND qualifying_order_id IS NOT NULL)
    ),
    CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_status_allowed CHECK (status IN ('published', 'hidden', 'removed'))
);

-- Prevent duplicate reviews for the same transaction pairing:
CREATE UNIQUE INDEX reviews_rental_unique
    ON public.reviews (reviewer_user_id, reviewee_user_id, qualifying_rental_booking_id)
    WHERE qualifying_rental_booking_id IS NOT NULL;

CREATE UNIQUE INDEX reviews_order_unique
    ON public.reviews (reviewer_user_id, reviewee_user_id, qualifying_order_id)
    WHERE qualifying_order_id IS NOT NULL;

CREATE INDEX reviews_reviewee_idx       ON public.reviews (reviewee_user_id);
CREATE INDEX reviews_reviewer_idx       ON public.reviews (reviewer_user_id);
CREATE INDEX reviews_booking_lookup_idx ON public.reviews (qualifying_rental_booking_id);
CREATE INDEX reviews_order_lookup_idx   ON public.reviews (qualifying_order_id);

-- ============================================================
-- Audit logs (append-only; entity id kept generic so no accidental FK cascade)
-- ============================================================
CREATE TABLE public.audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    action         VARCHAR(100) NOT NULL,
    entity_type    VARCHAR(50)  NOT NULL,
    entity_id      UUID,
    previous_value JSONB,
    new_value      JSONB,
    ip_address     INET,
    user_agent     VARCHAR(500),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT audit_logs_action_length CHECK (char_length(action) BETWEEN 1 AND 100),
    CONSTRAINT audit_logs_entity_type_allowed CHECK (entity_type IN (
        'user', 'listing', 'inventory_item', 'category', 'rental_booking',
        'order', 'payment', 'security_deposit', 'refund', 'review',
        'kyc_verification', 'refresh_session'
    ))
);

CREATE INDEX audit_logs_entity_idx  ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_actor_idx   ON public.audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER kyc_verifications_updated_at
    BEFORE UPDATE ON public.kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
