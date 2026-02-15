
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
VALUES ('ashernewtonx@gmail.com', 'enterprise', 'prod_TypqQSMqan0aOZ', true);
