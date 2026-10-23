-- Migration 002 — Catalog: categories, listings, listing images.
--
-- Listings are commercial offers; physical units live in inventory_items (003).
-- Owner model: owner_type/owner_user_id pairs; PLATFORM rows have NULL owner
-- (no fake platform user). CHECK constraints enforce the pairing.

-- ============================================================
-- Categories (tree via parent_id; deactivate instead of delete)
-- ============================================================
CREATE TABLE public.categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id     UUID REFERENCES public.categories (id) ON DELETE RESTRICT,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(120) NOT NULL,
    description   TEXT,
    image_url     VARCHAR(500),
    display_order INTEGER      NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT categories_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
    CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT categories_slug_length CHECK (char_length(slug) BETWEEN 1 AND 120),
    CONSTRAINT categories_display_order_nonnegative CHECK (display_order >= 0),
    -- A category cannot be its own parent (multi-level cycles are prevented in
    -- the service layer by walking ancestors).
    CONSTRAINT categories_no_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

-- Same name allowed in different branches; NULL parents (roots) compared too.
CREATE UNIQUE INDEX categories_parent_name_unique
    ON public.categories (parent_id, lower(name)) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX categories_slug_unique ON public.categories (slug);

CREATE INDEX categories_parent_id_idx ON public.categories (parent_id);
CREATE INDEX categories_active_roots_idx ON public.categories (parent_id, display_order)
    WHERE is_active AND parent_id IS NULL;

-- ============================================================
-- Listings
-- ============================================================
CREATE TABLE public.listings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type              VARCHAR(20) NOT NULL DEFAULT 'SELLER',
    owner_user_id           UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    category_id             UUID NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
    title                   VARCHAR(200) NOT NULL,
    description             TEXT,
    condition               VARCHAR(30)  NOT NULL,
    size                    VARCHAR(50),
    colour                  VARCHAR(100),
    brand                   VARCHAR(100),
    -- All monetary values are integer paise (BIGINT); no floating point.
    rental_price_paise      BIGINT,
    sale_price_paise        BIGINT,
    deposit_paise           BIGINT,
    replacement_value_paise BIGINT,
    is_rental               BOOLEAN NOT NULL DEFAULT true,
    is_sale                 BOOLEAN NOT NULL DEFAULT false,
    listing_status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ownership pairing: SELLER rows reference a real user, PLATFORM rows have none.
    CONSTRAINT listings_owner_pairing CHECK (
        (owner_type = 'SELLER'  AND owner_user_id IS NOT NULL) OR
        (owner_type = 'PLATFORM' AND owner_user_id IS NULL)
    ),
    CONSTRAINT listings_owner_type_allowed CHECK (owner_type IN ('SELLER', 'PLATFORM')),
    CONSTRAINT listings_title_min_length CHECK (char_length(btrim(title)) >= 3),
    CONSTRAINT listings_condition_allowed CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    CONSTRAINT listings_mode_at_least_one CHECK (is_rental = true OR is_sale = true),
    CONSTRAINT listings_status_allowed CHECK (listing_status IN ('active', 'inactive', 'retired')),
    CONSTRAINT listings_rental_price_present CHECK (is_rental = false OR rental_price_paise IS NOT NULL),
    CONSTRAINT listings_sale_price_present   CHECK (is_sale = false OR sale_price_paise IS NOT NULL),
    -- Deposit only makes sense for rental offers.
    CONSTRAINT listings_deposit_only_rental CHECK (deposit_paise IS NULL OR is_rental = true),
    CONSTRAINT listings_money_nonnegative CHECK (
        (rental_price_paise      IS NULL OR rental_price_paise      >= 0) AND
        (sale_price_paise        IS NULL OR sale_price_paise        >= 0) AND
        (deposit_paise           IS NULL OR deposit_paise           >= 0) AND
        (replacement_value_paise IS NULL OR replacement_value_paise >= 0)
    )
);

-- Query patterns: public listings filtered by status/category/mode/price.
CREATE INDEX listings_category_status_idx ON public.listings (category_id, listing_status);
CREATE INDEX listings_active_rental_idx   ON public.listings (rental_price_paise)
    WHERE listing_status = 'active' AND is_rental = true;
CREATE INDEX listings_active_sale_idx     ON public.listings (sale_price_paise)
    WHERE listing_status = 'active' AND is_sale = true;
CREATE INDEX listings_owner_idx           ON public.listings (owner_user_id)
    WHERE owner_user_id IS NOT NULL;
CREATE INDEX listings_status_idx          ON public.listings (listing_status);

-- ============================================================
-- Listing images (object-storage metadata only; keys are unique)
-- ============================================================
CREATE TABLE public.listing_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id  UUID NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
    object_key  VARCHAR(500) NOT NULL,
    mime_type   VARCHAR(100) NOT NULL,
    size_bytes  BIGINT       NOT NULL,
    visibility  VARCHAR(20)  NOT NULL DEFAULT 'public',
    is_primary  BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT listing_images_object_key_key UNIQUE (object_key),
    CONSTRAINT listing_images_mime_is_image CHECK (mime_type ~ '^image/(png|jpeg|jpg|webp|avif)$'),
    CONSTRAINT listing_images_size_reasonable CHECK (size_bytes > 0 AND size_bytes <= 26214400),
    CONSTRAINT listing_images_visibility_allowed CHECK (visibility IN ('public', 'private'))
);

-- At most one primary image per listing.
CREATE UNIQUE INDEX listing_images_primary_unique
    ON public.listing_images (listing_id)
    WHERE is_primary;

CREATE INDEX listing_images_listing_id_idx ON public.listing_images (listing_id);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER listing_images_updated_at
    BEFORE UPDATE ON public.listing_images
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
