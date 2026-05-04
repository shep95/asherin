CREATE TABLE IF NOT EXISTS public.page_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pve_user ON public.page_view_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pve_path ON public.page_view_events(path);
CREATE INDEX IF NOT EXISTS idx_pve_entered ON public.page_view_events(entered_at DESC);

ALTER TABLE public.page_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own page views"
  ON public.page_view_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own page views"
  ON public.page_view_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own page views"
  ON public.page_view_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admin views all page views"
  ON public.page_view_events FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_page_analytics(_since timestamptz)
RETURNS TABLE(path text, visits bigint, unique_users bigint, avg_seconds numeric, total_seconds bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT p.path,
           COUNT(*)::bigint AS visits,
           COUNT(DISTINCT p.user_id)::bigint AS unique_users,
           ROUND(AVG(NULLIF(p.duration_seconds, 0))::numeric, 1) AS avg_seconds,
           SUM(p.duration_seconds)::bigint AS total_seconds
    FROM public.page_view_events p
    WHERE p.entered_at >= _since
    GROUP BY p.path
    ORDER BY visits DESC
    LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION public.admin_page_timeline(_since timestamptz, _bucket text DEFAULT 'day')
RETURNS TABLE(bucket timestamptz, path text, visits bigint, unique_users bigint, avg_seconds numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT date_trunc(_bucket, p.entered_at) AS bucket,
           p.path,
           COUNT(*)::bigint AS visits,
           COUNT(DISTINCT p.user_id)::bigint AS unique_users,
           ROUND(AVG(NULLIF(p.duration_seconds, 0))::numeric, 1) AS avg_seconds
    FROM public.page_view_events p
    WHERE p.entered_at >= _since
    GROUP BY 1, 2
    ORDER BY 1 ASC;
END $$;