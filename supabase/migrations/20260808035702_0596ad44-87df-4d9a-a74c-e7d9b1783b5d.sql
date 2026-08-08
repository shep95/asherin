CREATE TABLE public.wifi_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ssid text,
  bssid text NOT NULL,
  security text,
  rssi integer,
  channel integer,
  frequency_mhz integer,
  band text,
  vendor text,
  estimated_distance_m numeric,
  gateway_ip text,
  dns_servers text[] NOT NULL DEFAULT '{}',
  public_ip text,
  connected_devices integer,
  is_hidden boolean NOT NULL DEFAULT false,
  captive_portal_url text,
  risk_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'unknown',
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  enrichment jsonb NOT NULL DEFAULT '{}'::jsonb,
  latitude double precision,
  longitude double precision,
  connect_count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wifi_networks_user_bssid_key UNIQUE (user_id, bssid)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wifi_networks TO authenticated;
GRANT ALL ON public.wifi_networks TO service_role;

ALTER TABLE public.wifi_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wifi_networks_owner_select" ON public.wifi_networks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wifi_networks_owner_insert" ON public.wifi_networks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wifi_networks_owner_update" ON public.wifi_networks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wifi_networks_owner_delete" ON public.wifi_networks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX wifi_networks_user_last_seen_idx ON public.wifi_networks (user_id, last_seen DESC);
CREATE INDEX wifi_networks_user_risk_idx ON public.wifi_networks (user_id, risk_score DESC);
CREATE INDEX wifi_networks_ssid_idx ON public.wifi_networks (user_id, ssid);

CREATE TRIGGER wifi_networks_set_updated_at
  BEFORE UPDATE ON public.wifi_networks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.security_notification_prefs
  ADD COLUMN IF NOT EXISTS notify_wifi boolean NOT NULL DEFAULT true;