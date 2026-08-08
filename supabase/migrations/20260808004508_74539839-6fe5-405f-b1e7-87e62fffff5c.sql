CREATE TABLE public.rideshare_rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'uber',
  source text NOT NULL CHECK (source IN ('share_link','screenshot','email','manual')),
  driver_name text,
  plate text,
  vehicle text,
  city text,
  pickup_label text,
  trip_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fast_done','deep_done','failed')),
  verdict text CHECK (verdict IN ('CLEAR','THIN','WATCH','AVOID')),
  confidence numeric,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rideshare_rides_idem ON public.rideshare_rides (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX rideshare_rides_user_created ON public.rideshare_rides (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rideshare_rides TO authenticated;
GRANT ALL ON public.rideshare_rides TO service_role;
ALTER TABLE public.rideshare_rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rides_own" ON public.rideshare_rides FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.rideshare_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rideshare_rides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('fast','deep')),
  verdict text NOT NULL CHECK (verdict IN ('CLEAR','THIN','WATCH','AVOID')),
  confidence numeric NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  headline text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rideshare_reports_ride_phase ON public.rideshare_reports (ride_id, phase);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rideshare_reports TO authenticated;
GRANT ALL ON public.rideshare_reports TO service_role;
ALTER TABLE public.rideshare_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_own" ON public.rideshare_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE UNIQUE INDEX push_subscriptions_endpoint ON public.push_subscriptions (endpoint);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.rideshare_settings (
  user_id uuid PRIMARY KEY,
  alert_threshold text NOT NULL DEFAULT 'WATCH' CHECK (alert_threshold IN ('CLEAR','THIN','WATCH','AVOID')),
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  auto_from_email boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rideshare_settings TO authenticated;
GRANT ALL ON public.rideshare_settings TO service_role;
ALTER TABLE public.rideshare_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_settings_own" ON public.rideshare_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.message_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'sms_paste' CHECK (channel IN ('sms_paste','sms_forward','whatsapp_paste','other')),
  counterparty text,
  raw text NOT NULL,
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  report text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_sources_user_created ON public.message_sources (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_sources TO authenticated;
GRANT ALL ON public.message_sources TO service_role;
ALTER TABLE public.message_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_sources_own" ON public.message_sources FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);