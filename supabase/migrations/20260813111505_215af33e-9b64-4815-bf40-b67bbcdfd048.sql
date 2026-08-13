CREATE TABLE public.asherin_connect_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  organ text NOT NULL,
  capability text NOT NULL,
  from_surface text NOT NULL DEFAULT 'unknown',
  status text NOT NULL CHECK (status IN ('ok','fail','skip','stale')),
  latency_ms integer,
  quote_masked text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, DELETE ON public.asherin_connect_pulls TO authenticated;
GRANT ALL ON public.asherin_connect_pulls TO service_role;

ALTER TABLE public.asherin_connect_pulls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_pulls_select_own" ON public.asherin_connect_pulls
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "connect_pulls_insert_own" ON public.asherin_connect_pulls
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "connect_pulls_delete_own" ON public.asherin_connect_pulls
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX asherin_connect_pulls_user_ts_idx ON public.asherin_connect_pulls (user_id, ts DESC);
CREATE INDEX asherin_connect_pulls_user_organ_ts_idx ON public.asherin_connect_pulls (user_id, organ, ts DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.asherin_connect_pulls;