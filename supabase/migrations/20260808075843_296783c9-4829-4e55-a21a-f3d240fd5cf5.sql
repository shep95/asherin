CREATE TABLE IF NOT EXISTS public.mesh_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  label text,
  platform text,
  form_factor text NOT NULL DEFAULT 'unknown',
  google_emails text[] NOT NULL DEFAULT '{}',
  battery_pct integer,
  battery_charging boolean,
  battery_at timestamptz,
  lat double precision,
  lng double precision,
  accuracy double precision,
  fix_at timestamptz,
  link_type text,
  effective_type text,
  last_source text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mesh_devices_user_device_key UNIQUE (user_id, device_id),
  CONSTRAINT mesh_devices_battery_range CHECK (battery_pct IS NULL OR (battery_pct >= 0 AND battery_pct <= 100))
);

CREATE INDEX IF NOT EXISTS mesh_devices_user_idx ON public.mesh_devices (user_id, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesh_devices TO authenticated;
GRANT ALL ON public.mesh_devices TO service_role;

ALTER TABLE public.mesh_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mesh_devices_own" ON public.mesh_devices;
CREATE POLICY "mesh_devices_own" ON public.mesh_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mesh_peer_user_ids(_user uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user
  UNION
  SELECT DISTINCT a2.user_id
  FROM public.google_accounts a1
  JOIN public.google_accounts a2
    ON lower(a2.google_email) = lower(a1.google_email)
  WHERE a1.user_id = _user
    AND a1.status = 'active'
    AND a2.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.mesh_roster()
RETURNS TABLE (
  id uuid,
  owner_is_self boolean,
  device_id text,
  label text,
  platform text,
  form_factor text,
  google_emails text[],
  battery_pct integer,
  battery_charging boolean,
  battery_at timestamptz,
  lat double precision,
  lng double precision,
  accuracy double precision,
  fix_at timestamptz,
  link_type text,
  effective_type text,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id,
         d.user_id = auth.uid(),
         d.device_id, d.label, d.platform, d.form_factor, d.google_emails,
         d.battery_pct, d.battery_charging, d.battery_at,
         d.lat, d.lng, d.accuracy, d.fix_at,
         d.link_type, d.effective_type, d.last_seen_at
  FROM public.mesh_devices d
  WHERE auth.uid() IS NOT NULL
    AND d.user_id IN (SELECT public.mesh_peer_user_ids(auth.uid()))
  ORDER BY d.last_seen_at DESC
$$;

REVOKE ALL ON FUNCTION public.mesh_peer_user_ids(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mesh_roster() TO authenticated;

ALTER TABLE public.sentinel_devices ADD COLUMN IF NOT EXISTS mesh_device_id text;