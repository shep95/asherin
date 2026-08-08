CREATE TABLE public.rideshare_trip_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ride_id uuid REFERENCES public.rideshare_rides(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'uber',
  label text,
  status text NOT NULL DEFAULT 'recording'
    CHECK (status IN ('recording','ended','analyzed','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_s integer,
  distance_m numeric,
  max_speed_mps numeric,
  avg_speed_mps numeric,
  moving_s integer,
  stopped_s integer,
  coverage_gap_s integer,
  point_count integer NOT NULL DEFAULT 0,
  streets jsonb NOT NULL DEFAULT '[]'::jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rideshare_trip_tracks_idem
  ON public.rideshare_trip_tracks (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX rideshare_trip_tracks_user_started
  ON public.rideshare_trip_tracks (user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rideshare_trip_tracks TO authenticated;
GRANT ALL ON public.rideshare_trip_tracks TO service_role;
ALTER TABLE public.rideshare_trip_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_tracks_own" ON public.rideshare_trip_tracks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.rideshare_trip_points (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.rideshare_trip_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  t timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  accuracy_m real,
  speed_mps real,
  heading_deg real,
  altitude_m real,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rideshare_trip_points_trip_t
  ON public.rideshare_trip_points (trip_id, t);
CREATE UNIQUE INDEX rideshare_trip_points_dedupe
  ON public.rideshare_trip_points (trip_id, t);

GRANT SELECT, INSERT, DELETE ON public.rideshare_trip_points TO authenticated;
GRANT ALL ON public.rideshare_trip_points TO service_role;
ALTER TABLE public.rideshare_trip_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_points_own" ON public.rideshare_trip_points FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);