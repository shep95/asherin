-- Privatize user-content buckets so RLS SELECT policies become enforced.
-- Public buckets bypass RLS via /storage/v1/object/public/<bucket>/... URLs;
-- flipping these to private forces all reads through signed URLs that respect
-- the existing owner-scoped storage.objects policies.
UPDATE storage.buckets
   SET public = false
 WHERE id IN ('vibe-imager', 'vibe-video', 'custom-wallpapers');