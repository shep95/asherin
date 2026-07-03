-- Kill email-based admin trust boundary.
-- is_admin_user() previously trusted lower(auth.users.email) IN (...) which means:
--   - anyone who signs up with those emails (if email verification is disabled/bypassed) gets admin
--   - provider account-takeover on the email = super-admin
-- New model delegates to has_role(uid, 'admin') which is keyed on auth.uid() (immutable).
-- The two real admin uids are already seeded in public.user_roles.

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- Same treatment for the second admin gate. Falls back to email allowlist ONLY if a
-- migration ever drops the user_roles row, but the primary trust is now the uid role.
CREATE OR REPLACE FUNCTION public.is_asher_super_owner(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role);
$$;

-- Anonymous callers should never be probing admin gates.
REVOKE EXECUTE ON FUNCTION public.is_admin_user(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_asher_super_owner(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_asher_super_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;