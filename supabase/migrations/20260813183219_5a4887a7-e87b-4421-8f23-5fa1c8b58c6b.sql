CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.canonical_email(_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  raw text := lower(btrim(coalesce(_email, '')));
  at_pos int;
  local_part text;
  host_part text;
BEGIN
  at_pos := position('@' in raw);
  IF at_pos <= 1 THEN RETURN raw; END IF;
  local_part := substring(raw from 1 for at_pos - 1);
  host_part  := substring(raw from at_pos + 1);
  IF host_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := split_part(local_part, '+', 1);
    local_part := replace(local_part, '.', '');
    RETURN local_part || '@gmail.com';
  END IF;
  RETURN local_part || '@' || host_part;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_sha256(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.canonical_email(_email) = '' THEN NULL
    ELSE encode(extensions.digest(public.canonical_email(_email), 'sha256'), 'hex')
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_email_sha256(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.email_sha256(email) FROM auth.users WHERE id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.is_internal_owner(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_email_sha256(_uid)
    = 'f68b7e47077aa50a88e993818e1d88cbf491b81582e46e3d0cd0e0ea54607aea';
$$;

CREATE OR REPLACE FUNCTION public.is_internal_operator(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_email_sha256(_uid) IN (
    'f68b7e47077aa50a88e993818e1d88cbf491b81582e46e3d0cd0e0ea54607aea',
    'bf82821ba9b7f8c56f865b9cc453e791d84f829c71f4585cd99cf0a064390a54'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_internal_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_email_sha256(_uid) IN (
    'f68b7e47077aa50a88e993818e1d88cbf491b81582e46e3d0cd0e0ea54607aea',
    'bf82821ba9b7f8c56f865b9cc453e791d84f829c71f4585cd99cf0a064390a54',
    '732426de6211ba1300bc85ed04d17240bc6efa2dffc18df78d1f70bb7fa668ad',
    '5d29ee379ee81c23e7d5aa9f5039e9086e02d67747b960bd39eca3bda4cbf033'
  );
$$;

GRANT EXECUTE ON FUNCTION public.canonical_email(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.email_sha256(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_email_sha256(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_operator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND (public.has_role(_user_id, 'admin'::public.app_role)
          OR public.is_internal_staff(_user_id));
$$;

CREATE OR REPLACE FUNCTION public.is_asher_super_owner(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL
     AND (public.has_role(_uid, 'admin'::public.app_role)
          OR public.is_internal_staff(_uid));
$$;

CREATE OR REPLACE FUNCTION public.is_asher_brain_contributor(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_staff(_uid);
$$;

CREATE OR REPLACE FUNCTION public.ziaassets_is_emperor(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_owner(_uid);
$$;

ALTER TABLE public.granted_subscriptions
  ADD COLUMN IF NOT EXISTS email_sha256 text;

UPDATE public.granted_subscriptions
   SET email_sha256 = public.email_sha256(email)
 WHERE email_sha256 IS NULL AND email IS NOT NULL;

ALTER TABLE public.granted_subscriptions ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_granted_subscriptions_hash
  ON public.granted_subscriptions (email_sha256) WHERE active;

UPDATE public.granted_subscriptions
   SET active = false
 WHERE email_sha256 IN (
   'f68b7e47077aa50a88e993818e1d88cbf491b81582e46e3d0cd0e0ea54607aea',
   'bf82821ba9b7f8c56f865b9cc453e791d84f829c71f4585cd99cf0a064390a54'
 );

INSERT INTO public.granted_subscriptions (email, email_sha256, tier, product_id, active)
SELECT NULL, h, 'monthly_pro', 'prod_UjaQFcAkQnTOm1', true
FROM unnest(ARRAY[
  'f68b7e47077aa50a88e993818e1d88cbf491b81582e46e3d0cd0e0ea54607aea',
  'bf82821ba9b7f8c56f865b9cc453e791d84f829c71f4585cd99cf0a064390a54'
]) AS h;

UPDATE public.granted_subscriptions
   SET email = NULL
 WHERE email_sha256 IN (
   'f68b7e47077aa50a88e993818e1d88cbf491b81582e46e3d0cd0e0ea54607aea',
   'bf82821ba9b7f8c56f865b9cc453e791d84f829c71f4585cd99cf0a064390a54'
 );