CREATE TABLE public.asherin_ambient_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_key text NOT NULL,
  label text NOT NULL DEFAULT 'device',
  platform text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'active',
  push_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asherin_ambient_devices TO authenticated;
GRANT ALL ON public.asherin_ambient_devices TO service_role;
ALTER TABLE public.asherin_ambient_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambient_devices_own" ON public.asherin_ambient_devices FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.asherin_ambient_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  name text,
  name_source text,
  embedding double precision[] NOT NULL DEFAULT '{}'::double precision[],
  sample_count integer NOT NULL DEFAULT 1,
  confidence real NOT NULL DEFAULT 0.3,
  first_heard_at timestamptz NOT NULL DEFAULT now(),
  last_heard_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asherin_ambient_speakers_user_idx ON public.asherin_ambient_speakers (user_id, last_heard_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asherin_ambient_speakers TO authenticated;
GRANT ALL ON public.asherin_ambient_speakers TO service_role;
ALTER TABLE public.asherin_ambient_speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambient_speakers_own" ON public.asherin_ambient_speakers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.asherin_ambient_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.asherin_ambient_devices(id) ON DELETE SET NULL,
  speaker_id uuid REFERENCES public.asherin_ambient_speakers(id) ON DELETE SET NULL,
  kind text NOT NULL,
  transcript text,
  tag text,
  confidence real,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asherin_ambient_events_user_time_idx ON public.asherin_ambient_events (user_id, started_at DESC);
CREATE INDEX asherin_ambient_events_speaker_idx ON public.asherin_ambient_events (user_id, speaker_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asherin_ambient_events TO authenticated;
GRANT ALL ON public.asherin_ambient_events TO service_role;
ALTER TABLE public.asherin_ambient_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambient_events_own" ON public.asherin_ambient_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.asherin_ambient_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.asherin_ambient_devices(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.asherin_ambient_events(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asherin_ambient_alerts_user_time_idx ON public.asherin_ambient_alerts (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asherin_ambient_alerts TO authenticated;
GRANT ALL ON public.asherin_ambient_alerts TO service_role;
ALTER TABLE public.asherin_ambient_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambient_alerts_own" ON public.asherin_ambient_alerts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.asherin_ambient_settings (
  user_id uuid PRIMARY KEY,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_hours integer NOT NULL DEFAULT 72,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asherin_ambient_settings TO authenticated;
GRANT ALL ON public.asherin_ambient_settings TO service_role;
ALTER TABLE public.asherin_ambient_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambient_settings_own" ON public.asherin_ambient_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());