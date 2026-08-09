-- The previous attempt matched a job name that does not exist here, so the
-- schedules were left untouched. Match on the real names.
--
-- A one-minute tick does not mean one sweep per user per minute: every user is
-- still gated by their own interval_minutes and by the per-cell cooldown. The
-- tick only decides how quickly "due now" is noticed. Setting next_due_at =
-- now() from a position beacon was already correct; on a five-minute tick it
-- simply meant "sometime in the next five minutes", which is what made an
-- arrival alert miss its window.
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname IN ('sentinel-cron-5min', 'rideshare-autopilot-every-15-min')
  LOOP
    PERFORM cron.alter_job(j.jobid, schedule => '* * * * *');
    RAISE NOTICE 'rescheduled % to every minute', j.jobname;
  END LOOP;
END $$;