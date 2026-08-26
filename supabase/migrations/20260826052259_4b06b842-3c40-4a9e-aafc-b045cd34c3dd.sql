CREATE TABLE public.eye_track_samples (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  icao TEXT NOT NULL,
  callsign TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  alt_m INTEGER,
  gs_kt REAL,
  track_deg REAL,
  kind TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX eye_track_samples_user_time_idx ON public.eye_track_samples (user_id, observed_at DESC);
CREATE INDEX eye_track_samples_icao_time_idx ON public.eye_track_samples (icao, observed_at DESC);
CREATE INDEX eye_track_samples_box_idx ON public.eye_track_samples (lat, lon);

GRANT SELECT, INSERT, DELETE ON public.eye_track_samples TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.eye_track_samples_id_seq TO authenticated;
GRANT ALL ON public.eye_track_samples TO service_role;
GRANT ALL ON SEQUENCE public.eye_track_samples_id_seq TO service_role;

ALTER TABLE public.eye_track_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own track samples readable" ON public.eye_track_samples
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own track samples writable" ON public.eye_track_samples
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own track samples removable" ON public.eye_track_samples
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.eye_grid_hourly (
  cy INTEGER NOT NULL,
  cx INTEGER NOT NULL,
  hour_utc TIMESTAMPTZ NOT NULL,
  samples INTEGER NOT NULL DEFAULT 0,
  contacts INTEGER NOT NULL DEFAULT 0,
  alt_sum BIGINT NOT NULL DEFAULT 0,
  alt_n INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cy, cx, hour_utc)
);

CREATE INDEX eye_grid_hourly_hour_idx ON public.eye_grid_hourly (hour_utc DESC);
CREATE INDEX eye_grid_hourly_cell_idx ON public.eye_grid_hourly (cy, cx);

GRANT SELECT ON public.eye_grid_hourly TO authenticated;
GRANT ALL ON public.eye_grid_hourly TO service_role;

ALTER TABLE public.eye_grid_hourly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grid readable by signed in operators" ON public.eye_grid_hourly
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.eye_grid_absorb(_cells JSONB, _hour TIMESTAMPTZ DEFAULT date_trunc('hour', now()))
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n INTEGER := 0;
BEGIN
  IF jsonb_typeof(_cells) <> 'array' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.eye_grid_hourly AS g (cy, cx, hour_utc, samples, contacts, alt_sum, alt_n, updated_at)
  SELECT
    LEAST(720, GREATEST(-720, (c->>'cy')::INT)),
    LEAST(720, GREATEST(-720, (c->>'cx')::INT)),
    date_trunc('hour', _hour),
    LEAST(5000, GREATEST(0, COALESCE((c->>'samples')::INT, 0))),
    LEAST(5000, GREATEST(0, COALESCE((c->>'contacts')::INT, 0))),
    GREATEST(0, COALESCE((c->>'alt_sum')::BIGINT, 0)),
    LEAST(5000, GREATEST(0, COALESCE((c->>'alt_n')::INT, 0))),
    now()
  FROM jsonb_array_elements(_cells) AS c
  WHERE (c->>'cy') IS NOT NULL AND (c->>'cx') IS NOT NULL
  ON CONFLICT (cy, cx, hour_utc) DO UPDATE
    SET samples = g.samples + EXCLUDED.samples,
        contacts = GREATEST(g.contacts, EXCLUDED.contacts),
        alt_sum = g.alt_sum + EXCLUDED.alt_sum,
        alt_n = g.alt_n + EXCLUDED.alt_n,
        updated_at = now();

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.eye_grid_absorb(JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eye_grid_absorb(JSONB, TIMESTAMPTZ) TO service_role;