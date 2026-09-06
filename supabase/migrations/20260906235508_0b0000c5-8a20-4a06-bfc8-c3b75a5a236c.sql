revoke execute on function public.data_ws_role(uuid, uuid) from anon, public;
revoke execute on function public.data_can_read(uuid, uuid) from anon, public;
revoke execute on function public.data_can_write(uuid, uuid) from anon, public;
revoke execute on function public.data_match_chunks(uuid, vector, int, uuid[]) from anon, public;
grant execute on function public.data_match_chunks(uuid, vector, int, uuid[]) to authenticated, service_role;