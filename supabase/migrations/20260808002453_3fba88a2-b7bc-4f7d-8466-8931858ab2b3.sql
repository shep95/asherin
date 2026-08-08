CREATE TABLE public.pricing_ip_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text NOT NULL,
  user_id uuid,
  ip_address text NOT NULL,
  country text,
  city text,
  org text,
  asn text,
  latitude double precision,
  longitude double precision,
  is_infrastructure boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pricing_ip_obs_subject_time_idx ON public.pricing_ip_observations (subject_id, observed_at DESC);
CREATE INDEX pricing_ip_obs_user_time_idx ON public.pricing_ip_observations (user_id, observed_at DESC);

GRANT SELECT ON public.pricing_ip_observations TO authenticated;
GRANT ALL ON public.pricing_ip_observations TO service_role;

ALTER TABLE public.pricing_ip_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pricing observations"
  ON public.pricing_ip_observations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());