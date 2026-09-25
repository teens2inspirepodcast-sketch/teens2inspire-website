-- R2 becomes the storage provider for newly uploaded media. Keep accepting the
-- existing Supabase Storage references so already-published videos keep working.
ALTER TABLE public.video_assets
  DROP CONSTRAINT IF EXISTS video_assets_media_url_check;

ALTER TABLE public.video_assets
  ADD CONSTRAINT video_assets_media_url_check CHECK (
    media_url ~ '^storage://video-assets/[0-9a-f-]{36}/[0-9]+-[A-Za-z0-9._-]{1,100}$'
    OR media_url ~ '^r2://video-assets/[0-9a-f-]{36}/[0-9]+-[0-9a-f-]{36}-[A-Za-z0-9._-]{1,100}$'
  );
