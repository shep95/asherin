REVOKE EXECUTE ON FUNCTION public.is_blocked_display_name(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_display_name(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unaccent_fallback(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_display_name(text) TO authenticated, service_role;