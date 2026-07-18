
ALTER TABLE public.social_content_items DROP CONSTRAINT IF EXISTS social_content_items_platform_check;
ALTER TABLE public.social_content_items
  ADD CONSTRAINT social_content_items_platform_check
  CHECK (platform = ANY (ARRAY[
    'facebook','instagram','linkedin','x','threads','tiktok','youtube',
    'pinterest','reddit','bluesky','beehiiv','other'
  ]));
