-- anonymous visitors do not need any of these
REVOKE ALL ON FUNCTION public.asher_is_channel_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.asher_is_channel_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hoa_has_permission(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_internal_operator(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_internal_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_internal_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziaassets_has_min_rank(uuid, ziaassets_rank) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziaassets_is_active_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziaassets_is_emperor(uuid) FROM PUBLIC, anon;

-- signed-in users do not call these directly either
REVOKE ALL ON FUNCTION public.asher_has_role_in_org(uuid, uuid, asher_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hoa_has_permission(uuid, uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.hoodie_vote_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_internal_operator(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_internal_owner(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_internal_staff(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.mesh_peer_user_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_soft_deleted(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soft_delete_row(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_email_sha256(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.user_has_active_team(uuid) FROM PUBLIC, anon, authenticated;