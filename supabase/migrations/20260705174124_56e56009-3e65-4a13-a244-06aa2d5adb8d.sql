
CREATE POLICY "ziaassets_vault_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ziaassets-vault' AND public.ziaassets_is_active_member(auth.uid()));

CREATE POLICY "ziaassets_vault_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ziaassets-vault' AND public.ziaassets_has_min_rank(auth.uid(), 'researcher'::public.ziaassets_rank));

CREATE POLICY "ziaassets_vault_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ziaassets-vault' AND (owner = auth.uid() OR public.ziaassets_is_emperor(auth.uid())));

CREATE POLICY "ziaassets_vault_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ziaassets-vault' AND (owner = auth.uid() OR public.ziaassets_is_emperor(auth.uid())));
