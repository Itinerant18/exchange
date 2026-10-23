-- Migration 004 — Sales: orders and order items.
--
-- One order line row = one claimed physical unit (no quantity column; the row
-- itself is the unit). The partial unique index below enforces that one
-- physical unit cannot be claimed by two active orders. Cancelled/refunded
-- line rows release the claim, allowing a later order.

-- ============================================================
-- Orders (header)
-- ============================================================
CREATE TABLE public.orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_user_id      UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    status             VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Snapshot totals (sum of line prices) fixed at creation; immutable.
    total_amount_paise BIGINT      NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- State machine: pending -> paid -> refunded
    --                                  \-> cancelled
    CONSTRAINT orders_status_allowed CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
    CONSTRAINT orders_total_nonnegative CHECK (total_amount_paise >= 0)
);

CREATE INDEX orders_buyer_idx  ON public.orders (buyer_user_id);
CREATE INDEX orders_status_idx ON public.orders (status);

-- ============================================================
-- Order items (one row per physical unit)
-- ============================================================
CREATE TABLE public.order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items (id) ON DELETE RESTRICT,
    listing_id        UUID NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
    unit_price_paise  BIGINT      NOT NULL,
    -- Line status mirrors the owning order's status; the service updates both
    -- in the same transaction. This column powers the sale-claim index.
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT order_items_price_nonnegative CHECK (unit_price_paise >= 0),
    CONSTRAINT order_items_status_allowed CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded'))
);

-- SALE EXCLUSIVITY: an inventory item can be claimed by at most one order whose
-- line status is pending or paid. All index terms come from order_items itself.
-- Statuses excluded by the predicate (cancelled/refunded) free the claim.
CREATE UNIQUE INDEX order_items_sale_claim
    ON public.order_items (inventory_item_id)
    WHERE status IN ('pending', 'paid');

CREATE INDEX order_items_order_idx     ON public.order_items (order_id);
CREATE INDEX order_items_listing_idx   ON public.order_items (listing_id);
CREATE INDEX order_items_buyer_lookup_idx ON public.orders (buyer_user_id, created_at DESC);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER order_items_updated_at
    BEFORE UPDATE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
