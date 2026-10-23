-- Migration 005 — Financial records.
--
-- payments         : payment attempts and settlements (provider-agnostic)
-- payment_events   : append-only event log; idempotency/reconciliation
-- security_deposits: liability ledger per booking (NOT revenue)
-- refunds          : refund attempts against a payment
--
-- Financial history is never cascade-deleted: child FKs use RESTRICT, and
-- users/listings referenced by financial rows cannot be hard-deleted either.

-- ============================================================
-- Payments
-- ============================================================
CREATE TABLE public.payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id       UUID REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    order_id                UUID REFERENCES public.orders (id) ON DELETE RESTRICT,
    payment_type            VARCHAR(20) NOT NULL,
    direction               VARCHAR(10) NOT NULL,
    amount_paise            BIGINT      NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider                VARCHAR(100),
    provider_transaction_id VARCHAR(255),
    idempotency_key         VARCHAR(255),
    recorded_by_user_id     UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Exactly one business entity per payment row.
    CONSTRAINT payments_entity_xor CHECK (
        (rental_booking_id IS NULL) <> (order_id IS NULL)
    ),
    CONSTRAINT payments_type_allowed CHECK (payment_type IN (
        'rental', 'sale', 'deposit', 'refund', 'commission', 'payout'
    )),
    -- Type/entity consistency.
    CONSTRAINT payments_type_entity_match CHECK (
        (payment_type IN ('rental', 'deposit', 'commission') AND rental_booking_id IS NOT NULL) OR
        (payment_type IN ('sale')                      AND order_id IS NOT NULL) OR
        (payment_type IN ('refund', 'payout')
             AND (rental_booking_id IS NOT NULL OR order_id IS NOT NULL))
    ),
    CONSTRAINT payments_direction_allowed CHECK (direction IN ('in', 'out')),
    CONSTRAINT payments_amount_positive CHECK (amount_paise > 0),
    CONSTRAINT payments_status_allowed CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled'))
);

-- Idempotency: a repeat request with the same key resolves to one payment.
CREATE UNIQUE INDEX payments_idempotency_key_unique
    ON public.payments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Provider event dedupe fallback (provider+their ref uniquely identifies a payment).
CREATE UNIQUE INDEX payments_provider_txn_unique
    ON public.payments (provider, provider_transaction_id)
    WHERE provider IS NOT NULL AND provider_transaction_id IS NOT NULL;

CREATE INDEX payments_booking_idx      ON public.payments (rental_booking_id);
CREATE INDEX payments_order_idx        ON public.payments (order_id);
CREATE INDEX payments_status_type_idx  ON public.payments (payment_type, status);

-- ============================================================
-- Payment events (append-only; no updated_at)
-- ============================================================
CREATE TABLE public.payment_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id        UUID NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
    event_type        VARCHAR(30) NOT NULL,
    provider_event_id VARCHAR(255),
    amount_paise      BIGINT,
    payload           JSONB,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payment_events_type_allowed CHECK (event_type IN (
        'initiated', 'succeeded', 'failed', 'cancelled',
        'refund_initiated', 'refund_succeeded', 'refund_failed', 'note'
    )),
    CONSTRAINT payment_events_amount_positive CHECK (amount_paise IS NULL OR amount_paise > 0)
);

-- At-least-once provider deliveries collapse on (payment, provider event) pairs.
CREATE UNIQUE INDEX payment_events_provider_event_unique
    ON public.payment_events (payment_id, provider_event_id)
    WHERE provider_event_id IS NOT NULL;

CREATE INDEX payment_events_payment_idx ON public.payment_events (payment_id, occurred_at);

-- ============================================================
-- Security deposits (liability ledger; one row per booking)
-- ============================================================
CREATE TABLE public.security_deposits (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id     UUID NOT NULL REFERENCES public.rental_bookings (id) ON DELETE RESTRICT,
    status                VARCHAR(20) NOT NULL DEFAULT 'held',
    collected_amount_paise BIGINT     NOT NULL,
    deduction_amount_paise BIGINT     NOT NULL DEFAULT 0,
    deduction_reason      TEXT,
    released_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Lifecycle: held -> releasing -> released | withheld
    CONSTRAINT security_deposits_status_allowed CHECK (status IN ('held', 'releasing', 'released', 'withheld')),
    CONSTRAINT security_deposits_one_row_per_booking UNIQUE (rental_booking_id),
    CONSTRAINT security_deposits_amounts CHECK (
        collected_amount_paise >= 0 AND deduction_amount_paise >= 0
        AND deduction_amount_paise <= collected_amount_paise
    ),
    CONSTRAINT security_deposits_deduction_has_reason CHECK (
        deduction_amount_paise = 0 OR deduction_reason IS NOT NULL
    )
);

CREATE INDEX security_deposits_status_idx ON public.security_deposits (status);

-- ============================================================
-- Refunds (attempts against an original payment)
-- ============================================================
CREATE TABLE public.refunds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          UUID NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
    refund_amount_paise BIGINT      NOT NULL,
    reason              VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    processed_at        TIMESTAMPTZ,
    created_by_user_id  UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT refunds_reason_allowed CHECK (reason IN (
        'customer_request', 'item_returned', 'quality_issue',
        'duplicate_charge', 'cancellation', 'platform_initiated'
    )),
    CONSTRAINT refunds_status_allowed CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT refunds_amount_positive CHECK (refund_amount_paise > 0)
);

CREATE INDEX refunds_payment_idx ON public.refunds (payment_id);
CREATE INDEX refunds_status_idx  ON public.refunds (status);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER security_deposits_updated_at
    BEFORE UPDATE ON public.security_deposits
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER refunds_updated_at
    BEFORE UPDATE ON public.refunds
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
