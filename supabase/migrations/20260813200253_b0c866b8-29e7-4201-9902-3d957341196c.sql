REVOKE EXECUTE ON FUNCTION public.team_seat_usage(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_billing_active(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_active_team(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.team_seat_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_billing_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_active_team(uuid) TO authenticated, service_role;