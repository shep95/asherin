CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) IN ('ashernewtonx@gmail.com','shepherdnewtonx@gmail.com')
  );
$$;

INSERT INTO public.granted_subscriptions (email, tier, product_id, active)
SELECT 'shepherdnewtonx@gmail.com', 'enterprise', 'prod_TypqQSMqan0aOZ', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.granted_subscriptions
  WHERE lower(email) = 'shepherdnewtonx@gmail.com' AND active = true
);