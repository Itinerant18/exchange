-- Migration 011 — Reviewer body specs and fit ratings ("Our Runway" Phase 2).
--
-- Adds optional reviewer self-description (height, weight, bust/cup size,
-- body-type, and the size actually worn), plus a structured fit verdict
-- (RUNS_SMALL | TRUE_TO_SIZE | RUNS_LARGE) that PDPs aggregate into a
-- "Runs Small — True to Size — Runs Large" meter. All fields nullable so
-- existing reviews remain valid and writers may omit them.

ALTER TABLE public.reviews
    ADD COLUMN size_worn         VARCHAR(50),
    ADD COLUMN reviewer_height_cm SMALLINT,
    ADD COLUMN reviewer_weight_kg SMALLINT,
    ADD COLUMN bust_size          VARCHAR(20),
    ADD COLUMN body_type          VARCHAR(30),
    ADD COLUMN fit_rating         VARCHAR(20);

ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_body_dimensions_reasonable CHECK (
        (reviewer_height_cm IS NULL OR reviewer_height_cm BETWEEN 100 AND 250) AND
        (reviewer_weight_kg IS NULL OR reviewer_weight_kg BETWEEN 25 AND 300)),
    ADD CONSTRAINT reviews_body_type_allowed CHECK (body_type IN (
        'petite', 'slim', 'average', 'athletic', 'curvy', 'plus_size')),
    ADD CONSTRAINT reviews_fit_rating_allowed CHECK (fit_rating IN (
        'RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'));

CREATE INDEX reviews_fit_rating_idx ON public.reviews (fit_rating)
    WHERE fit_rating IS NOT NULL;
