
-- 1. Server icon column
ALTER TABLE public.hoa_servers ADD COLUMN IF NOT EXISTS icon_url text;

-- 2. Storage policies on gov-icons
-- Read: any authenticated user (deck already gates who sees what)
DROP POLICY IF EXISTS "gov-icons read" ON storage.objects;
CREATE POLICY "gov-icons read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gov-icons');

-- Avatar write: user owns the avatars/{uid}/... path
DROP POLICY IF EXISTS "gov-icons avatar write" ON storage.objects;
CREATE POLICY "gov-icons avatar write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gov-icons'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
DROP POLICY IF EXISTS "gov-icons avatar update" ON storage.objects;
CREATE POLICY "gov-icons avatar update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gov-icons'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
DROP POLICY IF EXISTS "gov-icons avatar delete" ON storage.objects;
CREATE POLICY "gov-icons avatar delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gov-icons'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Server icon write: server owner or Emperor
DROP POLICY IF EXISTS "gov-icons server write" ON storage.objects;
CREATE POLICY "gov-icons server write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gov-icons'
    AND (storage.foldername(name))[1] = 'servers'
    AND (
      public.hoa_is_houseofasher(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.hoa_members m
        WHERE m.server_id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
          AND m.role = 'owner'
      )
    )
  );
DROP POLICY IF EXISTS "gov-icons server update" ON storage.objects;
CREATE POLICY "gov-icons server update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gov-icons'
    AND (storage.foldername(name))[1] = 'servers'
    AND (
      public.hoa_is_houseofasher(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.hoa_members m
        WHERE m.server_id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
          AND m.role = 'owner'
      )
    )
  );
DROP POLICY IF EXISTS "gov-icons server delete" ON storage.objects;
CREATE POLICY "gov-icons server delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gov-icons'
    AND (storage.foldername(name))[1] = 'servers'
    AND (
      public.hoa_is_houseofasher(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.hoa_members m
        WHERE m.server_id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
          AND m.role = 'owner'
      )
    )
  );
