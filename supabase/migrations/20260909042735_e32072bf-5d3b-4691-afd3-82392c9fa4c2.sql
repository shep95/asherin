CREATE OR REPLACE FUNCTION public.analytics_live(window_minutes integer DEFAULT 5)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH win AS (
  SELECT now() - make_interval(mins => GREATEST(1, LEAST(COALESCE(window_minutes, 5), 60))) AS t0
),
ev AS (
  SELECT e.*,
         e.occurred_at + make_interval(secs => LEAST(COALESCE(e.dwell_ms, 0), 1800000) / 1000.0) AS last_seen
  FROM public.site_visit_events e, win
  WHERE e.occurred_at >= win.t0 - interval '30 minutes'
    AND e.is_bot = false
),
live AS (
  SELECT * FROM ev, win WHERE last_seen >= win.t0
)
SELECT jsonb_build_object(
  'window_minutes', GREATEST(1, LEAST(COALESCE(window_minutes, 5), 60)),
  'generated_at', now(),
  'online', (SELECT count(DISTINCT visitor_hash) FROM live),
  'sessions', (SELECT count(DISTINCT session_hash) FROM live),
  'devices', jsonb_build_object(
    'mobile',  (SELECT count(DISTINCT visitor_hash) FROM live WHERE device_type = 'mobile'),
    'laptop',  (SELECT count(DISTINCT visitor_hash) FROM live WHERE device_type = 'desktop'),
    'tablet',  (SELECT count(DISTINCT visitor_hash) FROM live WHERE device_type = 'tablet'),
    'other',   (SELECT count(DISTINCT visitor_hash) FROM live WHERE device_type IS NULL OR device_type NOT IN ('mobile','desktop','tablet'))
  ),
  'pages', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', path, 'views', u) ORDER BY u DESC) FROM (
      SELECT path, count(DISTINCT visitor_hash)::int u FROM live GROUP BY path ORDER BY u DESC LIMIT 8
    ) s), '[]'::jsonb),
  'countries', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', COALESCE(country, 'unknown'), 'views', u) ORDER BY u DESC) FROM (
      SELECT country, count(DISTINCT visitor_hash)::int u FROM live GROUP BY country ORDER BY u DESC LIMIT 8
    ) s), '[]'::jsonb)
)
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_live(integer) TO anon, authenticated;