-- Migration 015 — Support videos and multiple media items in listing_images
--
-- E-commerce garments support multiple photos (front, back, fabric close-up, styling)
-- and runway/walkthrough video clips (mp4, webm, quicktime, ogg).

ALTER TABLE public.listing_images
    DROP CONSTRAINT IF EXISTS listing_images_mime_is_image;

ALTER TABLE public.listing_images
    ADD CONSTRAINT listing_images_mime_is_media CHECK (
        mime_type ~ '^(image/(png|jpeg|jpg|webp|avif)|video/(mp4|webm|quicktime|ogg))$'
    );

ALTER TABLE public.listing_images
    DROP CONSTRAINT IF EXISTS listing_images_size_reasonable;

ALTER TABLE public.listing_images
    ADD CONSTRAINT listing_images_size_reasonable CHECK (
        size_bytes > 0 AND size_bytes <= 104857600
    );

