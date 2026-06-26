DO $$
DECLARE jid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR jid IN
      SELECT jobid FROM cron.job
      WHERE jobname IN ('axrlen-asset-predict-daily','axrlen-asset-settle-hourly')
    LOOP
      PERFORM cron.unschedule(jid);
    END LOOP;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_asset_predictions_asset_date;
DROP TABLE IF EXISTS public.asset_predictions CASCADE;
