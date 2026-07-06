-- Restore EXECUTE on RLS-helper SECURITY DEFINER functions.
-- These are referenced inside RLS USING/WITH CHECK clauses; the caller role
-- must hold EXECUTE regardless of SECURITY DEFINER, or Postgres returns
-- "permission denied for function ..." and the entire query fails.
GRANT EXECUTE ON FUNCTION public.is_asher_conv_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_notebook_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_notebook_share(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notebook_team_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_has_role_in_org(uuid, uuid, public.asher_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_dept_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_section_officer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_super_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_brain_contributor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
-- get_team_role may or may not exist depending on migration order; guard it.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='get_team_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_team_role(uuid, uuid) TO authenticated';
  END IF;
END $$;
