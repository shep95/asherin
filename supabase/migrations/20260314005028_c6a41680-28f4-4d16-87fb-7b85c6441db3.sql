INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-wallpapers', 'custom-wallpapers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload custom wallpapers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'custom-wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own wallpapers"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'custom-wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view custom wallpapers"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'custom-wallpapers');

CREATE POLICY "Users can delete own wallpapers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'custom-wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);