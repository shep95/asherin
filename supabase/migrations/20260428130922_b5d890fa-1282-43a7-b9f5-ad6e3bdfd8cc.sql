REVOKE EXECUTE ON FUNCTION public.is_asher_operator(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_asher_conv_member(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_asher_operator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asher_conv_member(UUID, UUID) TO authenticated;