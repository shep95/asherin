CREATE OR REPLACE FUNCTION public.analytics_overview(days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH win AS (
  SELECT now() - make_interval(days => GREATEST(1, LEAST(COALESCE(days, 30), 365))) AS t0
),
ev AS (
  SELECT e.* FROM public.site_visit_events e, win
  WHERE e.occurred_at >= win.t0 AND e.is_bot = false
),
bt AS (
  SELECT e.* FROM public.site_visit_events e, win
  WHERE e.occurred_at >= win.t0 AND e.is_bot = true
),
firsts AS (
  SELECT visitor_hash, min(occurred_at) AS seen_first
  FROM public.site_visit_events WHERE is_bot = false GROUP BY visitor_hash
),
newv AS (
  SELECT count(DISTINCT e.visitor_hash)::int AS n
  FROM ev e JOIN firsts f ON f.visitor_hash = e.visitor_hash, win
  WHERE f.seen_first >= win.t0
),
hr AS (
  SELECT date_trunc('hour', occurred_at) AS h, count(*)::int AS n FROM ev GROUP BY 1
)
SELECT jsonb_build_object(
  'range_days', GREATEST(1, LEAST(COALESCE(days, 30), 365)),
  'generated_at', now(),
  'first_event', (SELECT min(occurred_at) FROM public.site_visit_events),
  'lifetime_events', (SELECT count(*) FROM public.site_visit_events),
  'pageviews', (SELECT count(*) FROM ev),
  'visitors', (SELECT count(DISTINCT visitor_hash) FROM ev),
  'sessions', (SELECT count(DISTINCT session_hash) FROM ev),
  'new_visitors', (SELECT n FROM newv),
  'returning_visitors', GREATEST(0, (SELECT count(DISTINCT visitor_hash) FROM ev) - (SELECT n FROM newv)),
  'signups', (SELECT count(*) FROM ev WHERE goal = 'signup'),
  'avg_dwell_ms', (SELECT round(avg(dwell_ms)) FROM ev WHERE dwell_ms IS NOT NULL AND dwell_ms > 0),
  'median_dwell_ms', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dwell_ms)) FROM ev WHERE dwell_ms IS NOT NULL AND dwell_ms > 0),
  'one_page_sessions', (SELECT count(*) FROM (SELECT session_hash FROM ev GROUP BY session_hash HAVING count(*) = 1) s),
  'avg_load_ms', (SELECT round(avg(load_ms)) FROM ev WHERE load_ms BETWEEN 1 AND 120000),
  'p75_load_ms', (SELECT round(percentile_cont(0.75) WITHIN GROUP (ORDER BY load_ms)) FROM ev WHERE load_ms BETWEEN 1 AND 120000),
  'vpn_suspected_visitors', (SELECT count(DISTINCT visitor_hash) FROM ev WHERE vpn_suspected),
  'bot_hits', (SELECT count(*) FROM bt),
  'daily', COALESCE((SELECT jsonb_agg(x ORDER BY d) FROM (
      SELECT d::date AS d, jsonb_build_object(
        'day', d::date,
        'views', count(e.id),
        'visitors', count(DISTINCT e.visitor_hash),
        'sessions', count(DISTINCT e.session_hash),
        'signups', count(e.id) FILTER (WHERE e.goal = 'signup')
      ) AS x
      FROM generate_series((SELECT t0 FROM win)::date, current_date, interval '1 day') d
      LEFT JOIN ev e ON e.occurred_at::date = d::date
      GROUP BY d
    ) q), '[]'::jsonb),
  'candles', COALESCE((SELECT jsonb_agg(c ORDER BY dd) FROM (
      SELECT h::date AS dd, jsonb_build_object(
        'day', h::date,
        'open', (array_agg(n ORDER BY h))[1],
        'close', (array_agg(n ORDER BY h DESC))[1],
        'high', max(n),
        'low', min(n),
        'volume', sum(n)
      ) AS c
      FROM hr GROUP BY h::date
    ) k), '[]'::jsonb),
  'hourly_shape', COALESCE((SELECT jsonb_agg(jsonb_build_object('hour', hh, 'views', v) ORDER BY hh) FROM (
      SELECT extract(hour FROM occurred_at)::int AS hh, count(*)::int AS v FROM ev GROUP BY 1
    ) s), '[]'::jsonb),
  'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', source, 'views', v, 'visitors', u) ORDER BY v DESC) FROM (
      SELECT source, count(*)::int v, count(DISTINCT visitor_hash)::int u FROM ev GROUP BY source
    ) s), '[]'::jsonb),
  'referrers', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', referrer_host, 'views', v) ORDER BY v DESC) FROM (
      SELECT referrer_host, count(*)::int v FROM ev WHERE referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY v DESC LIMIT 15
    ) s), '[]'::jsonb),
  'pages', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', path, 'views', v, 'visitors', u, 'avg_dwell_ms', dw) ORDER BY v DESC) FROM (
      SELECT path, count(*)::int v, count(DISTINCT visitor_hash)::int u, round(avg(dwell_ms)) dw
      FROM ev GROUP BY path ORDER BY v DESC LIMIT 20
    ) s), '[]'::jsonb),
  'countries', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', COALESCE(country, 'unknown'), 'views', v, 'visitors', u) ORDER BY v DESC) FROM (
      SELECT country, count(*)::int v, count(DISTINCT visitor_hash)::int u FROM ev GROUP BY country ORDER BY v DESC LIMIT 30
    ) s), '[]'::jsonb),
  'regions', COALESCE((SELECT jsonb_agg(jsonb_build_object('country', COALESCE(country, 'unknown'), 'label', COALESCE(region, 'unknown'), 'city', COALESCE(city, 'unknown'), 'views', v) ORDER BY v DESC) FROM (
      SELECT country, region, city, count(*)::int v FROM ev GROUP BY country, region, city ORDER BY v DESC LIMIT 40
    ) s), '[]'::jsonb),
  'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', COALESCE(device_type, 'unknown'), 'views', v) ORDER BY v DESC) FROM (
      SELECT device_type, count(*)::int v FROM ev GROUP BY device_type
    ) s), '[]'::jsonb),
  'browsers', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', COALESCE(browser, 'unknown'), 'views', v) ORDER BY v DESC) FROM (
      SELECT browser, count(*)::int v FROM ev GROUP BY browser ORDER BY v DESC LIMIT 10
    ) s), '[]'::jsonb),
  'bots', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', COALESCE(bot_name, 'unnamed'), 'company', COALESCE(bot_company, 'unknown'), 'views', v, 'last_seen', ls) ORDER BY v DESC) FROM (
      SELECT bot_name, bot_company, count(*)::int v, max(occurred_at) ls FROM bt GROUP BY bot_name, bot_company ORDER BY v DESC LIMIT 25
    ) s), '[]'::jsonb),
  'vpn_reasons', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', vpn_reason, 'views', v) ORDER BY v DESC) FROM (
      SELECT vpn_reason, count(*)::int v FROM ev WHERE vpn_suspected AND vpn_reason IS NOT NULL GROUP BY vpn_reason
    ) s), '[]'::jsonb)
);
$$;