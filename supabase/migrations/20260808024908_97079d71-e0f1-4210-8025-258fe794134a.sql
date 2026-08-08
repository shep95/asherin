-- ============ Asherin Find-My ============

CREATE TABLE public.ble_owned_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  label text NOT NULL DEFAULT 'My device',
  kind text NOT NULL DEFAULT 'unknown',
  state text NOT NULL DEFAULT 'nominal',
  missing_after_minutes integer NOT NULL DEFAULT 60,
  stolen_at timestamptz,
  recovered_at timestamptz,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX idx_ble_owned_devices_user ON public.ble_owned_devices(user_id);
CREATE INDEX idx_ble_owned_devices_fp ON public.ble_owned_devices(fingerprint);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ble_owned_devices TO authenticated;
GRANT ALL ON public.ble_owned_devices TO service_role;

ALTER TABLE public.ble_owned_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own owned-devices select" ON public.ble_owned_devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own owned-devices insert" ON public.ble_owned_devices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own owned-devices update" ON public.ble_owned_devices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own owned-devices delete" ON public.ble_owned_devices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- state machine guard (trigger, not CHECK, so it can consult now())
CREATE OR REPLACE FUNCTION public.ble_owned_devices_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.state NOT IN ('nominal','missing','stolen') THEN
    RAISE EXCEPTION 'invalid state %', NEW.state;
  END IF;
  IF NEW.kind NOT IN ('unknown','laptop','phone','tablet','earbuds','watch','tracker','vehicle','other') THEN
    NEW.kind := 'other';
  END IF;
  NEW.missing_after_minutes := GREATEST(5, LEAST(10080, COALESCE(NEW.missing_after_minutes, 60)));
  NEW.label := NULLIF(btrim(NEW.label), '');
  IF NEW.label IS NULL THEN NEW.label := 'My device'; END IF;
  IF NEW.state = 'stolen' AND NEW.stolen_at IS NULL THEN NEW.stolen_at := now(); END IF;
  IF NEW.state <> 'stolen' THEN NEW.stolen_at := NULL; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ble_owned_devices_guard_trg
  BEFORE INSERT OR UPDATE ON public.ble_owned_devices
  FOR EACH ROW EXECUTE FUNCTION public.ble_owned_devices_guard();

-- ============ immutable theft audit ============

CREATE TABLE public.ble_theft_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  label text NOT NULL DEFAULT '',
  event text NOT NULL,
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ble_theft_audit_user ON public.ble_theft_audit(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.ble_theft_audit TO authenticated;
GRANT ALL ON public.ble_theft_audit TO service_role;

ALTER TABLE public.ble_theft_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own theft audit select" ON public.ble_theft_audit
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own theft audit insert" ON public.ble_theft_audit
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ claim eligibility ============

CREATE OR REPLACE FUNCTION public.ble_can_claim(_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _close_days integer := 0;
  _min_dist numeric;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not authenticated');
  END IF;

  SELECT count(DISTINCT (s.seen_at AT TIME ZONE 'UTC')::date)
    INTO _close_days
  FROM public.ble_sightings s
  JOIN public.ble_devices d ON d.id = s.device_id
  WHERE d.fingerprint = _fingerprint
    AND s.user_id = _uid
    AND COALESCE(s.distance_m, 999) < 5;

  SELECT min(COALESCE(s.distance_m, 999))
    INTO _min_dist
  FROM public.ble_sightings s
  JOIN public.ble_devices d ON d.id = s.device_id
  WHERE d.fingerprint = _fingerprint AND s.user_id = _uid;

  RETURN jsonb_build_object(
    'eligible', _close_days >= 2,
    'close_days', _close_days,
    'required_days', 2,
    'min_distance_m', _min_dist,
    'reason', CASE WHEN _close_days >= 2 THEN 'ok'
                   ELSE 'device must be seen within 5 m by your own scanner on at least 2 distinct days' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ble_can_claim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ble_can_claim(text) TO authenticated;

-- ============ crowd-relay locator ============
-- returns ONLY position/time; never the finder's identity or their other sightings

CREATE OR REPLACE FUNCTION public.locate_owned_device(_fingerprint text, _hours integer DEFAULT 24, _limit integer DEFAULT 200)
RETURNS TABLE(seen_at timestamptz, lat double precision, lng double precision, accuracy_m numeric, rssi integer, distance_m numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _h integer := GREATEST(1, LEAST(720, COALESCE(_hours, 24)));
  _l integer := GREATEST(1, LEAST(500, COALESCE(_limit, 200)));
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ble_owned_devices o
    WHERE o.user_id = _uid AND o.fingerprint = _fingerprint
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.seen_at, s.lat, s.lng, s.accuracy_m::numeric, s.rssi, s.distance_m::numeric
  FROM public.ble_sightings s
  JOIN public.ble_devices d ON d.id = s.device_id
  WHERE d.fingerprint = _fingerprint
    AND s.lat IS NOT NULL AND s.lng IS NOT NULL
    AND s.seen_at > now() - make_interval(hours => _h)
  ORDER BY s.seen_at DESC
  LIMIT _l;
END;
$$;

REVOKE ALL ON FUNCTION public.locate_owned_device(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.locate_owned_device(text, integer, integer) TO authenticated;

-- ============ group map: newest fix per owned device ============

CREATE OR REPLACE FUNCTION public.locate_owned_devices_group(_hours integer DEFAULT 24)
RETURNS TABLE(
  fingerprint text, label text, kind text, state text,
  last_seen_at timestamptz, lat double precision, lng double precision,
  accuracy_m numeric, rssi integer, distance_m numeric, fix_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _h integer := GREATEST(1, LEAST(720, COALESCE(_hours, 24)));
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH owned AS (
    SELECT o.fingerprint, o.label, o.kind, o.state
    FROM public.ble_owned_devices o WHERE o.user_id = _uid
  ),
  fixes AS (
    SELECT d.fingerprint AS fp, s.seen_at, s.lat, s.lng, s.accuracy_m, s.rssi, s.distance_m,
           row_number() OVER (PARTITION BY d.fingerprint ORDER BY s.seen_at DESC) AS rn,
           count(*) OVER (PARTITION BY d.fingerprint) AS cnt
    FROM public.ble_sightings s
    JOIN public.ble_devices d ON d.id = s.device_id
    JOIN owned ow ON ow.fingerprint = d.fingerprint
    WHERE s.lat IS NOT NULL AND s.lng IS NOT NULL
      AND s.seen_at > now() - make_interval(hours => _h)
  )
  SELECT ow.fingerprint, ow.label, ow.kind, ow.state,
         f.seen_at, f.lat, f.lng, f.accuracy_m::numeric, f.rssi, f.distance_m::numeric,
         COALESCE(f.cnt, 0)::integer
  FROM owned ow
  LEFT JOIN fixes f ON f.fp = ow.fingerprint AND f.rn = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.locate_owned_devices_group(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.locate_owned_devices_group(integer) TO authenticated;