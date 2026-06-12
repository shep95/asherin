DROP POLICY IF EXISTS "Users can upload own zerlal scan sources" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own zerlal scan sources" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own zerlal scan sources" ON storage.objects;

CREATE POLICY "Users can upload own zerlal scan sources"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'zerlal-scan-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own zerlal scan sources"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'zerlal-scan-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own zerlal scan sources"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'zerlal-scan-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);