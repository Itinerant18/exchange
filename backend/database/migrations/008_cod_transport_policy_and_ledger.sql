-- Migration 008 — COD, transport charges, policies, earnings ledger,
-- disputes/inspections, password recovery, and analytics events.
--
-- COD note: `payments` already records every collection honestly (pending ->
-- succeeded via an authorized manual record, with collector + provider
-- reference). New payment types extend the same ledger to late fees, damage
-- charges, and transportation charges instead of inventing side ledgers.
-- Wallet payout stays OUT of scope; the earnings ledger is reconciliation
-- friendly so a future wallet can be built on it WITHOUT schema rewrites.

-- ============================================================
-- Platform settings (single source of truth for business policy)
-- ============================================================
CREATE TABLE public.platform_settings (
    key            VARCHAR(100) PRIMARY KEY,
    value          JSONB        NOT NULL,
    category       VARCHAR(50)  NOT NULL,
    description    TEXT,
    is_approved    BOOLEAN      NOT NULL DEFAULT false,
    updated_by     UUID         REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT platform_settings_category_allowed CHECK (category IN (
        'payment', 'delivery', 'rental', 'trust', 'listing'
    ))
);

CREATE INDEX platform_settings_category_idx ON public.platform_settings (category);

-- Seeds mark the current BUSINESS RATE but leave approval FALSE so no fee is
-- imposed automatically until the business owner approves it (see reports).
INSERT INTO public.platform_settings (key, value, category, description, is_approved) VALUES
    ('delivery_rate_paise_per_km', '1500', 'delivery',
     'Transport charge per km per journey, in paise (1500 = Rs 15).', true),
    ('transport_provider_receives', 'true', 'delivery',
     'Whether the provider (not the platform) collects transport charges. Decision point for launch.', false),
    ('late_fee_paise_per_day', '10000', 'rental',
     'Late fee per overdue day in paise. NOT enforced until approved.', false),
    ('late_fee_grace_days', '0', 'rental',
     'Grace days before a return counts as overdue. NOT enforced until approved.', false),
    ('late_fee_approved', 'false', 'rental',
     'Business owner approved the late-fee policy: automatic charges allowed.', false),
    ('damage_charge_mode', '"manual_quote"', 'rental',
     'How damage/missing-product charges are priced: manual_quote (default) | policy_table.', false),
    ('commission_bps', '500', 'payment',
     'Platform commission in basis points of rental subtotal (500 = 5%).', false),
    ('max_rental_days', '90', 'rental',
     'Upper bound for a continuous booking period.', true),
    ('min_rental_days', '1', 'rental',
     'Lower bound for a continuous booking period.', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Listings: location-based discovery + delivery eligibility
-- ============================================================
ALTER TABLE public.listings
    ADD COLUMN city               VARCHAR(120),
    ADD COLUMN delivery_available BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN delivery_radius_km NUMERIC(5,1);

CREATE INDEX listings_city_idx ON public.listings (city)
    WHERE listing_status = 'active' AND city IS NOT NULL;

-- ============================================================
-- Rental bookings: transportation selection + late-fee context
-- ============================================================
ALTER TABLE public.rental_bookings
    ADD COLUMN transport_mode                  VARCHAR(20)  NOT NULL DEFAULT 'none',
    ADD COLUMN outbound_distance_km            NUMERIC(7,2),
    ADD COLUMN return_distance_km              NUMERIC(7,2),
    ADD COLUMN transport_rate_paise_per_km     BIGINT,
    ADD COLUMN outbound_transport_amount_paise BIGINT       NOT NULL DEFAULT 0,
    ADD COLUMN return_transport_amount_paise   BIGINT       NOT NULL DEFAULT 0,
    -- Late-return bookkeeping (actual return recorded at return time).
    ADD COLUMN overdue_days                    INTEGER,
    ADD COLUMN late_fee_amount_paise           BIGINT,
    ADD COLUMN late_fee_approved_at            TIMESTAMPTZ,
    ADD COLUMN late_fee_approved_by            UUID         REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_transport_mode_allowed CHECK (
        transport_mode IN ('none', 'outbound', 'return', 'both')),
    ADD CONSTRAINT rental_bookings_transport_distance CHECK (
        (outbound_distance_km IS NULL OR outbound_distance_km >= 0) AND
        (return_distance_km  IS NULL OR return_distance_km  >= 0)),
    ADD CONSTRAINT rental_bookings_transport_amounts CHECK (
        outbound_transport_amount_paise >= 0 AND return_transport_amount_paise >= 0),
    -- A journey must have a distance whenever its fee is charged, and no fee
    -- is allowed when the journey was not selected.
    ADD CONSTRAINT rental_bookings_transport_pairing CHECK (
        (transport_mode IN ('outbound', 'both') AND outbound_distance_km IS NOT NULL
            AND outbound_transport_amount_paise > 0)
     OR (transport_mode IN ('none', 'return') AND outbound_transport_amount_paise = 0)),
    ADD CONSTRAINT rental_bookings_late_fee CHECK (
        late_fee_amount_paise IS NULL AND overdue_days IS NULL
     OR late_fee_amount_paise >= 0 AND overdue_days >= 0);

-- ============================================================
-- Booking extensions (audit-friendly: current dates + requested window)
-- ============================================================
CREATE TABLE public.booking_extensions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id UUID NOT NULL REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    requested_by_type VARCHAR(20) NOT NULL DEFAULT 'renter',
    new_end_date      DATE        NOT NULL,
    additional_days   INTEGER     NOT NULL,
    additional_amount_paise BIGINT NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    decided_by        UUID        REFERENCES public.users (id) ON DELETE RESTRICT,
    decided_at        TIMESTAMPTZ,
    rejection_reason  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT booking_extensions_requester_allowed CHECK (requested_by_type IN ('renter', 'provider', 'admin')),
    CONSTRAINT booking_extensions_additional_days CHECK (additional_days BETWEEN 1 AND 90),
    CONSTRAINT booking_extensions_status_allowed CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT booking_extensions_decided_once CHECK (
        (status IN ('approved', 'rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
     OR (status IN ('pending', 'cancelled') AND decided_by IS NULL AND decided_at IS NULL))
);

CREATE INDEX booking_extensions_booking_idx ON public.booking_extensions (rental_booking_id);

-- ============================================================
-- Return inspections (evidence-backed; no automatic penalties)
-- ============================================================
CREATE TABLE public.return_inspections (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id     UUID NOT NULL REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    inspected_by_user_id  UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    result                VARCHAR(20) NOT NULL,
    notes                 TEXT,
    evidence_urls         JSONB  NOT NULL DEFAULT '[]'::jsonb,
    estimated_recovery_paise BIGINT CHECK (estimated_recovery_paise IS NULL OR estimated_recovery_paise > 0),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT return_inspections_result_allowed CHECK (result IN ('pass', 'damage', 'missing')),
    CONSTRAINT return_inspections_recovery_requires_problem CHECK (
        result = 'pass' OR estimated_recovery_paise IS NOT NULL)
);

CREATE UNIQUE INDEX return_inspections_one_per_booking
    ON public.return_inspections (rental_booking_id);

CREATE INDEX return_inspections_booking_idx ON public.return_inspections (rental_booking_id);

-- ============================================================
-- Disputes (late, damage, missing, quality, refund)
-- ============================================================
CREATE TABLE public.disputes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id UUID REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    order_id          UUID REFERENCES public.orders (id) ON DELETE RESTRICT,
    opened_by_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    against_user_id   UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    dispute_type      VARCHAR(30) NOT NULL,
    description       TEXT        NOT NULL,
    evidence_urls     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    status            VARCHAR(20) NOT NULL DEFAULT 'open',
    resolution        TEXT,
    resolved_by       UUID        REFERENCES public.users (id) ON DELETE RESTRICT,
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT disputes_target_xor CHECK (
        (rental_booking_id IS NULL) <> (order_id IS NULL)),
    CONSTRAINT disputes_type_allowed CHECK (dispute_type IN (
        'late_return', 'damage', 'missing_item', 'quality_issue', 'refund', 'other')),
    CONSTRAINT disputes_status_allowed CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
    CONSTRAINT disputes_resolution_once CHECK (
        (status IN ('resolved', 'rejected') AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolution IS NOT NULL)
     OR (status IN ('open', 'under_review') AND resolved_by IS NULL AND resolution IS NULL))
);

CREATE INDEX disputes_booking_idx      ON public.disputes (rental_booking_id) WHERE rental_booking_id IS NOT NULL;
CREATE INDEX disputes_status_idx       ON public.disputes (status);
CREATE INDEX disputes_opened_by_idx    ON public.disputes (opened_by_user_id);

-- ============================================================
-- Earnings ledger (reconciliation-friendly; future wallet substrate)
-- ============================================================
CREATE TABLE public.earnings_ledger (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    entry_direction    VARCHAR(10) NOT NULL,
    entry_type         VARCHAR(30) NOT NULL,
    -- Exactly one business source; idempotent per (source, type).
    rental_booking_id  UUID REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    order_id           UUID        REFERENCES public.orders (id) ON DELETE RESTRICT,
    source_type        VARCHAR(30) NOT NULL,
    source_id          UUID,
    amount_paise       BIGINT      NOT NULL,
    idempotency_key    VARCHAR(255),
    memo               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ledger_direction_allowed CHECK (entry_direction IN ('credit', 'debit')),
    CONSTRAINT ledger_type_allowed CHECK (entry_type IN (
        'rental_earning', 'sale_earning', 'transport_earning',
        'late_fee', 'damage_charge', 'refund', 'commission', 'adjustment')),
    CONSTRAINT ledger_source_required CHECK (
        (rental_booking_id IS NOT NULL AND order_id IS NULL)
     OR (rental_booking_id IS NULL AND order_id IS NOT NULL)
     OR source_id IS NOT NULL),
    CONSTRAINT ledger_amount_positive CHECK (amount_paise > 0)
);

-- Idempotency: one entry per (business source, entry type) unless a replay
-- key is supplied; protects against double crediting under retries.
CREATE UNIQUE INDEX ledger_source_type_unique
    ON public.earnings_ledger (COALESCE(rental_booking_id::text, order_id::text, source_id::text), entry_type)
    WHERE rental_booking_id IS NOT NULL OR order_id IS NOT NULL OR source_id IS NOT NULL;

CREATE UNIQUE INDEX ledger_idempotency_unique
    ON public.earnings_ledger (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX ledger_user_created_idx ON public.earnings_ledger (user_id, created_at DESC);
CREATE INDEX ledger_user_booking_idx ON public.earnings_ledger (user_id, rental_booking_id);

-- ============================================================
-- Password recovery (single-use hashed tokens)
-- ============================================================
CREATE TABLE public.password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT password_reset_tokens_hash_key UNIQUE (token_hash),
    CONSTRAINT password_reset_tokens_hash_length CHECK (char_length(token_hash) = 64)
);

CREATE INDEX password_reset_tokens_user_idx ON public.password_reset_tokens (user_id);

-- ============================================================
-- Analytics events (privacy-aware, deduped by viewer session hash)
-- ============================================================
CREATE TABLE public.metrics_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type         VARCHAR(30) NOT NULL,
    listing_id         UUID        REFERENCES public.listings (id) ON DELETE RESTRICT,
    owner_user_id      UUID        REFERENCES public.users (id) ON DELETE RESTRICT,
    viewer_user_id     UUID        REFERENCES public.users (id) ON DELETE RESTRICT,
    viewer_session_key VARCHAR(64) NOT NULL,
    hour_bucket        VARCHAR(16) NOT NULL,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT metrics_events_type_allowed CHECK (event_type IN (
        'listing_impression', 'profile_view', 'search_appearance')),
    CONSTRAINT metrics_events_target CHECK (
        (event_type = 'listing_impression' AND listing_id IS NOT NULL)
     OR (event_type = 'profile_view' AND owner_user_id IS NOT NULL)
     OR (event_type = 'search_appearance' AND listing_id IS NOT NULL)),
    CONSTRAINT metrics_events_hour_bucket_format CHECK (hour_bucket ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$'),
    CONSTRAINT metrics_events_no_owner_selfbump CHECK (
        viewer_user_id IS NULL OR owner_user_id IS NULL OR viewer_user_id <> owner_user_id OR listing_id IS NULL)
);

-- Dedupe: repeated refreshes do not inflate unique views. One event per
-- (type, target, session, UTC hour); the app supplies hour_bucket as the
-- plain 'YYYY-MM-DDTHH' UTC stamp so the index stays expression-free.
CREATE UNIQUE INDEX metrics_events_dedupe_unique
    ON public.metrics_events (
        event_type,
        COALESCE(listing_id::text, owner_user_id::text),
        viewer_session_key,
        hour_bucket
    );

CREATE INDEX metrics_events_listing_idx   ON public.metrics_events (listing_id, occurred_at DESC);
CREATE INDEX metrics_events_owner_idx     ON public.metrics_events (owner_user_id, occurred_at DESC);
CREATE INDEX metrics_events_type_time_idx ON public.metrics_events (event_type, occurred_at DESC);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER platform_settings_updated_at
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER disputes_updated_at
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
