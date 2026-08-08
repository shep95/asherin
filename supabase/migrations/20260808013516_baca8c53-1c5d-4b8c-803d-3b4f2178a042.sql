CREATE TABLE public.ble_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Unnamed device',
  raw_name TEXT,
  manufacturer TEXT,
  inferred_kind TEXT NOT NULL DEFAULT 'unknown',
  service_uuids TEXT[] NOT NULL DEFAULT '{}',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  encounter_count INTEGER NOT NULL DEFAULT 0,
  distinct_days INTEGER NOT NULL DEFAULT 0,
  distinct_places INTEGER NOT NULL DEFAULT 0,
  sighting_count INTEGER NOT NULL DEFAULT 0,
  last_rssi INTEGER,
  last_distance_m NUMERIC,
  closest_distance_m NUMERIC,
  is_self BOOLEAN NOT NULL DEFAULT false,
  self_reason TEXT,
  is_ignored BOOLEAN NOT NULL DEFAULT false,
  threat_tier TEXT NOT NULL DEFAULT 'unknown',
  dossier JSONB,
  dossier_at TIMESTAMPTZ,
  alert_count INTEGER NOT NULL DEFAULT 0,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ble_devices TO authenticated;
GRANT ALL ON public.ble_devices TO service_role;
ALTER TABLE public.ble_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ble devices" ON public.ble_devices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ble_devices_user_seen_idx ON public.ble_devices (user_id, last_seen DESC);

CREATE TABLE public.ble_sightings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES public.ble_devices(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rssi INTEGER,
  distance_m NUMERIC,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m NUMERIC,
  place_key TEXT,
  scanner_label TEXT,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ble_sightings TO authenticated;
GRANT ALL ON public.ble_sightings TO service_role;
ALTER TABLE public.ble_sightings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ble sightings" ON public.ble_sightings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ble_sightings_device_idx ON public.ble_sightings (device_id, seen_at DESC);
CREATE INDEX ble_sightings_user_idx ON public.ble_sightings (user_id, seen_at DESC);

CREATE TABLE public.sentinel_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  recurrence_threshold INTEGER NOT NULL DEFAULT 3,
  ignore_audio BOOLEAN NOT NULL DEFAULT true,
  min_rssi INTEGER NOT NULL DEFAULT -95,
  ble_enabled BOOLEAN NOT NULL DEFAULT true,
  geo_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentinel_settings TO authenticated;
GRANT ALL ON public.sentinel_settings TO service_role;
ALTER TABLE public.sentinel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sentinel settings" ON public.sentinel_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.geo_risk_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_key TEXT NOT NULL UNIQUE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  place_label TEXT,
  risk_level TEXT NOT NULL DEFAULT 'UNKNOWN',
  risk_score INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT ON public.geo_risk_assessments TO authenticated;
GRANT ALL ON public.geo_risk_assessments TO service_role;
ALTER TABLE public.geo_risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read area risk" ON public.geo_risk_assessments FOR SELECT TO authenticated USING (true);

CREATE TABLE public.geo_risk_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  place_key TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_label TEXT,
  risk_level TEXT NOT NULL DEFAULT 'UNKNOWN',
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_risk_events TO authenticated;
GRANT ALL ON public.geo_risk_events TO service_role;
ALTER TABLE public.geo_risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own geo risk events" ON public.geo_risk_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX geo_risk_events_user_idx ON public.geo_risk_events (user_id, created_at DESC);