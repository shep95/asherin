-- Restore EXECUTE on SECURITY DEFINER helpers used by RLS policies and client RPCs.
-- Without EXECUTE, PostgREST fails with "permission denied for function ..." even though
-- the functions are SECURITY DEFINER, breaking teams, notebook sharing, and admin pages.

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_notebook_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_notebook_share(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notebook_team_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_super_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_brain_contributor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_conv_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_has_role_in_org(uuid, uuid, public.asher_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_dept_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asher_is_section_officer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;

-- Trigger functions must be executable by roles that fire the trigger.
GRANT EXECUTE ON FUNCTION public.tg_touch_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_predictions_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_ava_picks_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_intel_job_user_cap() TO authenticated;

-- Intel slot RPCs invoked directly by signed-in users.
GRANT EXECUTE ON FUNCTION public.heartbeat_intel_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_intel_slot(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_intel_slot(uuid, text, integer) TO authenticated;

-- Admin RPCs: they internally check is_admin_user and raise otherwise; safe to expose to authenticated.
GRANT EXECUTE ON FUNCTION public.admin_active_sessions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_page_timeline(timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_page_analytics(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_aureon_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_module_usage(timestamptz) TO authenticated;
