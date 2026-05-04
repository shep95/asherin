
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS landing_path text;

CREATE OR REPLACE FUNCTION public.admin_active_sessions(_window_minutes int DEFAULT 10)
RETURNS TABLE(
  user_id uuid,
  email text,
  device_type text,
  os text,
  browser text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  current_path text,
  referrer text,
  utm_source text,
  last_active_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, u.email::text, s.device_type, s.os, s.browser,
         s.city, s.country, s.latitude, s.longitude, s.current_path,
         s.referrer, s.utm_source, s.last_active_at
  FROM public.user_sessions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE s.revoked_at IS NULL
    AND s.last_active_at > now() - make_interval(mins => _window_minutes)
    AND public.is_admin_user(auth.uid())
  ORDER BY s.last_active_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.admin_active_sessions(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_active_sessions(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_module_usage(_since timestamptz)
RETURNS TABLE(module text, tier text, usage_count bigint, user_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH tiered AS (
    SELECT us.user_id,
           CASE
             WHEN lower(us.product_id) LIKE '%lifetime%' THEN 'lifetime'
             WHEN lower(us.product_id) LIKE '%pro%' THEN 'pro'
             WHEN lower(us.product_id) LIKE '%aureon%' THEN 'aureon'
             WHEN lower(us.product_id) LIKE '%chat%' THEN 'chat'
             ELSE 'free'
           END AS tier
    FROM public.user_subscriptions us
    WHERE us.status = 'active'
  ),
  events AS (
    SELECT 'Aureon Chat'::text mod, user_id FROM public.messages WHERE created_at >= _since
    UNION ALL SELECT 'Asher Dashboard', user_id FROM public.asher_ai_messages WHERE created_at >= _since
    UNION ALL SELECT 'Vibe Imager', user_id FROM public.vibe_imager_messages WHERE created_at >= _since
    UNION ALL SELECT 'Vibe Video', user_id FROM public.vibe_video_messages WHERE created_at >= _since
    UNION ALL SELECT 'Zali', user_id FROM public.zali_messages WHERE created_at >= _since
    UNION ALL SELECT 'Asher Code', user_id FROM public.asher_code_files WHERE created_at >= _since
  )
  SELECT e.mod AS module,
         COALESCE(t.tier, 'free') AS tier,
         COUNT(*)::bigint AS usage_count,
         COUNT(DISTINCT e.user_id)::bigint AS user_count
  FROM events e
  LEFT JOIN tiered t ON t.user_id = e.user_id
  GROUP BY e.mod, COALESCE(t.tier, 'free')
  ORDER BY usage_count DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_module_usage(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_usage(timestamptz) TO authenticated;
