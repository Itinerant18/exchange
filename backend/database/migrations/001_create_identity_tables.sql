-- Migration 001 — Identity, authentication, and profiles.
--
-- Tables: users, user_profiles, user_addresses, refresh_sessions, user_roles
-- plus the shared set_updated_at() trigger function used by later migrations.

-- Shared trigger function for updated_at maintenance. Later migrations attach
-- variants of this trigger to their mutable tables.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TABLE public.users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'active',
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Emails are stored lowercased; uniqueness is case-insensitive via lowered index.
    CONSTRAINT users_email_stored_lowered CHECK (email = lower(email)),
    CONSTRAINT users_email_format CHECK (
        email ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' AND length(email) <= 255
    ),
    CONSTRAINT users_status_allowed CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE UNIQUE INDEX users_email_unique
    ON public.users (lower(email));

COMMENT ON COLUMN public.users.password_hash IS
    'Password hash (scrypt KDF, salt embedded). Never returned by APIs.';

COMMENT ON COLUMN public.users.status IS
    'Account state. Hard deletion is not an application flow; "deleted" is a soft state.';


CREATE TABLE public.user_profiles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    display_name      VARCHAR(100),
    phone_number      VARCHAR(32),
    avatar_url        VARCHAR(500),
    bio               TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_profiles_user_id_key UNIQUE (user_id),
    CONSTRAINT user_profiles_display_name_length CHECK (display_name IS NULL OR char_length(btrim(display_name)) >= 2),
    CONSTRAINT user_profiles_phone_format CHECK (phone_number IS NULL OR phone_number ~ '^\+?[0-9][0-9\s-]{4,31}$'),
    CONSTRAINT user_profiles_name_length CHECK (display_name IS NULL OR char_length(btrim(display_name)) <= 100)
);


CREATE TABLE public.user_addresses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    address_type VARCHAR(20)  NOT NULL DEFAULT 'shipping',
    full_name    VARCHAR(120) NOT NULL,
    phone_number VARCHAR(32)  NOT NULL,
    line1        VARCHAR(255) NOT NULL,
    line2        VARCHAR(255),
    city         VARCHAR(100) NOT NULL,
    state        VARCHAR(100),
    postal_code  VARCHAR(20)  NOT NULL,
    country      VARCHAR(100) NOT NULL DEFAULT 'India',
    is_default   BOOLEAN      NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT user_addresses_type_allowed CHECK (address_type IN ('shipping', 'billing', 'both')),
    CONSTRAINT user_addresses_line1_nonempty CHECK (char_length(btrim(line1)) > 0),
    CONSTRAINT user_addresses_city_nonempty CHECK (char_length(btrim(city)) > 0),
    CONSTRAINT user_addresses_postal_format CHECK (postal_code ~ '^[0-9A-Za-z][0-9A-Za-z -]{2,18}$'),
    CONSTRAINT user_addresses_phone_format  CHECK (phone_number ~ '^\+?[0-9][0-9\s-]{4,31}$')
);

-- At most one default address per user.
CREATE UNIQUE INDEX user_addresses_default_unique
    ON public.user_addresses (user_id)
    WHERE is_default;

CREATE INDEX user_addresses_user_id_idx ON public.user_addresses (user_id);


-- Refresh sessions: one row per issued refresh token.
-- token_hash is the SHA-256 hex digest of the opaque refresh token.
CREATE TABLE public.refresh_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,

    CONSTRAINT refresh_sessions_token_hash_key UNIQUE (token_hash),
    CONSTRAINT refresh_sessions_token_hash_length CHECK (char_length(token_hash) = 64),
    CONSTRAINT refresh_sessions_revoked_once CHECK (revoked_at IS NULL OR revoked_at > created_at)
);

CREATE INDEX refresh_sessions_user_id_idx ON public.refresh_sessions (user_id);


-- Role assignments. A user may hold several roles; there are no separate user tables.
CREATE TABLE public.user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    role_name   VARCHAR(30) NOT NULL,
    assigned_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_roles_role_allowed CHECK (role_name IN ('customer', 'seller', 'admin')),
    CONSTRAINT user_roles_user_role_key UNIQUE (user_id, role_name)
);

CREATE INDEX user_roles_user_id_idx ON public.user_roles (user_id);

-- updated_at triggers for mutable tables. refresh_sessions only sets
-- revoked_at (no updated_at column), and user_roles is append-only.
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_addresses_updated_at
    BEFORE UPDATE ON public.user_addresses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

