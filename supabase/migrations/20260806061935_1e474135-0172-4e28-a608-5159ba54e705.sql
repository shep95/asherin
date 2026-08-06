CREATE TABLE IF NOT EXISTS public.google_intel_snapshots (
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'contact_intel',
  saved_at timestamptz NOT NULL DEFAULT now(),
  device_id text NOT NULL DEFAULT 'unknown',
  device_label text,
  bytes integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_intel_snapshots TO authenticated;
GRANT ALL ON public.google_intel_snapshots TO service_role;
ALTER TABLE public.google_intel_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intel snapshots" ON public.google_intel_snapshots
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_intel_devices (
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  label text,
  platform text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_push_at timestamptz,
  PRIMARY KEY (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_intel_devices TO authenticated;
GRANT ALL ON public.google_intel_devices TO service_role;
ALTER TABLE public.google_intel_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intel devices" ON public.google_intel_devices
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS google_intel_devices_seen_idx
  ON public.google_intel_devices (user_id, last_seen_at DESC);