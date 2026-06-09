REVOKE EXECUTE ON FUNCTION public.is_admin_user(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;