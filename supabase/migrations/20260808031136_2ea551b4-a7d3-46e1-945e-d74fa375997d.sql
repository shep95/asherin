ALTER TABLE public.intel_notifications
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_match jsonb;

DROP POLICY IF EXISTS "intel photos readable by owner" ON storage.objects;
CREATE POLICY "intel photos readable by owner"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'intel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);