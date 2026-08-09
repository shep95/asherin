ALTER TABLE public.sentinel_presence
  ADD COLUMN IF NOT EXISTS place_key text,
  ADD COLUMN IF NOT EXISTS place_since timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_pending boolean NOT NULL DEFAULT false;

-- The arrival path claims rows by this latch; without the index the cron pass
-- degrades to a seq scan over every presence row as the fleet grows.
CREATE INDEX IF NOT EXISTS sentinel_presence_arrival_idx
  ON public.sentinel_presence (arrival_pending, place_since)
  WHERE arrival_pending;

-- A one-minute tick is what makes "next_due_at = now()" actually mean now.
-- The sweep itself is still gated per-user by interval_minutes and by the
-- per-cell cooldown, so a faster tick costs a cheap due-check, not more work.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sentinel-cron-sweep') THEN
    PERFORM cron.alter_job(
      (SELECT jobid FROM cron.job WHERE jobname = 'sentinel-cron-sweep'),
      schedule => '* * * * *'
    );
  END IF;
END $$;