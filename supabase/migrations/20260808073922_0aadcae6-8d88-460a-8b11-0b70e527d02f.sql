CREATE TABLE IF NOT EXISTS public.sentinel_presence (
  user_id UUID PRIMARY KEY,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  fix_at TIMESTAMPTZ,
  link_type TEXT,
  effective_type TEXT,
  last_source TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sentinel_presence TO authenticated;
GRANT ALL ON public.sentinel_presence TO service_role;
ALTER TABLE public.sentinel_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence_own_read" ON public.sentinel_presence FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sentinel_cron_state (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_minutes INTEGER NOT NULL DEFAULT 15,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_tier TEXT NOT NULL DEFAULT 'none',
  last_place_key TEXT,
  runs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sentinel_cron_due_idx ON public.sentinel_cron_state (next_due_at) WHERE enabled;
GRANT SELECT ON public.sentinel_cron_state TO authenticated;
GRANT ALL ON public.sentinel_cron_state TO service_role;
ALTER TABLE public.sentinel_cron_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_state_own_read" ON public.sentinel_cron_state FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sentinel_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  platform TEXT,
  revoked BOOLEAN NOT NULL DEFAULT false,
  last_beacon_at TIMESTAMPTZ,
  beacons INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sentinel_devices_user_idx ON public.sentinel_devices (user_id);
GRANT SELECT ON public.sentinel_devices TO authenticated;
GRANT ALL ON public.sentinel_devices TO service_role;
ALTER TABLE public.sentinel_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sentinel_devices_own_read" ON public.sentinel_devices FOR SELECT TO authenticated USING (auth.uid() = user_id);