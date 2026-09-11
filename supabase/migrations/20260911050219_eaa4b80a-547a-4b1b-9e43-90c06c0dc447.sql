REVOKE ALL ON FUNCTION public.software_force_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.software_artifact_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.software_version_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.software_touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.software_force_owner() TO service_role;
GRANT EXECUTE ON FUNCTION public.software_artifact_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.software_version_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.software_touch_updated_at() TO service_role;