
-- Migration log table
CREATE TABLE IF NOT EXISTS public.storage_migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_url text NOT NULL UNIQUE,
  new_url text,
  source text,
  bucket_path text,
  file_size bigint,
  mime_type text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  tables_updated jsonb DEFAULT '[]'::jsonb,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage migration log"
ON public.storage_migration_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Lock down media bucket: deny all new INSERTs (read still allowed for legacy URLs)
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to media" ON storage.objects;
DROP POLICY IF EXISTS "Public uploads to media" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_block" ON storage.objects;

CREATE POLICY "media_insert_block"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id != 'media');
