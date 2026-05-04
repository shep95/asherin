DROP POLICY IF EXISTS "asher_brains_update_contributors" ON public.asher_brains;
DROP POLICY IF EXISTS "asher_brains_update" ON public.asher_brains;
CREATE POLICY "asher_brains_update_admin_only"
ON public.asher_brains
FOR UPDATE
USING (public.is_asher_super_owner(auth.uid()))
WITH CHECK (public.is_asher_super_owner(auth.uid()));