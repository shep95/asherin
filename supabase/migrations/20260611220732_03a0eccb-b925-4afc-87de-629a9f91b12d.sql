DROP TABLE IF EXISTS public.vibe_imager_messages CASCADE;
DROP TABLE IF EXISTS public.vibe_imager_versions CASCADE;
DROP TABLE IF EXISTS public.vibe_imager_projects CASCADE;

CREATE OR REPLACE FUNCTION public.admin_module_usage(_since timestamp with time zone)
 RETURNS TABLE(module text, tier text, usage_count bigint, user_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;