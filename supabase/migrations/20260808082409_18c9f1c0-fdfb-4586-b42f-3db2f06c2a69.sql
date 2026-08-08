ALTER TABLE public.rideshare_rides
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'car',
  ADD COLUMN IF NOT EXISTS operator text,
  ADD COLUMN IF NOT EXISTS operator_label text,
  ADD COLUMN IF NOT EXISTS vehicle_ident text,
  ADD COLUMN IF NOT EXISTS destination_label text,
  ADD COLUMN IF NOT EXISTS depart_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrive_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_ref text,
  ADD COLUMN IF NOT EXISTS seat text,
  ADD COLUMN IF NOT EXISTS leg jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rideshare_rides_mode_check'
  ) THEN
    ALTER TABLE public.rideshare_rides
      ADD CONSTRAINT rideshare_rides_mode_check
      CHECK (mode IN ('car','rail','air','helicopter','bus','ferry'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rideshare_rides_user_mode_created_idx
  ON public.rideshare_rides (user_id, mode, created_at DESC);