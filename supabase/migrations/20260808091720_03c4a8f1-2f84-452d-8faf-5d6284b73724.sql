CREATE POLICY "ghost buffer owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ghost-buffer' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ghost buffer owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ghost-buffer' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ghost buffer owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ghost-buffer' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'ghost-buffer' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ghost buffer owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ghost-buffer' AND (storage.foldername(name))[1] = auth.uid()::text);