-- Migration 003 — Inventory and rentals.
--
-- inventory_items are physical units. Rental periods are half-open
-- [start_date, end_date); the GiST exclusion constraint prevents overlapping
-- blocking reservations for the same physical unit. Requires btree_gist.

-- btree_gist provides the equality operator class for UUID inside GiST
-- exclusion constraints. Needed only here and now.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- Inventory items (each row is one physical unit)
-- ============================================================
CREATE TABLE public.inventory_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id         UUID NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
    owner_type         VARCHAR(20) NOT NULL DEFAULT 'SELLER',
    owner_user_id      UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    serial_or_sku      VARCHAR(100),
    condition          VARCHAR(30) NOT NULL DEFAULT 'good',
    operational_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    acquired_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Same ownership pairing rules as listings.
    CONSTRAINT inventory_owner_pairing CHECK (
        (owner_type = 'SELLER'  AND owner_user_id IS NOT NULL) OR
        (owner_type = 'PLATFORM' AND owner_user_id IS NULL)
    ),
    CONSTRAINT inventory_owner_type_allowed CHECK (owner_type IN ('SELLER', 'PLATFORM')),
    -- Platform items must inherit the platform listing owner; service layer
    -- keeps owner consistent with the listing's owner.
    CONSTRAINT inventory_condition_allowed CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    -- Lifecycle statuses. "BOOKED" intentionally omitted: upcoming confirmed
    -- rentals are tracked by rental_booking_items rows, not a status value.
    CONSTRAINT inventory_status_allowed CHECK (operational_status IN (
        'AVAILABLE', 'RESERVED', 'RENTED', 'SALE_PENDING', 'SOLD',
        'MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED'
    )),
    CONSTRAINT inventory_sku_length CHECK (serial_or_sku IS NULL OR char_length(btrim(serial_or_sku)) BETWEEN 1 AND 100)
);

CREATE INDEX inventory_listing_status_idx ON public.inventory_items (listing_id, operational_status);
CREATE INDEX inventory_owner_idx          ON public.inventory_items (owner_user_id)
    WHERE owner_user_id IS NOT NULL;
CREATE INDEX inventory_status_idx         ON public.inventory_items (operational_status);

-- ============================================================
-- Rental bookings (header). renter is the user; provider is the listing owner.
-- ============================================================
CREATE TABLE public.rental_bookings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    renter_user_id         UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    rental_listing_id      UUID NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
    status                 VARCHAR(20) NOT NULL DEFAULT 'pending',
    start_date             DATE        NOT NULL,
    end_date               DATE        NOT NULL,
    -- Snapshots (immutable once confirmed): paise amounts at booking time.
    subtotal_amount_paise  BIGINT      NOT NULL,
    deposit_amount_paise   BIGINT      NOT NULL DEFAULT 0,
    total_amount_paise     BIGINT      NOT NULL,
    deposit_paid           BOOLEAN     NOT NULL DEFAULT false,
    actual_return_date     DATE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- State machine: pending -> confirmed -> active -> completed
    --                                  \-> cancelled / expired
    CONSTRAINT rental_bookings_status_allowed CHECK (status IN (
        'pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired'
    )),
    -- Half-open period [start_date, end_date); end is the return day.
    CONSTRAINT rental_bookings_period_dates CHECK (end_date > start_date),
    CONSTRAINT rental_bookings_money_nonnegative CHECK (
        subtotal_amount_paise >= 0 AND deposit_amount_paise >= 0 AND total_amount_paise >= 0
    ),
    CONSTRAINT rental_bookings_total_matches CHECK (total_amount_paise = subtotal_amount_paise + deposit_amount_paise),
    CONSTRAINT rental_bookings_return_date CHECK (
        actual_return_date IS NULL OR actual_return_date >= start_date
    )
);

-- The booking header spans its item periods (min start, max end); service keeps
-- these in sync. Indexes mirror real query patterns.
CREATE INDEX rental_bookings_renter_idx     ON public.rental_bookings (renter_user_id);
CREATE INDEX rental_bookings_listing_idx    ON public.rental_bookings (rental_listing_id);
CREATE INDEX rental_bookings_status_idx     ON public.rental_bookings (status);
CREATE INDEX rental_bookings_dates_idx      ON public.rental_bookings (rental_listing_id, start_date, end_date);

-- ============================================================
-- Rental booking items (one row per rented physical unit)
-- ============================================================
CREATE TABLE public.rental_booking_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id   UUID NOT NULL REFERENCES public.rental_bookings (id) ON DELETE CASCADE,
    inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items (id) ON DELETE RESTRICT,
    item_status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    start_date          DATE        NOT NULL,
    end_date            DATE        NOT NULL,
    -- Snapshot: per-day rate for THIS unit at booking time.
    daily_rate_paise    BIGINT      NOT NULL,
    line_total_paise    BIGINT      NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Item status values agree with the booking state machine; blocking set is
    -- ('pending','confirmed','active') and must match the exclusion constraint
    -- predicate and availability queries exactly.
    CONSTRAINT rental_booking_items_status_allowed CHECK (item_status IN (
        'pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired'
    )),
    CONSTRAINT rental_booking_items_period_dates CHECK (end_date > start_date),
    CONSTRAINT rental_booking_items_rates_nonnegative CHECK (daily_rate_paise >= 0 AND line_total_paise >= 0),
    -- line_total = rate * duration in days (date subtraction is integer days).
    CONSTRAINT rental_booking_items_line_total_matches CHECK (
        line_total_paise = (end_date - start_date) * daily_rate_paise
    )
);

CREATE INDEX rental_booking_items_booking_idx ON public.rental_booking_items (rental_booking_id);
CREATE INDEX rental_booking_items_item_idx    ON public.rental_booking_items (inventory_item_id);

-- Database-level protection against overlapping rentals for the same unit.
-- The predicate's status set must stay identical to blocking-status queries in
-- availability checks: ('pending','confirmed','active').
ALTER TABLE public.rental_booking_items
    ADD CONSTRAINT rental_booking_items_no_overlap
    EXCLUDE USING gist (
        inventory_item_id WITH =,
        daterange(start_date, end_date, '[)') WITH &&
    )
    WHERE (item_status IN ('pending', 'confirmed', 'active'));

-- ============================================================
-- Rental booking status history (append-only)
-- ============================================================
CREATE TABLE public.rental_booking_status_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id UUID NOT NULL REFERENCES public.rental_bookings (id) ON DELETE CASCADE,
    from_status       VARCHAR(20),
    to_status         VARCHAR(20) NOT NULL,
    changed_by_user_id UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    reason            TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rental_history_status_allowed CHECK (
        from_status IS NULL OR from_status IN (
            'pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired'
        )
    ),
    CONSTRAINT rental_history_to_status_allowed CHECK (
        to_status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired')
    )
);

-- Immutable: no updated_at, no mutable columns; appends only.
CREATE INDEX rental_history_booking_idx ON public.rental_booking_status_history (rental_booking_id, created_at);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER rental_bookings_updated_at
    BEFORE UPDATE ON public.rental_bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER rental_booking_items_updated_at
    BEFORE UPDATE ON public.rental_booking_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
