-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.
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
      AND lower(email) IN ('operator-owner@redacted.invalid','operator-two@redacted.invalid')
  );
$$;

INSERT INTO public.granted_subscriptions (email, tier, product_id, active)
SELECT 'operator-two@redacted.invalid', 'enterprise', 'prod_TypqQSMqan0aOZ', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.granted_subscriptions
  WHERE lower(email) = 'operator-two@redacted.invalid' AND active = true
);