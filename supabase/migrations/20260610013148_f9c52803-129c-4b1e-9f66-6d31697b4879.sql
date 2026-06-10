
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
      AND lower(email) IN ('ashernewtonx@gmail.com', '28numberofmoney@gmail.com')
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
      AND lower(email) IN ('ashernewtonx@gmail.com', '28numberofmoney@gmail.com')
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
      AND lower(email) IN ('ashernewtonx@gmail.com', '28numberofmoney@gmail.com')
  );
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('ashernewtonx@gmail.com', '28numberofmoney@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
