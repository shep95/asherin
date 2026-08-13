-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.

CREATE TABLE public.granted_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tier text NOT NULL,
  product_id text NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.granted_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.granted_subscriptions
  FOR ALL USING (false);

INSERT INTO public.granted_subscriptions (email, tier, product_id, active)
VALUES ('operator-owner@redacted.invalid', 'enterprise', 'prod_TypqQSMqan0aOZ', true);
