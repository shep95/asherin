-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) IN ('operator-owner@redacted.invalid', 'operator-three@redacted.invalid')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_asher_super_owner(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _uid
      AND lower(email) IN ('operator-owner@redacted.invalid', 'operator-three@redacted.invalid')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_asher_brain_contributor(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _uid
      AND lower(email) IN ('operator-owner@redacted.invalid', 'operator-three@redacted.invalid')
  );
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('operator-owner@redacted.invalid', 'operator-three@redacted.invalid')
ON CONFLICT (user_id, role) DO NOTHING;
