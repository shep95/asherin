-- Shared bank of successful public social reads. This is public OSINT about
-- third-party accounts, not user-private data, so it is readable by any
-- signed-in operator and writable only by the edge functions (service_role).
-- Sharing the bank is the point: the Instagram window is IP-throttled and
-- scarce, so a success earned by one sweep must serve every later one.
CREATE TABLE public.social_intel_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  handle_key TEXT NOT NULL,
  display_name TEXT,
  verdict TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_intel_cache_platform_chk
    CHECK (platform IN ('x','instagram','linkedin','facebook')),
  CONSTRAINT social_intel_cache_unique UNIQUE (platform, handle_key)
);

GRANT SELECT ON public.social_intel_cache TO authenticated;
GRANT ALL ON public.social_intel_cache TO service_role;

ALTER TABLE public.social_intel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in operators can read the social bank"
  ON public.social_intel_cache FOR SELECT TO authenticated USING (true);

CREATE INDEX social_intel_cache_lookup_idx
  ON public.social_intel_cache (platform, handle_key, fetched_at DESC);

-- Per-platform backoff ledger. A throttled source must be left alone rather
-- than hammered, otherwise the cooldown never expires and the capability is
-- lost permanently.
CREATE TABLE public.social_probe_cooldown (
  platform TEXT NOT NULL PRIMARY KEY,
  cooldown_until TIMESTAMPTZ NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 1,
  last_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_probe_cooldown_platform_chk
    CHECK (platform IN ('x','instagram','linkedin','facebook'))
);

GRANT SELECT ON public.social_probe_cooldown TO authenticated;
GRANT ALL ON public.social_probe_cooldown TO service_role;

ALTER TABLE public.social_probe_cooldown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in operators can read probe cooldowns"
  ON public.social_probe_cooldown FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_social_intel_cache_updated_at
  BEFORE UPDATE ON public.social_intel_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_probe_cooldown_updated_at
  BEFORE UPDATE ON public.social_probe_cooldown
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();