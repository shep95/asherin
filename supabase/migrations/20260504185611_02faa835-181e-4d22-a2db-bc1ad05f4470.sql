CREATE OR REPLACE FUNCTION public.admin_aureon_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _total int;
  _validated int;
  _failed int;
  _pending int;
  _by_domain jsonb;
  _recent jsonb;
  _calibration jsonb;
  _accuracy numeric;
  _incidents jsonb;
  _signals_24h int;
  _sessions_24h int;
  _events_24h int;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT COUNT(*) INTO _total FROM public.predictions WHERE created_at > now() - interval '90 days';
  SELECT COUNT(*) INTO _validated FROM public.predictions WHERE outcome = 'correct' AND created_at > now() - interval '90 days';
  SELECT COUNT(*) INTO _failed FROM public.predictions WHERE outcome = 'incorrect' AND created_at > now() - interval '90 days';
  SELECT COUNT(*) INTO _pending FROM public.predictions WHERE outcome IS NULL AND created_at > now() - interval '90 days';

  IF (_validated + _failed) > 0 THEN
    _accuracy := round((_validated::numeric / (_validated + _failed)) * 100, 1);
  ELSE
    _accuracy := 0;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb) INTO _by_domain FROM (
    SELECT event_type AS domain,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE outcome = 'correct') AS correct,
           COUNT(*) FILTER (WHERE outcome = 'incorrect') AS incorrect,
           CASE WHEN COUNT(*) FILTER (WHERE outcome IN ('correct','incorrect')) > 0
                THEN round((COUNT(*) FILTER (WHERE outcome='correct')::numeric
                            / COUNT(*) FILTER (WHERE outcome IN ('correct','incorrect'))) * 100, 1)
                ELSE NULL END AS accuracy
    FROM public.predictions
    WHERE created_at > now() - interval '180 days'
    GROUP BY event_type
    ORDER BY total DESC
    LIMIT 10
  ) d;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO _recent FROM (
    SELECT id, company, event_type, prediction_text, confidence, severity, status, outcome,
           estimated_date, created_at
    FROM public.predictions
    ORDER BY created_at DESC
    LIMIT 12
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) INTO _calibration FROM (
    SELECT bucket AS confidence_band,
           COUNT(*) AS total,
           round(AVG(CASE WHEN outcome='correct' THEN 100.0 WHEN outcome='incorrect' THEN 0.0 END)::numeric, 1) AS actual_accuracy
    FROM (
      SELECT outcome,
             CASE
               WHEN confidence >= 0.9 THEN '90-100%'
               WHEN confidence >= 0.75 THEN '75-89%'
               WHEN confidence >= 0.6 THEN '60-74%'
               WHEN confidence >= 0.4 THEN '40-59%'
               ELSE '0-39%'
             END AS bucket
      FROM public.predictions
      WHERE outcome IN ('correct','incorrect')
    ) b
    GROUP BY bucket
    ORDER BY bucket DESC
  ) c;

  SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO _incidents FROM (
    SELECT id, incident_type, action_taken, severity, auto_resolved, resolved_at, created_at
    FROM public.incident_responses
    ORDER BY created_at DESC
    LIMIT 12
  ) i;

  SELECT COUNT(*) INTO _signals_24h FROM public.prediction_signals WHERE detected_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO _sessions_24h FROM public.user_sessions WHERE created_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO _events_24h FROM public.account_activity_log WHERE created_at > now() - interval '24 hours';

  _result := jsonb_build_object(
    'predictions', jsonb_build_object(
      'total_90d', _total, 'validated', _validated, 'failed', _failed, 'pending', _pending,
      'accuracy_pct', _accuracy,
      'by_domain', _by_domain,
      'recent', _recent,
      'calibration', _calibration
    ),
    'incidents_recent', _incidents,
    'flow_24h', jsonb_build_object(
      'signals', _signals_24h,
      'sessions', _sessions_24h,
      'events', _events_24h
    )
  );

  RETURN _result;
END $$;