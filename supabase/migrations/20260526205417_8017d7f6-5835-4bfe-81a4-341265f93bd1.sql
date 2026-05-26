
-- 1. Realtime: lock down realtime.messages to user-scoped topics only
DROP POLICY IF EXISTS "authenticated_can_read_realtime" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_can_send_realtime" ON realtime.messages;

CREATE POLICY "auth_read_own_topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE (auth.uid())::text || ':%'
  );

CREATE POLICY "auth_send_own_topic"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'user:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE (auth.uid())::text || ':%'
  );

-- 2. Storage: stop public listing/enumeration of vibe buckets (public URLs still work via CDN)
DROP POLICY IF EXISTS "Anyone can view vibe images" ON storage.objects;
DROP POLICY IF EXISTS "Public read vibe videos" ON storage.objects;

CREATE POLICY "Users read own vibe images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vibe-imager'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- vibe-video already has "Users read own videos" — no replacement needed

-- 3. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.touch_ava_picks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 4. Revoke EXECUTE on internal helper / admin SECURITY DEFINER functions
-- These are either RLS helpers (still callable inside policies as definer) or
-- admin-only / service-role-only utilities.
REVOKE EXECUTE ON FUNCTION public.is_asher_conv_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_asher_operator(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_team_role(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_notebook_owner(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_notebook_share(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notebook_team_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.asher_has_role_in_org(uuid, uuid, public.asher_role[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.asher_is_org_admin(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.asher_is_org_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.asher_is_dept_admin(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.asher_is_section_officer(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_user(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_asher_super_owner(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_asher_brain_contributor(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heartbeat_intel_slot(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_intel_slot(uuid, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_acquire_intel_slot(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_intel_job_user_cap() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_predictions_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_ava_picks_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_active_sessions(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_page_timeline(timestamptz, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_page_analytics(timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_aureon_overview() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_module_usage(timestamptz) FROM anon, authenticated;
