REVOKE EXECUTE ON FUNCTION public.mesh_roster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mesh_roster() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.locate_owned_device(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.locate_owned_device(text, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.locate_owned_devices_group(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.locate_owned_devices_group(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ble_can_claim(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ble_can_claim(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.match_asher_code_chunks(uuid, uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_asher_code_chunks(uuid, uuid, vector, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.match_vault_chunks(uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_vault_chunks(uuid, vector, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.soft_delete_asher_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_asher_message(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.soft_delete_row(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_row(text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.restore_soft_deleted(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted(text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.hoodie_vote_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoodie_vote_totals() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ziaassets_set_phrase(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziaassets_set_phrase(text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ziaassets_verify_phrase(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziaassets_verify_phrase(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ziaassets_bootstrap_emperor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziaassets_bootstrap_emperor() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.purge_soft_deleted(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.organism_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organism_purge() TO service_role;

REVOKE EXECUTE ON FUNCTION public.ghost_buffer_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghost_buffer_purge() TO service_role;

REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;